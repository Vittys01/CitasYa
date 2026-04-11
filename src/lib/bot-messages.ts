/**
 * WhatsApp Bot Message Templates
 *
 * Plantillas de mensajes para el bot de agendado por WhatsApp
 */

import type { ManicuristWithUser, Service, AppointmentWithRelations } from "@/types";
import { formatDate, formatTime, toCanaryTimezone } from "./utils";

// ─── Tipos ──────────────────────────────────────────────────────────────────────

export interface BotMenuOptions {
  businessName: string;
}

export interface BotManicuristOptions {
  manicurists: ManicuristWithUser[];
}

export interface BotServiceOptions {
  services: Service[];
}

export interface BotDateOptions {
  todayDate: Date;
}

export interface BotSlotOptions {
  slots: { start: Date; end: Date }[];
  showDate?: boolean;
}

export interface BotConfirmationOptions {
  appointment: AppointmentWithRelations;
}

export interface BotAppointmentListOptions {
  appointments: AppointmentWithRelations[];
  clientName: string;
}

export interface BotHelpOptions {
  businessName?: string;
}

// ─── Mensajes del Menú Principal ────────────────────────────────────────────────

export function buildMenuMessage(options: BotMenuOptions): string {
  const { businessName } = options;
  return `¡Hola! 👋 Soy el asistente de agendado automático de ${businessName}.

Podés reservar tu cita por aquí.

Elegí una opción:
1️⃣ Agendar cita
2️⃣ Consultar mis citas
3️⃣ Cancelar cita

Escribí MENU en cualquier momento para volver a este menú.`;
}

export function buildMenuShort(): string {
  return `¡Claro! 😊

¿Qué deseas hacer?

• Agendar cita 💅
• Consultar disponibilidad 📅
• Ver mis citas 📝

Simplemente escribí lo que necesitas o elegí una opción.

Si necesitas más ayuda, escribí AYUDA.`;
}

// ─── Mensajes de Agendado ──────────────────────────────────────────────────────

export function buildBookingIntro(): string {
  return `📝 Agendando cita...`;
}

export function buildManicuristSelectionMessage(options: BotManicuristOptions): string {
  const { manicurists } = options;

  if (manicurists.length === 0) {
    return `❌ No hay manicuristas disponibles en este momento.
Por favor, contactá directamente al negocio.`;
  }

  let message = `1️⃣ Seleccioná tu manicurista:\n\n`;
  manicurists.forEach((manicurist, index) => {
    message += `${index + 1}. ${manicurist.user.name} - 💅 Uñas\n`;
  });
  message += `\nEscribí el número o el nombre de la manicurista.`;

  return message;
}

export function buildManicuristConfirmedMessage(manicuristName: string): string {
  return `✅ Seleccionaste: ${manicuristName}`;
}

export function buildServiceSelectionMessage(options: BotServiceOptions): string {
  const { services } = options;

  if (services.length === 0) {
    return `❌ No hay servicios disponibles en este momento.
Por favor, contactá directamente al negocio.`;
  }

  let message = `2️⃣ Seleccioná el servicio:\n\n`;
  services.forEach((service, index) => {
    const price = Number(service.price).toFixed(0);
    message += `${index + 1}. ${service.name} - ${service.duration}min - $${price}\n`;
  });
  message += `\nEscribí el número o el nombre del servicio.`;

  return message;
}

export function buildServiceConfirmedMessage(serviceName: string, duration: number): string {
  return `✅ Seleccionaste: ${serviceName} (${duration}min)`;
}

export function buildDateSelectionMessage(): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayFormatted = formatDate(today);
  const tomorrowFormatted = formatDate(tomorrow);

  return `3️⃣ Seleccioná la fecha:

1️⃣ Hoy (${todayFormatted})
2️⃣ Mañana (${tomorrowFormatted})
3️⃣ Próximos 7 días
4️⃣ Elegir otra fecha (día/mes)

Escribí el número de tu elección.`;
}

export function buildDateConfirmedMessage(date: Date): string {
  const formatted = formatDate(date);
  return `✅ Seleccionaste: ${formatted}`;
}

export function buildCustomDateMessage(): string {
  return `📅 Escribí la fecha que preferís en formato día/mes (ej: 15/04).`;
}

export function buildInvalidDateMessage(): string {
  return `❌ Fecha no válida.
Escribí la fecha en formato día/mes (ej: 15/04) o volvé al menú principal con MENU.`;
}

