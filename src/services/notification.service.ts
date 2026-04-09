/**
 * Notification Service — envío de WhatsApp solo con plantillas aprobadas (Twilio Content o Meta).
 */

import { prisma } from "@/lib/db";
import {
  getWhatsAppProvider,
  buildConfirmationTwilioContentVariables,
  buildReminderTwilioContentVariables,
  buildCancellationTwilioContentVariables,
  type WhatsAppSendResult,
} from "@/lib/whatsapp";
import type { NotificationType } from "@prisma/client";

function twilioContentSidForType(type: NotificationType): string | undefined {
  switch (type) {
    case "CONFIRMATION":
      return process.env.TWILIO_CONTENT_SID_CONFIRMATION?.trim();
    case "REMINDER_24H":
      return process.env.TWILIO_CONTENT_SID_REMINDER?.trim();
    case "CANCELLATION":
      return process.env.TWILIO_CONTENT_SID_CANCELLATION?.trim();
    default:
      return undefined;
  }
}

function metaTemplateNameForType(type: NotificationType): string | undefined {
  switch (type) {
    case "CONFIRMATION":
      return process.env.META_WHATSAPP_TEMPLATE_CONFIRMATION?.trim();
    case "REMINDER_24H":
      return process.env.META_WHATSAPP_TEMPLATE_REMINDER?.trim();
    case "CANCELLATION":
      return process.env.META_WHATSAPP_TEMPLATE_CANCELLATION?.trim();
    default:
      return undefined;
  }
}

function metaTemplateLanguage(): string {
  return (process.env.META_WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "es_AR").replace(/-/g, "_");
}

function templateVariablesForNotification(
  type: NotificationType,
  params: {
    clientName: string;
    serviceName: string;
    manicuristName: string;
    startAt: Date;
  }
): Record<string, string> {
  switch (type) {
    case "CONFIRMATION":
      return buildConfirmationTwilioContentVariables({
        clientName: params.clientName,
        serviceName: params.serviceName,
        manicuristName: params.manicuristName,
        startAt: params.startAt,
      });
    case "REMINDER_24H":
      return buildReminderTwilioContentVariables({
        clientName: params.clientName,
        serviceName: params.serviceName,
        manicuristName: params.manicuristName,
        startAt: params.startAt,
      });
    case "CANCELLATION":
      return buildCancellationTwilioContentVariables({
        clientName: params.clientName,
        serviceName: params.serviceName,
        startAt: params.startAt,
      });
    default:
      throw new Error(`Unknown notification type: ${type}`);
  }
}

export async function processNotification(
  appointmentId: string,
  type: NotificationType
): Promise<void> {
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

  if (appointment.status === "CANCELLED" && type !== "CANCELLATION") {
    console.info(`[Notification] Skipping ${type} for cancelled appointment ${appointmentId}`);
    return;
  }

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
  const vars = templateVariablesForNotification(type, {
    clientName: client.name,
    serviceName: service.name,
    manicuristName,
    startAt: appointment.startAt,
  });

  let result: WhatsAppSendResult;

  if (typeof provider.sendContentTemplate === "function") {
    const contentSid = twilioContentSidForType(type);
    if (!contentSid) {
      result = {
        success: false,
        error: `Falta plantilla Twilio Content para ${type}: definí TWILIO_CONTENT_SID_CONFIRMATION, TWILIO_CONTENT_SID_REMINDER y TWILIO_CONTENT_SID_CANCELLATION.`,
      };
    } else {
      result = await provider.sendContentTemplate({
        to: client.phone,
        contentSid,
        variables: vars,
      });
    }
  } else if (typeof provider.sendMetaTemplate === "function") {
    const templateName = metaTemplateNameForType(type);
    if (!templateName) {
      result = {
        success: false,
        error: `Falta plantilla Meta para ${type}: definí META_WHATSAPP_TEMPLATE_CONFIRMATION, META_WHATSAPP_TEMPLATE_REMINDER y META_WHATSAPP_TEMPLATE_CANCELLATION (y opcional META_WHATSAPP_TEMPLATE_LANGUAGE).`,
      };
    } else {
      result = await provider.sendMetaTemplate({
        to: client.phone,
        templateName,
        languageCode: metaTemplateLanguage(),
        variables: vars,
      });
    }
  } else {
    result = {
      success: false,
      error:
        "WhatsApp: las notificaciones solo usan plantillas. Configurá Twilio (TWILIO_CONTENT_SID_CONFIRMATION, TWILIO_CONTENT_SID_REMINDER, TWILIO_CONTENT_SID_CANCELLATION) o Meta (META_WHATSAPP_TEMPLATE_CONFIRMATION/REMINDER/CANCELLATION + META_WHATSAPP_TEMPLATE_LANGUAGE).",
    };
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

  // Logging adicional para ver el resultado completo
  console.log('[Notification] Resultado del envío:', {
    type,
    appointmentId,
    clientPhone: client.phone,
    success: result.success,
    externalId: result.externalId,
    error: result.error
  });

  if (!result.success) {
    console.error(
      `[Notification] ❌ ${type} falló para cita ${appointmentId} (${client.phone}): ${result.error}`
    );
    return;
  }

  console.info(
    `[Notification] ✅ ${type} (plantilla) enviado a ${client.phone} para cita ${appointmentId}`
  );
}
