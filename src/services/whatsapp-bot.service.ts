/**
 * WhatsApp Bot Service (Meta WhatsApp Cloud API)
 *
 * Servicio que gestiona el bot de agendado por WhatsApp usando Meta WhatsApp Cloud API.
 * Procesa mensajes entrantes, mantiene sesiones de conversación y permite
 * agendar citas de forma interactiva.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { sendMessage } from "@/services/whatsapp-chat.service";
import {
  createAppointment,
  getAppointmentsByDate,
  getAvailableSlots,
} from "@/services/appointment.service";
import {
  buildMenuMessage,
  buildMenuShort,
  buildBookingIntro,
  buildManicuristSelectionMessage,
  buildManicuristConfirmedMessage,
  buildServiceSelectionMessage,
  buildServiceConfirmedMessage,
  buildDateSelectionMessage,
  buildDateConfirmedMessage,
  buildCustomDateMessage,
  buildInvalidDateMessage,
  buildPastDateMessage,
  buildSlotSelectionMessage,
  buildSlotConfirmedMessage,
  buildInvalidSlotMessage,
  buildSlotTakenMessage,
  buildConfirmationMessage,
  buildAppointmentListMessage,
  buildCancellationIntro,
  buildCancelSelectionMessage,
  buildCancellationSuccessMessage,
  buildCancellationNotFoundError,
  buildInvalidCancelInputMessage,
  buildHelpMessage,
  buildWelcomeForNewClient,
  buildWelcomeForExistingClient,
  buildGenericErrorMessage,
  buildInvalidOptionMessage,
  buildSessionExpiredMessage,
  buildBusinessNotAvailableMessage,
  buildAvailabilityMessage,
  buildNoManicuristsMessage,
  buildNoServicesMessage,
  buildProcessingMessage,
  buildDoneMessage,
  formatErrorWithHelp,
} from "@/lib/bot-messages";
import type {
  ManicuristWithUser,
  Service,
  AppointmentWithRelations,
} from "@/types";
import type { WhatsAppBotSession } from "@prisma/client";
import {
  BotStep,
  BotCommand,
  BotSessionData,
  detectCommand,
  parseCancelCommand,
  canProcessGlobalCommand,
  requiresNumericSelection,
  getNextState,
  determineTargetStep,
  createEmptySessionData,
  updateSessionData,
  clearTemporarySessionData,
  resetSessionData,
  textToIndex,
  parseCustomDate,
  isValidFutureDate,
  generateDateOptions,
  hasSessionExpired,
  getSessionRemainingTime,
  getStepDescription,
  isBookingFlow,
  isActiveFlow,
  extractSelectionIndex,
  normalizeInputText,
  classifyError,
  getErrorMessage,
} from "@/lib/bot-flow";
import { addDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toCanaryTimezone, normalisePhone } from "@/lib/utils";

// ─── Configuración ───────────────────────────────────────────────────────────

const SESSION_TIMEOUT_MINUTES = parseInt(
  process.env.WHATSAPP_BOT_TIMEOUT_MINUTES || "30",
  10
);

const AUTO_WELCOME_ENABLED =
  process.env.WHATSAPP_BOT_AUTO_WELCOME !== "false";

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export interface BotResponse {
  message: string;
  nextStep?: BotStep;
  shouldEndFlow?: boolean;
}

export interface BotOptions {
  businessId: string;
  phoneE164: string;
  text: string;
}

// ─── Funciones Principales ─────────────────────────────────────────────────────

/**
 * Punto de entrada principal para procesar mensajes del bot
 */