export function buildPastDateMessage(): string {
  return `❌ Esa fecha ya pasó. Elegí una fecha futura.`;
}

export function buildSlotSelectionMessage(options: BotSlotOptions): string {
  const { slots, showDate = true } = options;

  if (slots.length === 0) {
    return `❌ No hay horarios disponibles esa fecha.
Elegí otra fecha o escribí MENU para volver.`;
  }

  let message = `4️⃣ Horarios disponibles${showDate ? "" : " ese día"}:\n\n`;
  slots.forEach((slot, index) => {
    const start = formatTime(toCanaryTimezone(slot.start));
    const end = formatTime(toCanaryTimezone(slot.end));
    message += `${index + 1}. ${start} - ${end}\n`;
  });
  message += `\nEscribí el número de tu elección.`;

  return message;
}

export function buildSlotConfirmedMessage(slot: { start: Date; end: Date }): string {
  const start = formatTime(toCanaryTimezone(slot.start));
  const end = formatTime(toCanaryTimezone(slot.end));
  return `✅ Seleccionaste: ${start} - ${end}`;
}

export function buildInvalidSlotMessage(): string {
  return `❌ Opción no válida. Elegí un número de la lista.`;
}

export function buildSlotTakenMessage(): string {
  return `❌ Ese horario ya fue reservado. Elegí otro horario de la lista.`;
}

// ─── Mensajes de Confirmación ─────────────────────────────────────────────────

export function buildConfirmationMessage(options: BotConfirmationOptions): string {
  const { appointment } = options;
  const date = formatDate(toCanaryTimezone(appointment.startAt));
  const startTime = formatTime(toCanaryTimezone(appointment.startAt));
  const endTime = formatTime(toCanaryTimezone(appointment.endAt));
  const manicuristName = appointment.manicurist.user.name;
  const price = Number(appointment.price).toFixed(0);

  return `✅ CITA CONFIRMADA

📅 Fecha: ${date}
⏰ Horario: ${startTime} - ${endTime}
💅 Manicurista: ${manicuristName}
💰 Total: $${price}

Te enviaré un recordatorio 24h antes.
Gracias por tu reserva! 👋`;
}

// ─── Mensajes de Consulta de Citas ─────────────────────────────────────────────

export function buildAppointmentListMessage(options: BotAppointmentListOptions): string {
  const { appointments, clientName } = options;

  if (appointments.length === 0) {
    return `Hola ${clientName} 👋

No tenés citas agendadas en este momento.

¿Te gustaría agendar una nueva cita? Escribe AGENDAR.`;
  }

  let message = `Hola ${clientName} 👋

📅 Tus próximas citas:\n\n`;
  appointments.forEach((apt, index) => {
    const date = formatDate(toCanaryTimezone(apt.startAt));
    const time = formatTime(toCanaryTimezone(apt.startAt));
    const manicuristName = apt.manicurist.user.name;
    const serviceName = apt.service.name;
    const price = Number(apt.price).toFixed(0);
    const statusEmoji = apt.status === "CONFIRMED" ? "✅" : "⏳";

    message += `${statusEmoji} ${index + 1}. ${date} ${time} - ${serviceName}
   con ${manicuristName} - $${price}\n\n`;
  });

  message += `Para cancelar una cita, escribí CANCELAR seguido del número.
Ej: CANCELAR 1`;

  return message;
}

// ─── Mensajes de Cancelación ────────────────────────────────────────────────────

export function buildCancellationIntro(): string {
  return `🗑️ Cancelando cita...`;
}

export function buildCancelSelectionMessage(appointments: AppointmentWithRelations[]): string {
  let message = `Seleccioná la cita que querés cancelar:\n\n`;
  appointments.forEach((apt, index) => {
    const date = formatDate(toCanaryTimezone(apt.startAt));
    const time = formatTime(toCanaryTimezone(apt.startAt));
    const serviceName = apt.service.name;
    const manicuristName = apt.manicurist.user.name;

    message += `${index + 1}. ${date} ${time} - ${serviceName}
   con ${manicuristName}\n\n`;
  });

  return message;
}

export function buildCancellationSuccessMessage(): string {
  return `✅ Cita cancelada correctamente.

Si necesitás agendar una nueva cita, escribí AGENDAR.`;
}

export function buildCancellationNotFoundError(): string {
  return `❌ No se encontró esa cita.
Escribí "CITAS" para ver tus citas activas.`;
}

