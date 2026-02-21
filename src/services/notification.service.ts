/**
 * Notification Service — handles sending WhatsApp messages
 * and logging results to the Notification table.
 *
 * Called exclusively by BullMQ workers (never from HTTP handlers directly).
 */

import { prisma } from "@/lib/db";
import { getAppSettings } from "@/services/settings.service";
import {
  whatsapp,
  buildConfirmationMessage,
  buildReminderMessage,
  buildCancellationMessage,
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

  const settings = await getAppSettings();
  const templateConfirmation = settings["whatsapp.template.confirmation"];
  const templateReminder = settings["whatsapp.template.reminder"];
  const templateCancellation = settings["whatsapp.template.cancellation"];

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
        templateConfirmation
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
        templateReminder
      );
      break;
    case "CANCELLATION":
      body = buildCancellationMessage(
        {
          clientName: client.name,
          serviceName: service.name,
          startAt: appointment.startAt,
        },
        templateCancellation
      );
      break;
    default:
      throw new Error(`Unknown notification type: ${type}`);
  }

  const result = await whatsapp.sendText({ to: client.phone, body });

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
    // Re-throw so BullMQ retries the job
    throw new Error(`WhatsApp send failed: ${result.error}`);
  }

  console.info(
    `[Notification] ✅ ${type} sent to ${client.phone} for appointment ${appointmentId}`
  );
}