async function handleWhatsAppMessage(options: BotOptions): Promise<void> {
  const { businessId, phoneE164, text } = options;

  console.log(
    `[WhatsApp Bot] Processing message from ${phoneE164} for business ${businessId}: "${text}"`
  );

  try {
    // Obtener o crear sesión del cliente
    const session = await getSessionOrCreate(businessId, phoneE164);
    if (!session) {
      throw new Error("No se pudo crear la sesión del bot");
    }

    // Verificar si la sesión expiró
    if (hasSessionExpired(session, SESSION_TIMEOUT_MINUTES)) {
      await handleExpiredSession(session);
      return;
    }

    // Procesar el mensaje según el estado actual
    const response = await processMessage(session, text);

    // Actualizar la sesión con el nuevo estado
    await updateSession(session.id, response.nextStep);

    // Enviar respuesta al cliente
    await sendMessage(businessId, phoneE164, response.message);

    console.log(
      `[WhatsApp Bot] Response sent to ${phoneE164}. Next step: ${response.nextStep || "idle"}`
    );
  } catch (error) {
    console.error("[WhatsApp Bot] Error handling message:", error);

    try {
      const errorMessage = buildGenericErrorMessage();
      await sendMessage(businessId, phoneE164, errorMessage);
    } catch (sendError) {
      console.error("[WhatsApp Bot] Error sending error message:", sendError);
    }
  }
}

/**
 * Procesa un mensaje basándose en el estado actual de la sesión
 */
async function processMessage(
  session: WhatsAppBotSession,
  text: string
): Promise<BotResponse> {
  const sessionData = (session.data as BotSessionData) || createEmptySessionData();
  const normalizedText = normalizeInputText(text);

  // Detectar comandos globales
  const command = detectCommand(normalizedText);

  // Si hay comando global y se puede procesar en este estado
  if (command && canProcessGlobalCommand(session.step)) {
    return await processCommand(session, command, text, sessionData);
  }

  // Si no hay comando y estamos en idle, mostrar menú
  if (session.step === "idle" && !command) {
    return await handleIdleState(session, sessionData);
  }

  // Procesar según el estado actual del flujo
  return await processFlowStep(session, text, sessionData, command);
}

/**
 * Procesa comandos globales (MENU, AGENDAR, CITAS, etc.)
 */
async function processCommand(
  session: WhatsAppBotSession,
  command: BotCommand,
  text: string,
  data: BotSessionData
): Promise<BotResponse> {
  const { businessId, phoneE164 } = session;
  const business = await getBusiness(session.businessId);

  switch (command) {
    case "MENU":
      return {
        message: buildMenuShort(),
        nextStep: "idle",
        shouldEndFlow: true,
      };

    case "AGENDAR":
      return await startBookingFlow(session, data);

    case "CITAS":
      return await handleViewAppointments(session, data);

    case "CANCELAR":
      // Verificar si tiene número específico
      const cancelIndex = parseCancelCommand(text);
      if (cancelIndex) {
        return await handleCancelSpecificAppointment(session, data, cancelIndex);
      }
      return await startCancellationFlow(session, data);

    case "AYUDA":
      return {
        message: buildHelpMessage({ businessName: business?.name }),
        nextStep: session.step, // No cambiar el estado
        shouldEndFlow: false,
      };

    case "DISPONIBILIDAD":
      return await handleAvailabilityQuery(session, data);

    default:
      return {
        message: buildInvalidOptionMessage(),
        nextStep: session.step,
        shouldEndFlow: false,
      };
  }
}

/**
 * Procesa el paso actual del flujo de agendado
 */
async function processFlowStep(
  session: WhatsAppBotSession,
  text: string,
  data: BotSessionData,
  command: BotCommand | null
): Promise<BotResponse> {
  switch (session.step) {
    case "manicurist":
      return await handleManicuristSelection(session, text, data);

    case "service":
      return await handleServiceSelection(session, text, data);

    case "date":
      return await handleDateSelection(session, text, data);

    case "custom_date":
      return await handleCustomDateInput(session, text, data);

    case "slot":
      return await handleSlotSelection(session, text, data);

    case "cancelling":
      return await handleCancellation(session, text, data);

    default:
      return {
        message: buildMenuShort(),
        nextStep: "idle",
        shouldEndFlow: true,
      };
  }
}

// ─── Manejo de Estado: Idle ───────────────────────────────────────────────────