export function buildInvalidCancelInputMessage(): string {
  return `❌ Entrada no válida.
Escribí CANCELAR seguido del número de cita.
Ej: CANCELAR 1`;
}

// ─── Mensajes de Ayuda ──────────────────────────────────────────────────────────

export function buildHelpMessage(options?: BotHelpOptions): string {
  const { businessName = "nuestro negocio" } = options || {};

  return `🆘 COMANDOS DISPONIBLES:

• MENU - Vuelve al menú principal
• AGENDAR - Inicia el flujo para agendar una cita
• CITAS - Muestra tus próximas citas
• CANCELAR [número] - Cancela una cita específica
  (Ej: CANCELAR 1)
• AYUDA - Muestra esta ayuda

💡 Durante el flujo de agendado:
• Escribí MENU para reiniciar
• Seleccioná opciones por número o nombre
• Las fechas deben ser futuras

Si necesitás asistencia especial, podés contactar directamente al equipo de ${businessName}.`;
}

// ─── Mensajes de Cliente ─────────────────────────────────────────────────────

export function buildWelcomeForNewClient(): string {
  return `¡Hola! 👋 Soy tu asistente de agendado.

¿Qué deseas hacer hoy?

• Agendar una cita 💅
• Consultar disponibilidad 📅
• Ver mis citas 📝

Para comenzar, simplemente escribí tu preferencia (ej: "cita para mañana con Paola") o elegí una opción.

Si necesitás ayuda en cualquier momento, escribí AYUDA.`;
}

export function buildWelcomeForExistingClient(name: string): string {
  return `¡Hola ${name}! 👋 Bueno verte de nuevo.

¿Qué deseas hacer hoy?

• Agendar una cita 💅
• Ver mis citas 📝
• Cancelar una cita ❌

Para comenzar, escribí tu preferencia (ej: "cita mañana") o seleccioná una opción.

Si necesitás ayuda, escribí AYUDA.`;
}

// ─── Mensajes de Error ───────────────────────────────────────────────────────

export function buildGenericErrorMessage(): string {
  return `❌ Ocurrió un error al procesar tu solicitud.

Por favor, intentá nuevamente o escribí MENU para volver al inicio.

Si el problema persiste, contactá directamente al negocio.`;
}

export function buildInvalidOptionMessage(): string {
  return `❌ Opción no válida.

Por favor, seleccioná un número de la lista o escribí MENU para volver al inicio.`;
}

export function buildSessionExpiredMessage(): string {
  return `⏱️ Tu sesión expiró.

Por razones de seguridad, reiniciamos el flujo. Elegí una opción:

1️⃣ Agendar cita
2️⃣ Consultar mis citas
3️⃣ Cancelar cita`;
}

export function buildBusinessNotAvailableMessage(): string {
  return `❌ El negocio no está disponible en este momento.

Por favor, contactá más tarde o escribí MENU para volver.`;
}

// ─── Mensajes de Disponibilidad ───────────────────────────────────────────────

export function buildAvailabilityMessage(
  available: boolean,
  date?: Date
): string {
  if (!available) {
    return `❌ No hay disponibilidad${date ? ` para el ${formatDate(date)}` : ""}.
Elegí otra fecha o escribí MENU para volver.`;
  }

  return `✅ Hay disponibilidad. Seleccioná una opción de la lista.`;
}

export function buildNoManicuristsMessage(): string {
  return `❌ No hay manicuristas disponibles actualmente.

Por favor, contactá directamente al negocio.`;
}

export function buildNoServicesMessage(): string {
  return `❌ No hay servicios disponibles actualmente.

Por favor, contactá directamente al negocio.`;
}

// ─── Mensajes de Información ────────────────────────────────────────────────

export function buildProcessingMessage(): string {
  return `⏳ Procesando tu solicitud...`;
}

export function buildDoneMessage(): string {
  return `✅ Listo! ¿Necesitás algo más?

1️⃣ Agendar otra cita
2️⃣ Consultar mis citas
3️⃣ Cancelar cita
4️⃣ MENU principal`;
}

// ─── Utilidades de Formato para Bot ───────────────────────────────────────────

export function formatBotMessage(message: string): string {
  return message;
}

export function formatErrorWithHelp(error: string): string {
  return `❌ ${error}\n\nEscribí AYUDA para ver los comandos disponibles.`;
}
