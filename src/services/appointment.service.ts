/**
 * Appointment Service — core business logic.
 *
 * Responsibilities:
 *   - Validate availability (no double-booking, respect schedules & blocks)
 *   - Create / update / cancel appointments
 *   - Enqueue WhatsApp notifications via BullMQ
 */

import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { prisma } from "@/lib/db";
import { calcEndTime, intervalsOverlap } from "@/lib/utils";
import {
  enqueueConfirmation,
  enqueueCancellation,
  scheduleReminder,
} from "@/lib/queue";
import type {
  CreateAppointmentInput,
  UpdateAppointmentInput,
  AppointmentWithRelations,
} from "@/types";
import type { AppointmentStatus } from "@prisma/client";

// ─── Availability check ───────────────────────────────────────────────────────

export async function isSlotAvailable(
  manicuristId: string,
  startAt: Date,
  endAt: Date,
  excludeAppointmentId?: string
): Promise<boolean> {
  // 1. Check the manicurist has a schedule for that day
  const dayOfWeek = startAt.getDay();
  const schedule = await prisma.schedule.findUnique({
    where: { manicuristId_dayOfWeek: { manicuristId, dayOfWeek } },
  });

  if (!schedule || !schedule.isActive) return false;

  const [schedStart, schedEnd] = [schedule.startTime, schedule.endTime].map(
    (t) => {
      const [h, m] = t.split(":").map(Number);
      const d = new Date(startAt);
      d.setHours(h, m, 0, 0);
      return d;
    }
  );

  if (startAt < schedStart || endAt > schedEnd) return false;

  // 2. Check for blocked times
  const blocked = await prisma.blockedTime.findFirst({
    where: {
      manicuristId,
      startAt: { lte: endAt },
      endAt: { gte: startAt },
    },
  });
  if (blocked) return false;

  // 3. Check existing appointments
  const conflicting = await prisma.appointment.findFirst({
    where: {
      manicuristId,
      id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
      status: { in: ["PENDING", "CONFIRMED"] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
  });

  return !conflicting;
}

/** Returns the client's other (non-cancelled) appointment overlapping [startAt, endAt], or null. */
export async function getClientOverlappingAppointment(
  clientId: string,
  startAt: Date,
  endAt: Date,
  excludeAppointmentId?: string
) {
  return prisma.appointment.findFirst({
    where: {
      clientId,
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      status: { in: ["PENDING", "CONFIRMED"] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
  });
}

/** True if the client has another (non-cancelled) appointment overlapping [startAt, endAt]. */
export async function clientHasOverlappingAppointment(
  clientId: string,
  startAt: Date,
  endAt: Date,
  excludeAppointmentId?: string
): Promise<boolean> {
  const conflicting = await getClientOverlappingAppointment(
    clientId,
    startAt,
    endAt,
    excludeAppointmentId
  );
  return !!conflicting;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createAppointment(
  input: CreateAppointmentInput
): Promise<AppointmentWithRelations> {
  const service = await prisma.service.findUniqueOrThrow({
    where: { id: input.serviceId },
  });

  const startAt = new Date(input.startAt);
  const endAt = calcEndTime(startAt, service.duration);

  const available = await isSlotAvailable(input.manicuristId, startAt, endAt);
  if (!available) {
    throw new Error("El horario seleccionado no está disponible.");
  }

  const existing = await getClientOverlappingAppointment(
    input.clientId,
    startAt,
    endAt
  );
  if (existing) {
    const range = `${format(existing.startAt, "d/M HH:mm", { locale: es })} – ${format(existing.endAt, "HH:mm", { locale: es })}`;
    throw new Error(`El cliente ya tiene un turno en ese horario (${range}). Elegí otro horario o revisá el calendario.`);
  }

  const appointment = await prisma.appointment.create({
    data: {
      businessId: service.businessId,
      clientId: input.clientId,
      manicuristId: input.manicuristId,
      serviceId: input.serviceId,
      startAt,
      endAt,
      price: service.price,
      notes: input.notes,
      status: "PENDING",
    },
    include: appointmentInclude,
  });

  // Fire-and-forget queue jobs (don't block response)
  void enqueueConfirmation(appointment.id);
  void scheduleReminder(appointment.id, startAt);

  return appointment as AppointmentWithRelations;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateAppointment(
  id: string,
  input: UpdateAppointmentInput
): Promise<AppointmentWithRelations> {
  const existing = await prisma.appointment.findUniqueOrThrow({ where: { id } });

  let startAt = existing.startAt;
  let endAt = existing.endAt;

  if (input.startAt || input.serviceId) {
    const serviceId = input.serviceId ?? existing.serviceId;
    const service = await prisma.service.findUniqueOrThrow({ where: { id: serviceId } });
    startAt = input.startAt ? new Date(input.startAt) : existing.startAt;
    endAt = calcEndTime(startAt, service.duration);

    const manicuristId = input.manicuristId ?? existing.manicuristId;
    const available = await isSlotAvailable(manicuristId, startAt, endAt, id);
    if (!available) throw new Error("El nuevo horario no está disponible.");

    const other = await getClientOverlappingAppointment(
      existing.clientId,
      startAt,
      endAt,
      id
    );
    if (other) {
      const range = `${format(other.startAt, "d/M HH:mm", { locale: es })} – ${format(other.endAt, "HH:mm", { locale: es })}`;
      throw new Error(`El cliente ya tiene un turno en ese horario (${range}). Elegí otro horario o revisá el calendario.`);
    }
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      ...(input.status && { status: input.status }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.manicuristId && { manicuristId: input.manicuristId }),
      ...(input.serviceId && { serviceId: input.serviceId }),
      ...(input.startAt && { startAt, endAt }),
    },
    include: appointmentInclude,
  });

  // If cancelled, enqueue cancellation message
  if (input.status === "CANCELLED") {
    void enqueueCancellation(id);
  }

  return updated as AppointmentWithRelations;
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

export async function cancelAppointment(id: string): Promise<void> {
  await prisma.appointment.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  void enqueueCancellation(id);
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getAppointmentsByDate(
  date: Date,
  options?: { manicuristId?: string; businessId?: string }
): Promise<AppointmentWithRelations[]> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const rows = await prisma.appointment.findMany({
    where: {
      startAt: { gte: start, lte: end },
      ...(options?.businessId ? { businessId: options.businessId } : {}),
      ...(options?.manicuristId ? { manicuristId: options.manicuristId } : {}),
    },
    include: appointmentInclude,
    orderBy: { startAt: "asc" },
  });

  return rows as AppointmentWithRelations[];
}

export async function getAppointmentsByWeek(
  weekStart: Date,
  options?: { manicuristId?: string; businessId?: string }
): Promise<AppointmentWithRelations[]> {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 7);

  const rows = await prisma.appointment.findMany({
    where: {
      startAt: { gte: weekStart, lt: end },
      ...(options?.businessId ? { businessId: options.businessId } : {}),
      ...(options?.manicuristId ? { manicuristId: options.manicuristId } : {}),
    },
    include: appointmentInclude,
    orderBy: { startAt: "asc" },
  });

  return rows as AppointmentWithRelations[];
}

export async function getAvailableSlots(
  manicuristId: string,
  date: Date,
  serviceDuration: number
): Promise<{ start: Date; end: Date }[]> {
  const dayOfWeek = date.getDay();
  const schedule = await prisma.schedule.findUnique({
    where: { manicuristId_dayOfWeek: { manicuristId, dayOfWeek } },
  });

  if (!schedule || !schedule.isActive) return [];

  const [sh, sm] = schedule.startTime.split(":").map(Number);
  const [eh, em] = schedule.endTime.split(":").map(Number);

  const schedStart = new Date(date);
  schedStart.setHours(sh, sm, 0, 0);
  const schedEnd = new Date(date);
  schedEnd.setHours(eh, em, 0, 0);

  // Existing booked intervals
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const existingAppts = await prisma.appointment.findMany({
    where: {
      manicuristId,
      status: { in: ["PENDING", "CONFIRMED"] },
      startAt: { gte: dayStart, lte: dayEnd },
    },
    select: { startAt: true, endAt: true },
  });

  const blockedTimes = await prisma.blockedTime.findMany({
    where: {
      manicuristId,
      startAt: { lte: dayEnd },
      endAt: { gte: dayStart },
    },
    select: { startAt: true, endAt: true },
  });

  const busyIntervals = [
    ...existingAppts.map((a) => ({ start: a.startAt, end: a.endAt })),
    ...blockedTimes.map((b) => ({ start: b.startAt, end: b.endAt })),
  ];

  // Generate slots every 15 minutes
  const slots: { start: Date; end: Date }[] = [];
  let cursor = new Date(schedStart);

  while (cursor < schedEnd) {
    const slotEnd = calcEndTime(cursor, serviceDuration);
    if (slotEnd > schedEnd) break;

    const slotInterval = { start: new Date(cursor), end: slotEnd };
    const blocked = busyIntervals.some((b) => intervalsOverlap(slotInterval, b));

    if (!blocked) slots.push(slotInterval);

    cursor = new Date(cursor.getTime() + 15 * 60 * 1000);
  }

  return slots;
}

/** Next N available slots from now (no past). If manicuristIds is empty, uses all active manicurists (optionally for businessId). */
export async function getNextAvailableSlots(
  manicuristIds: string[],
  serviceDuration: number,
  limit: number,
  businessId?: string
): Promise<{ start: Date; end: Date; manicuristId: string }[]> {
  const now = new Date();
  const mins = now.getMinutes();
  const roundedMins = Math.ceil(mins / 15) * 15;
  const from = new Date(now);
  from.setMinutes(roundedMins === 60 ? 0 : roundedMins, 0, 0);
  if (roundedMins === 60) from.setHours(from.getHours() + 1, 0, 0, 0);
  if (from <= now) from.setTime(from.getTime() + 15 * 60 * 1000);

  const ids =
    manicuristIds.length > 0
      ? manicuristIds
      : (await prisma.manicurist.findMany({
          where: { isActive: true, ...(businessId ? { businessId } : {}) },
          select: { id: true },
        })).map((m) => m.id);

  const collected: { start: Date; end: Date; manicuristId: string }[] = [];
  const maxDays = 14;

  for (let d = 0; d < maxDays; d++) {
    const date = addDays(now, d);
    for (const manicuristId of ids) {
      const daySlots = await getAvailableSlots(manicuristId, date, serviceDuration);
      for (const slot of daySlots) {
        if (slot.start >= from) collected.push({ ...slot, manicuristId });
      }
    }
  }

  collected.sort((a, b) => a.start.getTime() - b.start.getTime());
  return collected.slice(0, limit);
}

// ─── Auto-complete ────────────────────────────────────────────────────────────

/**
 * Marks any PENDING or CONFIRMED appointment whose endAt is in the past as COMPLETED.
 * Called periodically by the worker (every 60 s).
 * Returns the number of rows updated.
 */
export async function autoCompleteExpiredAppointments(): Promise<number> {
  const result = await prisma.appointment.updateMany({
    where: {
      status: { in: ["PENDING", "CONFIRMED"] },
      endAt: { lt: new Date() },
    },
    data: { status: "COMPLETED" },
  });
  return result.count;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

const appointmentInclude = {
  client: { select: { id: true, name: true, phone: true, email: true } },
  manicurist: {
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  },
  service: { select: { id: true, name: true, duration: true, color: true } },
} as const;
