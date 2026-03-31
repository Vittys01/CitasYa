/**
 * Programación de notificaciones sin Redis: confirmaciones inmediatas y
 * recordatorios con setTimeout. Solo válido con un solo proceso Node (p. ej. un VPS).
 * Tras reinicio del servidor, reconcileReminders() vuelve a programar lo pendiente.
 */

import { processNotification } from "@/services/notification.service";

const reminderTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Cancela el recordatorio programado para una cita (reagendar / cancelar). */
export function cancelScheduledReminder(appointmentId: string): void {
  const t = reminderTimers.get(appointmentId);
  if (t) {
    clearTimeout(t);
    reminderTimers.delete(appointmentId);
  }
}

/**
 * Si la cita está más de 24 h → recordatorio 24 h antes.
 * Si está entre 1 h y 24 h → recordatorio 1 h antes.
 * Si falta menos de 1 h → no programa.
 */
export function scheduleReminder(appointmentId: string, startAt: Date): void {
  const now = Date.now();
  const msUntil = startAt.getTime() - now;
  const h24 = 24 * 60 * 60 * 1000;
  const h1 = 1 * 60 * 60 * 1000;

  const reminderBefore = msUntil <= h24 ? h1 : h24;
  const delay = msUntil - reminderBefore;

  if (delay <= 0) return;

  cancelScheduledReminder(appointmentId);

  const t = setTimeout(() => {
    reminderTimers.delete(appointmentId);
    void processNotification(appointmentId, "REMINDER_24H").catch((err) =>
      console.error("[notifications-scheduler] REMINDER_24H", err)
    );
  }, delay);

  reminderTimers.set(appointmentId, t);
}

/** Confirmación por WhatsApp justo después de crear el turno (no bloquea la respuesta HTTP). */
export function enqueueConfirmation(appointmentId: string): void {
  setImmediate(() => {
    void processNotification(appointmentId, "CONFIRMATION").catch((err) =>
      console.error("[notifications-scheduler] CONFIRMATION", err)
    );
  });
}