async function handleIdleState(
  session: WhatsAppBotSession,
  data: BotSessionData
): Promise<BotResponse> {
  const business = await getBusiness(session.businessId);
  if (!business) {
    return {
      message: buildBusinessNotAvailableMessage(),
      nextStep: "idle",
    };
  }

  // Verificar si es cliente nuevo o existente
  const client = await getOrCreateClient(session.phoneE164, session.businessId);
  const updatedData = updateSessionData(data, {
    clientId: client.id,
    clientName: client.name,
    isNewClient: client.appointments.length === 0,
  });

  // Actualizar sesión con datos del cliente
  await prisma.whatsAppBotSession.update({
    where: { id: session.id },
    data: { data: updatedData },
  });

  // Generar mensaje de bienvenida apropiado
  const message = client.appointments.length === 0
    ? buildWelcomeForNewClient()
    : buildWelcomeForExistingClient(client.name);

  return {
    message,
    nextStep: "idle",
    shouldEndFlow: false,
  };
}

// ─── Manejo de Flujo de Agendado ────────────────────────────────────────────

async function startBookingFlow(
  session: WhatsAppBotSession,
  data: BotSessionData
): Promise<BotResponse> {
  const manicurists = await getAvailableManicurists(session.businessId);

  if (manicurists.length === 0) {
    return {
      message: buildNoManicuristsMessage(),
      nextStep: "idle",
    };
  }

  const updatedData = clearTemporarySessionData(data);
  await prisma.whatsAppBotSession.update({
    where: { id: session.id },
    data: { data: updatedData },
  });

  return {
    message: `${buildBookingIntro()}\n\n${buildManicuristSelectionMessage({
      manicurists,
    })}`,
    nextStep: "manicurist",
  };
}

async function handleManicuristSelection(
  session: WhatsAppBotSession,
  text: string,
  data: BotSessionData
): Promise<BotResponse> {
  const manicurists = await getAvailableManicurists(session.businessId);
  const index = textToIndex(text, manicurists.map((m) => m.user.name));

  if (index === null) {
    return {
      message: buildInvalidOptionMessage(),
      nextStep: session.step,
    };
  }

  const selected = manicurists[index];
  const updatedData = updateSessionData(data, {
    manicuristId: selected.id,
    manicuristName: selected.user.name,
  });

  await prisma.whatsAppBotSession.update({
    where: { id: session.id },
    data: { data: updatedData },
  });

  const services = await getAvailableServices(session.businessId);

  return {
    message: `${buildManicuristConfirmedMessage(selected.user.name)}\n\n${buildServiceSelectionMessage(
      { services }
    )}`,
    nextStep: "service",
  };
}

async function handleServiceSelection(
  session: WhatsAppBotSession,
  text: string,
  data: BotSessionData
): Promise<BotResponse> {
  const services = await getAvailableServices(session.businessId);
  const index = textToIndex(text, services.map((s) => s.name));

  if (index === null) {
    return {
      message: buildInvalidOptionMessage(),
      nextStep: session.step,
    };
  }

  const selected = services[index];
  const updatedData = updateSessionData(data, {
    serviceId: selected.id,
    serviceName: selected.name,
    serviceDuration: selected.duration,
  });

  await prisma.whatsAppBotSession.update({
    where: { id: session.id },
    data: { data: updatedData },
  });

  return {
    message: `${buildServiceConfirmedMessage(selected.name, selected.duration)}\n\n${buildDateSelectionMessage()}`,
    nextStep: "date",
  };
}

