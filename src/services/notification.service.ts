/**
 * Notification Service — handles sending WhatsApp messages
 * and logging results to the Notification table.
 *
 * Llamado desde el scheduler en memoria o desde el worker de fondo.
 */

import { prisma } from "@/lib/db";
import {
  getWhatsAppProvider,
  buildConfirmationMessage,
  buildReminderMessage,
  buildCancellationMessage,
  buildReminderTwilioContentVariables,
  buildConfirmationTwilioContentVariables,
  type WhatsAppSendResult,
} from "@/lib/whatsapp";
import type { NotificationType } from "@prisma/client";

export async function processNotification(
  appointmentId: string,
  type: NotificationType
): Promise<void> {
  // Fetch appointment with all relations needed for the message
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      client: true,
      service: true,
      manicurist: { include: { user: true } },
    },
  });

  if (!appointment) {
    console.warn(`[Notification] Appointment ${appointmentId} not found, skipping.`);
    return;
  }

  // Don't send reminder/confirmation for cancelled appointments
  if (
    appointment.status === "CANCELLED" &&
    type !== "CANCELLATION"
  ) {
    console.info(`[Notification] Skipping ${type} for cancelled appointment ${appointmentId}`);
    return;
  }

  // Build or find existing notification record
  let notification = await prisma.notification.findFirst({
    where: { appointmentId, type },
  });

  if (!notification) {
    notification = await prisma.notification.create({
      data: { appointmentId, type },
    });
  }

  const { client, service, manicurist } = appointment;
  const manicuristName = manicurist.user.name;

  const provider = getWhatsAppProvider();
  /** Texto libre solo si no usás plantillas Twilio Content (TWILIO_CONTENT_SID_* en .env). */
  let body: string;

  switch (type) {
    case "CONFIRMATION":
      body = buildConfirmationMessage(
        {
          clientName: client.name,
          serviceName: service.name,
          manicuristName,
          startAt: appointment.startAt,
        },
        undefined
      );
      break;
    case "REMINDER_24H":
      body = buildReminderMessage(
        {
          clientName: client.name,
          serviceName: service.name,
          manicuristName,
          startAt: appointment.startAt,
        },
        undefined
      );
      break;
    case "CANCELLATION":
      body = buildCancellationMessage(
        {
          clientName: client.name,
          serviceName: service.name,
          startAt: appointment.startAt,
        },
        undefined
      );
      break;
    default:
      throw new Error(`Unknown notification type: ${type}`);
  }

  const confirmationContentSid = process.env.TWILIO_CONTENT_SID_CONFIRMATION?.trim();
  const reminderContentSid = process.env.TWILIO_CONTENT_SID_REMINDER?.trim();

  let result: WhatsAppSendResult;
  // No extraer sendContentTemplate a variable: al llamarla suelta pierde `this` y falla this.accountSid en Twilio.
  if (
    type === "CONFIRMATION" &&
    confirmationContentSid &&
    typeof provider.sendContentTemplate === "function"
  ) {
    result = await provider.sendContentTemplate({
      to: client.phone,
      contentSid: confirmationContentSid,
      variables: buildConfirmationTwilioContentVariables({
        clientName: client.name,
        serviceName: service.name,
        manicuristName,
        startAt: appointment.startAt,
      }),
    });
  } else if (
    type === "REMINDER_24H" &&
    reminderContentSid &&
    typeof provider.sendContentTemplate === "function"
  ) {
    result = await provider.sendContentTemplate({
      to: client.phone,
      contentSid: reminderContentSid,
      variables: buildReminderTwilioContentVariables({
        clientName: client.name,
        serviceName: service.name,
        manicuristName,
        startAt: appointment.startAt,
      }),
    });
  } else {
    result = await provider.sendText({ to: client.phone, body });
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: {
      status: result.success ? "SENT" : "FAILED",
      externalId: result.externalId,
      error: result.error,
      sentAt: result.success ? new Date() : null,
    },
  });

  if (!result.success) {
    console.error(
      `[Notification] ❌ ${type} falló para cita ${appointmentId} (${client.phone}): ${result.error}`
    );
    return;
  }

  console.info(
    `[Notification] ✅ ${type} sent to ${client.phone} for appointment ${appointmentId}`
  );
}
