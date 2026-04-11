/**
 * WhatsApp Bot Service (Twilio WhatsApp)
 *
 * Servicio que gestiona el bot de agendado por WhatsApp usando Twilio WhatsApp.
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
import {
  findBestMatch,
  calculateSimilarity,
} from "@/lib/nlp-bot";
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
import {
  detectIntent,
  extractDates,
  extractTimes,
  extractEntities,
  analyzeSelection,
  processComplexQuery,
  type NLPIntent,
  type NLPEntities,
  ConversationContext,
} from "@/lib/nlp-bot";
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

export interface TwilioInboundForm {
  MessageSid: string;
  From: string;
  To: string;
  Body?: string;
  NumMedia?: string;
  MediaContentType0?: string;
  MediaUrl0?: string;
}

export interface BotOptions {
  businessId: string;
  phoneE164: string;
  text: string;
}

// ─── Funciones Principales ─────────────────────────────────────────────────────

/**
 * Punto de entrada principal para procesar mensajes del bot (Twilio)
 */
async function handleTwilioWhatsAppMessage(
  businessId: string,
  phoneE164: string,
  text: string
): Promise<void> {
  console.log(
    `[WhatsApp Bot - Twilio] Processing message from ${phoneE164} for business ${businessId}: "${text}"`
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
      `[WhatsApp Bot - Twilio] Response sent to ${phoneE164}. Next step: ${response.nextStep || "idle"}`
    );
  } catch (error) {
    console.error("[WhatsApp Bot - Twilio] Error handling message:", error);

    try {
      const errorMessage = buildGenericErrorMessage();
      await sendMessage(businessId, phoneE164, errorMessage);
    } catch (sendError) {
      console.error("[WhatsApp Bot - Twilio] Error sending error message:", sendError);
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
  if (command && canProcessGlobalCommand(session.step as BotStep)) {
    return await processCommand(session, command, text, sessionData);
  }

  // Si no hay comando y estamos en idle, mostrar menú
  if (session.step === "idle" && !command) {
    return await handleIdleState(session, sessionData, text);
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
      // Si ya hay datos de cita, intentar continuar desde donde se quedó
      if (data.manicuristId || data.serviceId) {
        return await continueBookingFlow(session, data);
      }
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
        nextStep: session.step as BotStep, // No cambiar el estado
        shouldEndFlow: false,
      };

    case "DISPONIBILIDAD":
      return await handleAvailabilityQuery(session, data);

    default:
      return {
        message: buildInvalidOptionMessage(),
        nextStep: session.step as BotStep,
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
  // Detectar intención de cambio o retroceso
  const intent = detectIntent(text);

  if (intent.type === "back" || intent.type === "menu") {
    return await goToPreviousStep(session, data);
  }

  if (intent.type === "change") {
    return await handleChangeRequest(session, data, text);
  }

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
  data: BotSessionData,
  text: string
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

  // Detectar intención de agendado en lenguaje natural
  const intent = detectIntent(text); // Note: 'text' is not available here, need to pass it

  // Si hay intención de agendar y se detectaron entidades, iniciar el flujo
  if (intent.type === "booking") {
    const entities = extractEntities(text);
    const hasBookingEntities =
      (entities.dates && entities.dates.length > 0) ||
      (entities.manicurists && entities.manicurists.length > 0) ||
      (entities.services && entities.services.length > 0) ||
      (entities.times && entities.times.length > 0);

    if (hasBookingEntities) {
      return await startBookingFlowWithEntities(session, updatedData, entities);
    }
  }

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

async function startBookingFlowWithEntities(
  session: WhatsAppBotSession,
  data: BotSessionData,
  entities: NLPEntities
): Promise<BotResponse> {
  const manicurists = await getAvailableManicurists(session.businessId);
  const services = await getAvailableServices(session.businessId);

  if (manicurists.length === 0) {
    return {
      message: buildNoManicuristsMessage(),
      nextStep: "idle",
    };
  }

  const updatedData = clearTemporarySessionData(data);

  // Intentar prellenar manicurista si se detectó
  if (entities.manicurists && entities.manicurists.length > 0) {
    const manicuristNames = manicurists.map((m) => m.user.name);
    const bestMatch = findBestMatch(entities.manicurists[0], manicuristNames, 0.6);

    if (bestMatch.matched) {
      const selected = manicurists.find((m) => m.user.name === bestMatch.value);
      if (selected) {
        updatedData.manicuristId = selected.id;
        updatedData.manicuristName = selected.user.name;
      }
    }
  }

  // Intentar prellenar servicio si se detectó
  if (entities.services && entities.services.length > 0) {
    const serviceNames = services.map((s) => s.name);
    const bestMatch = findBestMatch(entities.services[0], serviceNames, 0.6);

    if (bestMatch.matched) {
      const selected = services.find((s) => s.name === bestMatch.value);
      if (selected) {
        updatedData.serviceId = selected.id;
        updatedData.serviceName = selected.name;
        updatedData.serviceDuration = selected.duration;
      }
    }
  }

  // Intentar prellenar fecha si se detectó
  if (entities.dates && entities.dates.length > 0) {
    const selectedDate = entities.dates[0];
    if (isValidFutureDate(selectedDate)) {
      updatedData.selectedDate = selectedDate.toISOString();
    }
  }

  // Actualizar sesión con los datos prellenados
  await prisma.whatsAppBotSession.update({
    where: { id: session.id },
    data: { data: updatedData },
  });

  // Determinar el siguiente paso basado en qué ya tenemos
  if (updatedData.manicuristId && updatedData.serviceId && updatedData.selectedDate) {
    // Tenemos todo, mostrar horarios disponibles
    const date = parseISO(updatedData.selectedDate);
    if (updatedData.serviceDuration) {
      return await showAvailableSlots(session, updatedData, date);
    }
  }

  if (updatedData.manicuristId && updatedData.serviceId) {
    // Tenemos manicurista y servicio, pedir fecha
    return {
      message: `${buildServiceConfirmedMessage(updatedData.serviceName!, updatedData.serviceDuration!)}\n\n${buildDateSelectionMessage()}`,
      nextStep: "date",
    };
  }

  if (updatedData.manicuristId) {
    // Solo tenemos manicurista, mostrar servicios
    return {
      message: `${buildManicuristConfirmedMessage(updatedData.manicuristName!)}\n\n${buildServiceSelectionMessage({ services })}`,
      nextStep: "service",
    };
  }

  // No tenemos nada prellenado, iniciar desde el principio
  return {
    message: `${buildBookingIntro()}\n\n${buildManicuristSelectionMessage({ manicurists })}`,
    nextStep: "manicurist",
  };
}

async function handleManicuristSelection(
  session: WhatsAppBotSession,
  text: string,
  data: BotSessionData
): Promise<BotResponse> {
  const manicurists = await getAvailableManicurists(session.businessId);

  // Intentar coincidencia numérica exacta primero
  const numberMatch = text.match(/^\d+$/);
  if (numberMatch) {
    const num = parseInt(numberMatch[0], 10);
    if (num >= 1 && num <= manicurists.length) {
      const selected = manicurists[num - 1];
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
  }

  // Intentar coincidencia fuzzy por nombre
  const manicuristNames = manicurists.map((m) => m.user.name);
  const bestMatch = findBestMatch(text, manicuristNames, 0.6);

  if (bestMatch.matched) {
    const selectedIndex = manicuristNames.indexOf(bestMatch.value as string);
    const selected = manicurists[selectedIndex];
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

  return {
    message: buildInvalidOptionMessage(),
    nextStep: session.step as BotStep,
  };
}

async function handleServiceSelection(
  session: WhatsAppBotSession,
  text: string,
  data: BotSessionData
): Promise<BotResponse> {
  const services = await getAvailableServices(session.businessId);

  // Intentar coincidencia numérica exacta primero
  const numberMatch = text.match(/^\d+$/);
  if (numberMatch) {
    const num = parseInt(numberMatch[0], 10);
    if (num >= 1 && num <= services.length) {
      const selected = services[num - 1];
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
  }

  // Intentar coincidencia fuzzy por nombre
  const serviceNames = services.map((s) => s.name);
  const bestMatch = findBestMatch(text, serviceNames, 0.6);

  if (bestMatch.matched) {
    const selectedIndex = serviceNames.indexOf(bestMatch.value as string);
    const selected = services[selectedIndex];
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

  return {
    message: buildInvalidOptionMessage(),
    nextStep: session.step as BotStep,
  };
}

async function handleDateSelection(
  session: WhatsAppBotSession,
  text: string,
  data: BotSessionData
): Promise<BotResponse> {
  // Primero, intentar procesamiento de lenguaje natural
  const intent = detectIntent(text);
  const extractedDates = extractDates(text);

  // Si el usuario escribió una fecha específica en lenguaje natural
  if (intent.type === "booking" && extractedDates.length > 0) {
    const selectedDate = extractedDates[0];

    if (!isValidFutureDate(selectedDate)) {
      return {
        message: buildPastDateMessage(),
        nextStep: session.step as BotStep,
      };
    }

    const dateStr = selectedDate.toISOString();
    const updatedData = updateSessionData(data, { selectedDate: dateStr });
    await prisma.whatsAppBotSession.update({
      where: { id: session.id },
      data: { data: updatedData },
    });

    return await showAvailableSlots(session, updatedData, selectedDate);
  }

  // Fallback a selección numérica tradicional
  const selection = extractSelectionIndex(text);

  if (selection === null) {
    return {
      message: buildInvalidOptionMessage(),
      nextStep: session.step as BotStep,
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
        await prisma.whatsAppBotSession.update({
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
        nextStep: session.step as BotStep,
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
      nextStep: session.step as BotStep,
    };
  }

  if (!isValidFutureDate(parsedDate)) {
    return {
      message: buildPastDateMessage(),
      nextStep: session.step as BotStep,
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
      nextStep: session.step as BotStep,
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
      nextStep: session.step as BotStep,
    };
  }

  const appointmentToCancel = appointments[index - 1];

  await prisma.appointment.delete({
    where: { id: appointmentToCancel.id },
  });

  const cleanedData = clearTemporarySessionData(data);
  await prisma.whatsAppBotSession.update({
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
  await prisma.whatsAppBotSession.update({
    where: { id: session.id },
    data: { data: cleanedData, step: "idle" },
  });

  return {
    message: buildCancellationSuccessMessage(),
    nextStep: "idle",
    shouldEndFlow: true,
  };
}

// ─── Manejo de Navegación y Cambios ─────────────────────────────────

/**
 * Continúa el flujo de agendado desde donde se quedó
 */
async function continueBookingFlow(
  session: WhatsAppBotSession,
  data: BotSessionData
): Promise<BotResponse> {
  const updatedData = clearTemporarySessionData(data);

  await prisma.whatsAppBotSession.update({
    where: { id: session.id },
    data: { data: updatedData },
  });

  return await startBookingFlow(session, updatedData);
}

/**
 * Navega al paso anterior del flujo
 */
async function goToPreviousStep(
  session: WhatsAppBotSession,
  data: BotSessionData
): Promise<BotResponse> {
  const previousStep = getPreviousStep(session.step as BotStep);

  await prisma.whatsAppBotSession.update({
    where: { id: session.id },
    data: { step: previousStep },
  });

  let message = "";

  switch (previousStep) {
    case "idle":
      message = buildMenuShort();
      break;

    case "manicurist":
      message = "Volviendo a selección de manicurista...";
      break;

    case "service":
      message = "Volviendo a selección de servicio...";
      break;

    case "date":
      message = "Volviendo a selección de fecha...";
      break;

    case "slot":
      message = "Volviendo a selección de horario...";
      break;

    default:
      message = buildMenuShort();
  }

  // Si volvemos a un paso específico, mostrar las opciones correspondientes
  if (previousStep !== "idle") {
    const tempStep = session.step;
    session.step = previousStep;

    const response = await processFlowStep(session, "CONTINUE", data, null);

    // Restaurar el paso original temporalmente
    session.step = tempStep;

    return {
      message: `${message}\n\n${response.message}`,
      nextStep: previousStep,
    };
  }

  return {
    message,
    nextStep: previousStep,
  };
}

/**
 * Maneja solicitudes de cambio/modificación
 */
async function handleChangeRequest(
  session: WhatsAppBotSession,
  data: BotSessionData,
  text: string
): Promise<BotResponse> {
  // Analizar qué quiere cambiar el usuario
  const manicurists = await getAvailableManicurists(session.businessId);
  const services = await getAvailableServices(session.businessId);

  const manicuristNames = manicurists.map((m) => m.user.name);
  const serviceNames = services.map((s) => s.name);

  const manicuristMatch = findBestMatch(text, manicuristNames, 0.5);
  const serviceMatch = findBestMatch(text, serviceNames, 0.5);

  let message = "🔄 Entiendo que querés cambiar algo.\n\n";

  if (manicuristMatch.matched && serviceMatch.matched) {
    message += `Parece que querés cambiar tanto la manicurista como el servicio. ¿Es correcto?\n\n`;
    message += `Voy a reiniciar el flujo de agendado para que puedas seleccionar nuevamente.`;

    const cleanedData = clearTemporarySessionData(data);
    await prisma.whatsAppBotSession.update({
      where: { id: session.id },
      data: { data: cleanedData, step: "idle" },
    });

    return {
      message,
      nextStep: "idle",
      shouldEndFlow: true,
    };
  }

  if (manicuristMatch.matched) {
    message += `Querés cambiar la manicurista a: ${manicuristMatch.value}\n\n`;
    message += `¿Confirmás el cambio?`;

    const updatedData = updateSessionData(data, {
      manicuristId: manicurists.find((m) => m.user.name === manicuristMatch.value)?.id,
      manicuristName: manicuristMatch.value as string,
    });

    await prisma.whatsAppBotSession.update({
      where: { id: session.id },
      data: { data: updatedData, step: "service" },
    });

    return {
      message,
      nextStep: "service",
    };
  }

  if (serviceMatch.matched) {
    message += `Querés cambiar el servicio a: ${serviceMatch.value}\n\n`;
    message += `¿Confirmás el cambio?`;

    const updatedData = updateSessionData(data, {
      serviceId: services.find((s) => s.name === serviceMatch.value)?.id,
      serviceName: serviceMatch.value as string,
    });

    await prisma.whatsAppBotSession.update({
      where: { id: session.id },
      data: { data: updatedData, step: "date" },
    });

    return {
      message,
      nextStep: "date",
    };
  }

  message += "¿Qué querés cambiar exactamente?\n\n";
  message += "Escribí 'menú' para volver al inicio.";

  return {
    message,
    nextStep: session.step as BotStep,
  };
}

/**
 * Obtiene el paso anterior del flujo
 */
function getPreviousStep(currentStep: BotStep): BotStep {
  const stepHierarchy: Record<BotStep, number> = {
    idle: 0,
    manicurist: 1,
    service: 2,
    date: 3,
    custom_date: 3,
    slot: 4,
    consulting: 0,
    cancelling: 0,
  };

  const currentLevel = stepHierarchy[currentStep] || 0;
  const previousLevel = Math.max(0, currentLevel - 1);

  return (
    Object.entries(stepHierarchy).find(([_, level]) => level === previousLevel)?.[0] as BotStep || "idle"
  );
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
  await prisma.whatsAppBotSession.update({
    where: { id: session.id },
    data: {
      step: "idle",
      data: createEmptySessionData(),
    },
  });

  const message = buildSessionExpiredMessage();
  await sendMessage(session.businessId, session.phoneE164, message);

  console.log(
    `[WhatsApp Bot - Twilio] Session expired for ${session.phoneE164}, reset to idle`
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
    console.error("[WhatsApp Bot - Twilio] Error getting/creating session:", error);
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
    client = await prisma.client.create({
      data: {
        businessId,
        name: `Cliente ${normalisedPhone.slice(-4)}`,
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
  handleTwilioWhatsAppMessage,
};