async function handleDateSelection(
  session: WhatsAppBotSession,
  text: string,
  data: BotSessionData
): Promise<BotResponse> {
  const selection = extractSelectionIndex(text);

  if (selection === null) {
    return {
      message: buildInvalidOptionMessage(),
      nextStep: session.step,
    };
  }

  const today = toCanaryTimezone(new Date());

  switch (selection) {
    case 1: // Hoy
      {
        const dateStr = today.toISOString();
        const updatedData = updateSessionData(data, { selectedDate: dateStr });
        await prisma.whatsAppBotSession.update({
          where: { id: session.id },
          data: { data: updatedData },
        });

        return await showAvailableSlots(session, updatedData, today);
      }

    case 2: // Mañana
      {
        const tomorrow = addDays(today, 1);
        const dateStr = tomorrow.toISOString();
        const updatedData = updateSessionData(data, { selectedDate: dateStr });
        await prisma.whatsAppBotSession.update({
          where: { id: session.id },
          data: { data: updatedData },
        });

        return await showAvailableSlots(session, updatedData, tomorrow);
      }

    case 3: // Próximos 7 días
      {
        const dateOptions = generateDateOptions(today);
        const todayFormatted = format(today, "d/M", { locale: es });
        let message = `📅 Próximos días disponibles:\n\n`;
        dateOptions.forEach((opt, i) => {
          message += `${i + 1}. ${opt.label}\n`;
        });
        message += `\n5. Elegir otra fecha (día/mes)`;
        message += `\n\nSeleccioná un número.`;

        return {
          message,
          nextStep: "date",
        };
      }

    case 4: // Otra fecha
      {
        const updatedData = updateSessionData(data, {
          selectedDate: undefined,
          customDateInput: "",
        });
        await prisma.whatsappBotSession.update({
          where: { id: session.id },
          data: { data: updatedData },
        });

        return {
          message: buildCustomDateMessage(),
          nextStep: "custom_date",
        };
      }

    case 5: // Opción de "otra fecha" después de mostrar días
      {
        const updatedData = updateSessionData(data, {
          selectedDate: undefined,
          customDateInput: "",
        });
        await prisma.whatsAppBotSession.update({
          where: { id: session.id },
          data: { data: updatedData },
        });

        return {
          message: buildCustomDateMessage(),
          nextStep: "custom_date",
        };
      }

    default:
      return {
        message: buildInvalidOptionMessage(),
        nextStep: session.step,
      };
  }
}

async function handleCustomDateInput(
  session: WhatsAppBotSession,
  text: string,
  data: BotSessionData
): Promise<BotResponse> {
  const parsedDate = parseCustomDate(text);

  if (!parsedDate) {
    return {
      message: buildInvalidDateMessage(),
      nextStep: session.step,
    };
  }

  if (!isValidFutureDate(parsedDate)) {
    return {
      message: buildPastDateMessage(),
      nextStep: session.step,
    };
  }

  const dateStr = parsedDate.toISOString();
  const updatedData = updateSessionData(data, { selectedDate: dateStr });
  await prisma.whatsAppBotSession.update({
    where: { id: session.id },
    data: { data: updatedData },
  });

  return await showAvailableSlots(session, updatedData, parsedDate);
}

async function showAvailableSlots(
  session: WhatsAppBotSession,
  data: BotSessionData,
  date: Date
): Promise<BotResponse> {
  if (!data.manicuristId || !data.serviceDuration) {
    return {
      message: buildInvalidOptionMessage(),
      nextStep: "idle",
    };
  }

  const slots = await getAvailableSlots(
    data.manicuristId,
    date,
    data.serviceDuration
  );

  if (slots.length === 0) {
    return {
      message: buildAvailabilityMessage(false, date),
      nextStep: "date",
    };
  }

  const formatted = format(date, "d/M", { locale: es });
  return {
    message: `${buildDateConfirmedMessage(date)}\n\n${buildSlotSelectionMessage({
      slots,
      showDate: true,
    })}`,
    nextStep: "slot",
  };
}

async function handleSlotSelection(
  session: WhatsAppBotSession,
  text: string,
  data: BotSessionData
): Promise<BotResponse> {
  if (!data.selectedDate || !data.serviceDuration) {
    return {
      message: buildInvalidOptionMessage(),
      nextStep: "idle",
    };
  }

  const selectedDate = parseISO(data.selectedDate);
  const slots = await getAvailableSlots(
    data.manicuristId!,
    selectedDate,
    data.serviceDuration
  );

  const index = extractSelectionIndex(text);

  if (index === null || index < 1 || index > slots.length) {
    return {
      message: buildInvalidSlotMessage(),
      nextStep: session.step,
    };
  }

  const selectedSlot = slots[index - 1];

  // Crear la cita
  if (!data.clientId) {
    return {
      message: buildGenericErrorMessage(),
      nextStep: "idle",
    };
  }

  const appointment = await createAppointment({
    clientId: data.clientId,
    manicuristId: data.manicuristId!,
    serviceId: data.serviceId!,
    startAt: selectedSlot.start.toISOString(),
    sendWhatsApp: true,
  });

  // Limpiar datos temporales de la sesión
  const cleanedData = clearTemporarySessionData(data);
  await prisma.whatsAppBotSession.update({
    where: { id: session.id },
    data: { data: cleanedData, step: "idle" },
  });

  // Obtener cita con relaciones para el mensaje de confirmación
  const appointmentWithRelations = await prisma.appointment.findUnique({
    where: { id: appointment.id },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      manicurist: {
        include: { user: { select: { id: true, name: true } } },
      },
      service: { select: { id: true, name: true, duration: true } },
    },
  });

  if (!appointmentWithRelations) {
    return {
      message: buildGenericErrorMessage(),
      nextStep: "idle",
    };
  }

  return {
    message: buildConfirmationMessage({
      appointment: appointmentWithRelations as AppointmentWithRelations,
    }),
    nextStep: "idle",
    shouldEndFlow: true,
  };
}

// ─── Manejo de Consulta de Citas ─────────────────────────────────────────

async function handleViewAppointments(
  session: WhatsAppBotSession,
  data: BotSessionData
): Promise<BotResponse> {
  if (!data.clientId) {
    const client = await getOrCreateClient(
      session.phoneE164,
      session.businessId
    );
    const updatedData = updateSessionData(data, {
      clientId: client.id,
      clientName: client.name,
      isNewClient: client.appointments.length === 0,
    });

    await prisma.whatsAppBotSession.update({
      where: { id: session.id },
      data: { data: updatedData },
    });
  }

  const updatedData = (session.data as BotSessionData) || data;
  if (!updatedData.clientId) {
    return {
      message: buildGenericErrorMessage(),
      nextStep: "idle",
    };
  }

  const appointments = await getActiveAppointmentsForClient(
    updatedData.clientId,
    session.businessId
  );

  return {
    message: buildAppointmentListMessage({
      appointments,
      clientName: updatedData.clientName || "Cliente",
    }),
    nextStep: "idle",
  };
}

// ─── Manejo de Cancelación de Citas ───────────────────────────────────────

async function startCancellationFlow(
  session: WhatsAppBotSession,
  data: BotSessionData
): Promise<BotResponse> {
  if (!data.clientId) {
    const client = await getOrCreateClient(
      session.phoneE164,
      session.businessId
    );
    const updatedData = updateSessionData(data, {
      clientId: client.id,
      clientName: client.name,
    });

    await prisma.whatsAppBotSession.update({
      where: { id: session.id },
      data: { data: updatedData },
    });
  }

  const updatedData = (session.data as BotSessionData) || data;
  if (!updatedData.clientId) {
    return {
      message: buildGenericErrorMessage(),
      nextStep: "idle",
    };
  }

  const appointments = await getActiveAppointmentsForClient(
    updatedData.clientId,
    session.businessId
  );

  if (appointments.length === 0) {
    return {
      message: buildCancellationNotFoundError(),
      nextStep: "idle",
    };
  }

  return {
    message: `${buildCancellationIntro()}\n\n${buildCancelSelectionMessage(
      appointments
    )}`,
    nextStep: "cancelling",
  };
}

async function handleCancellation(
  session: WhatsAppBotSession,
  text: string,
  data: BotSessionData
): Promise<BotResponse> {
  if (!data.clientId) {
    return {
      message: buildGenericErrorMessage(),
      nextStep: "idle",
    };
  }

  const appointments = await getActiveAppointmentsForClient(
    data.clientId,
    session.businessId
  );
  const index = extractSelectionIndex(text);

  if (index === null || index < 1 || index > appointments.length) {
    return {
      message: buildInvalidCancelInputMessage(),
      nextStep: session.step,
    };
  }

  const appointmentToCancel = appointments[index - 1];

  await prisma.appointment.delete({
    where: { id: appointmentToCancel.id },
  });

  const cleanedData = clearTemporarySessionData(data);
  await prisma.whatsappBotSession.update({
    where: { id: session.id },
    data: { data: cleanedData, step: "idle" },
  });

  return {
    message: buildCancellationSuccessMessage(),
    nextStep: "idle",
    shouldEndFlow: true,
  };
}

async function handleCancelSpecificAppointment(
  session: WhatsAppBotSession,
  data: BotSessionData,
  cancelIndex: number
): Promise<BotResponse> {
  if (!data.clientId) {
    const client = await getOrCreateClient(
      session.phoneE164,
      session.businessId
    );
    const updatedData = updateSessionData(data, {
      clientId: client.id,
      clientName: client.name,
    });

    await prisma.whatsappBotSession.update({
      where: { id: session.id },
      data: { data: updatedData },
    });
  }

  const updatedData = (session.data as BotSessionData) || data;
  if (!updatedData.clientId) {
    return {
      message: buildGenericErrorMessage(),
      nextStep: "idle",
    };
  }

  const appointments = await getActiveAppointmentsForClient(
    updatedData.clientId,
    session.businessId
  );

  if (cancelIndex < 1 || cancelIndex > appointments.length) {
    return {
      message: buildCancellationNotFoundError(),
      nextStep: "idle",
    };
  }

  const appointmentToCancel = appointments[cancelIndex - 1];

  await prisma.appointment.delete({
    where: { id: appointmentToCancel.id },
  });

  const cleanedData = clearTemporarySessionData(updatedData);
  await prisma.whatsappBotSession.update({
    where: { id: session.id },
    data: { data: cleanedData, step: "idle" },
  });

  return {
    message: buildCancellationSuccessMessage(),
    nextStep: "idle",
    shouldEndFlow: true,
  };
}

// ─── Manejo de Consulta de Disponibilidad ───────────────────────────────

async function handleAvailabilityQuery(
  session: WhatsAppBotSession,
  data: BotSessionData
): Promise<BotResponse> {
  const today = toCanaryTimezone(new Date());
  const tomorrow = addDays(today, 1);
  const inTwoDays = addDays(today, 2);

  const manicurists = await getAvailableManicurists(session.businessId);

  if (manicurists.length === 0) {
    return {
      message: buildNoManicuristsMessage(),
      nextStep: "idle",
    };
  }

  let message = "✨ Disponibilidad para las próximas 24h:\n\n";

  for (const manicurist of manicurists.slice(0, 3)) {
    // Solo mostrar 3 manicuristas máximo
    const todaySlots = await getAvailableSlots(
      manicurist.id,
      today,
      60 // 1 hora como duración base
    );

    const tomorrowSlots = await getAvailableSlots(
      manicurist.id,
      tomorrow,
      60
    );

    if (todaySlots.length > 0 || tomorrowSlots.length > 0) {
      message += `💅 ${manicurist.user.name}:\n`;
      if (todaySlots.length > 0) {
        const times = todaySlots
          .slice(0, 3)
          .map(
            (s) =>
              format(toCanaryTimezone(s.start), "HH:mm", { locale: es })
          )
          .join(", ");
        message += `  • Hoy: ${times}\n`;
      }
      if (tomorrowSlots.length > 0) {
        const times = tomorrowSlots
          .slice(0, 3)
          .map(
            (s) =>
              format(toCanaryTimezone(s.start), "HH:mm", { locale: es })
          )
          .join(", ");
        message += `  • Mañana: ${times}\n`;
      }
      message += "\n";
    }
  }

  message += `Para agendar, escribí AGENDAR.`;

  return {
    message,
    nextStep: "idle",
  };
}

// ─── Manejo de Sesión Expirada ───────────────────────────────────────────────

async function handleExpiredSession(session: WhatsAppBotSession): Promise<void> {
  const business = await getBusiness(session.businessId);

  // Reiniciar la sesión a idle
  await prisma.whatsappBotSession.update({
    where: { id: session.id },
    data: {
      step: "idle",
      data: createEmptySessionData(),
    },
  });

  const message = buildSessionExpiredMessage();
  await sendMessage(session.businessId, session.phoneE164, message);

  console.log(
    `[WhatsApp Bot] Session expired for ${session.phoneE164}, reset to idle`
  );
}

// ─── Funciones de Acceso a Datos ─────────────────────────────────────────────

/**
 * Obtiene o crea una sesión del bot para el cliente
 */
async function getSessionOrCreate(
  businessId: string,
  phoneE164: string
): Promise<WhatsAppBotSession | null> {
  try {
    // Intentar obtener sesión existente
    let session = await prisma.whatsAppBotSession.findUnique({
      where: {
        businessId_phoneE164: {
          businessId,
          phoneE164,
        },
      },
    });

    // Si no existe, crear nueva sesión
    if (!session) {
      session = await prisma.whatsAppBotSession.create({
        data: {
          businessId,
          phoneE164,
          step: "idle",
          data: createEmptySessionData(),
        },
      });
    }

    return session;
  } catch (error) {
    console.error("[WhatsApp Bot] Error getting/creating session:", error);
    return null;
  }
}

/**
 * Actualiza el estado de una sesión del bot
 */
async function updateSession(
  sessionId: string,
  nextStep: BotStep | undefined
): Promise<void> {
  if (!nextStep) return;

  await prisma.whatsAppBotSession.update({
    where: { id: sessionId },
    data: {
      step: nextStep,
      updatedAt: new Date(),
    },
  });
}

/**
 * Obtiene información del negocio
 */
async function getBusiness(businessId: string) {
  return prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, isActive: true },
  });
}

/**
 * Obtiene manicuristas activos del negocio
 */
async function getAvailableManicurists(
  businessId: string
): Promise<ManicuristWithUser[]> {
  const manicurists = await prisma.manicurist.findMany({
    where: {
      businessId,
      isActive: true,
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
      schedules: true,
    },
    orderBy: {
      user: { name: "asc" },
    },
  });

  return manicurists.map((m) => ({
    ...m,
    user: m.user as any,
    schedules: m.schedules as any[],
  }));
}

/**
 * Obtiene servicios activos del negocio
 */
async function getAvailableServices(businessId: string): Promise<Service[]> {
  return prisma.service.findMany({
    where: {
      businessId,
      isActive: true,
    },
    orderBy: { name: "asc" },
  });
}

/**
 * Obtiene o crea un cliente por número de teléfono
 */
async function getOrCreateClient(
  phoneE164: string,
  businessId: string
): Promise<any> {
  // Normalizar número de teléfono
  const normalisedPhone = normalisePhone(phoneE164);

  // Buscar cliente existente
  let client = await prisma.client.findUnique({
    where: {
      businessId_phone: {
        businessId,
        phone: normalisedPhone,
      },
    },
    include: {
      appointments: {
        where: {
          status: { in: ["PENDING", "CONFIRMED"] },
          startAt: { gte: new Date() },
        },
        take: 5,
        orderBy: { startAt: "asc" },
      },
    },
  });

  // Si no existe, crear nuevo cliente
  if (!client) {
    const lastFourDigits = normalisedPhone.slice(-4);
    client = await prisma.client.create({
      data: {
        businessId,
        name: `Cliente ${lastFourDigits}`,
        phone: normalisedPhone,
      },
      include: {
        appointments: {
          where: {
            status: { in: ["PENDING", "CONFIRMED"] },
            startAt: { gte: new Date() },
          },
          take: 5,
          orderBy: { startAt: "asc" },
        },
      },
    });
  }

  return client;
}

/**
 * Obtiene citas activas de un cliente
 */
async function getActiveAppointmentsForClient(
  clientId: string,
  businessId: string
): Promise<AppointmentWithRelations[]> {
  const appointments = await prisma.appointment.findMany({
    where: {
      businessId,
      clientId,
      status: { in: ["PENDING", "CONFIRMED"] },
      startAt: { gte: new Date() },
    },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      manicurist: {
        include: { user: { select: { id: true, name: true } } },
      },
      service: { select: { id: true, name: true, duration: true } },
    },
    orderBy: { startAt: "asc" },
    take: 5,
  });

  return appointments as AppointmentWithRelations[];
}

// ─── Exportaciones ─────────────────────────────────────────────────────────────

export {
  handleWhatsAppMessage,
  type BotResponse,
  type BotOptions,
};
