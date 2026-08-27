/**
 * Appointment Service — core business logic.
 *
 * Responsibilities:
 *   - Validate availability (no double-booking, respect schedules & blocks)
 *   - Create / update / cancel appointments
 *   - Programar WhatsApp (confirmación / recordatorio) sin Redis
 */

import { addDays, format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { prisma } from "@/lib/db";
import {
  calcEndTime,
  ceilToNextSlotMinute,
  intervalsOverlap,
  SCHEDULE_SLOT_MINUTES,
  now,
  toCanaryTimezone,
  formatTime,
  canaryDate,
  canaryDayBounds,
  getCanaryDateString,
} from "@/lib/utils";
import {
  enqueueConfirmation,
  scheduleReminder,
  cancelScheduledReminder,
} from "@/lib/notifications-scheduler";
import { processNotification } from "@/services/notification.service";
import { generateInvoiceFromAppointment } from "@/services/invoice.service";
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
  const dayOfWeek = toCanaryTimezone(startAt).getDay();
  const schedule = await prisma.schedule.findUnique({
    where: { manicuristId_dayOfWeek: { manicuristId, dayOfWeek } },
  });

  if (!schedule || !schedule.isActive) return false;

  const dateStr = format(toCanaryTimezone(startAt), "yyyy-MM-dd");
  const [schedStart, schedEnd] = [schedule.startTime, schedule.endTime].map(
    (t) => {
      const [h, m] = t.split(":").map(Number);
      return canaryDate(dateStr, h, m);
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
      status: { in: ["PENDING"] },
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
      status: { in: ["PENDING"] },
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
): Promise<AppointmentWithRelations[]> {
  const serviceItems = input.services?.length
    ? input.services
    : input.serviceId
      ? [{ serviceId: input.serviceId }]
      : [];

  if (serviceItems.length === 0) {
    throw new Error("Debe indicar al menos un servicio.");
  }

  const servicesData = await prisma.service.findMany({
    where: { id: { in: serviceItems.map((s) => s.serviceId) } },
  });
  const serviceMap = new Map(servicesData.map((s) => [s.id, s]));

  const firstServiceId = serviceItems[0].serviceId;
  const businessId = serviceMap.get(firstServiceId)?.businessId;
  if (!businessId) throw new Error("Servicio no encontrado.");

  const baseStartAt = new Date(input.startAt);
  const created: AppointmentWithRelations[] = [];
  /** IDs creados en este mismo lote: se excluyen del chequeo de solapamiento del cliente
   *  para permitir servicios simultáneos con distintas profesionales (ej. mani + pedi). */
  const batchIds: string[] = [];

  for (let i = 0; i < serviceItems.length; i++) {
    const item = serviceItems[i];
    const svc = serviceMap.get(item.serviceId);
    if (!svc) throw new Error(`Servicio ${item.serviceId} no encontrado.`);

    const dur = item.durationMinutes ?? svc.duration;
    const price = item.price != null && item.price >= 0 ? item.price : Number(svc.price);
    const manicuristId = item.manicuristId ?? input.manicuristId;

    if (!manicuristId) {
      throw new Error(`Indicá quién realiza "${svc.name}".`);
    }

    // Hora de inicio: explícita por línea → si no, la primera usa startAt global y el resto continúan secuencialmente
    const startAt = item.startAt
      ? new Date(item.startAt)
      : i === 0
        ? baseStartAt
        : calcEndTime(created[i - 1].endAt, 0);
    const endAt = calcEndTime(startAt, dur);

    const available = await isSlotAvailable(manicuristId, startAt, endAt);
    if (!available) {
      const timeStr = formatTime(toCanaryTimezone(startAt));
      throw new Error(`No hay disponibilidad para "${svc.name}" a las ${timeStr}.`);
    }

    const existing = await getClientOverlappingAppointment(
      input.clientId,
      startAt,
      endAt
    );
    if (existing && !batchIds.includes(existing.id)) {
      const range = `${format(toCanaryTimezone(existing.startAt), "d/M", { locale: es })} ${formatTime(toCanaryTimezone(existing.startAt))} – ${formatTime(toCanaryTimezone(existing.endAt))}`;
      throw new Error(`El cliente ya tiene un turno en ${range}. Revisá el calendario.`);
    }

    const appointment = await prisma.appointment.create({
      data: {
        businessId,
        clientId: input.clientId,
        manicuristId,
        serviceId: item.serviceId,
        startAt,
        endAt,
        price,
        notes: i === 0 ? input.notes : undefined,
        status: "CONFIRMED",
        services: {
          create: {
            serviceId: item.serviceId,
            manicuristId: item.manicuristId ?? null,
            durationMinutes: item.durationMinutes ?? null,
            price,
            sortOrder: 0,
          },
        },
      },
      include: appointmentInclude,
    });

    created.push(appointment as AppointmentWithRelations);
    batchIds.push(appointment.id);
  }

  // Enviar WhatsApp solo para el primer turno
  if (input.sendWhatsApp !== false && created.length > 0) {
    void enqueueConfirmation(created[0].id);
    void scheduleReminder(created[0].id, created[0].startAt);
  }

  return created;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateAppointment(
  id: string,
  input: UpdateAppointmentInput
): Promise<AppointmentWithRelations | null> {
  if (input.status === "COMPLETED") {
    cancelScheduledReminder(id);

    const completed = await prisma.appointment.update({
      where: { id },
      data: {
        status: "COMPLETED",
        ...(input.paymentMethod !== undefined && { paymentMethod: input.paymentMethod }),
      },
      include: appointmentInclude,
    });

    // Generate invoice only for Bizum / Datáfono (Efectivo = sin factura)
    if (input.paymentMethod === "BIZUM" || input.paymentMethod === "DATAFONO") {
      void generateInvoiceFromAppointment(id, { paymentMethod: input.paymentMethod }).catch((err) => {
        console.error(`[Invoice] Failed to generate for appointment ${id}:`, err);
      });
    }

    return completed as AppointmentWithRelations;
  }

  const existing = await prisma.appointment.findUniqueOrThrow({ where: { id } });

  // ── Formulario “editar”: reemplazar servicios + horario / cliente / precio ──
  if (input.services && input.services.length > 0) {
    const serviceItems = input.services;
    const servicesData = await prisma.service.findMany({
      where: { id: { in: serviceItems.map((s) => s.serviceId) } },
    });
    const serviceMap = new Map(servicesData.map((s) => [s.id, s]));

    let totalDuration = 0;
    let totalPrice = 0;
    const firstServiceId = serviceItems[0].serviceId;
    for (const item of serviceItems) {
      const svc = serviceMap.get(item.serviceId);
      if (!svc) throw new Error(`Servicio ${item.serviceId} no encontrado.`);
      const dur = item.durationMinutes ?? svc.duration;
      totalDuration += dur;
      const linePrice =
        item.price != null && item.price >= 0 ? item.price : Number(svc.price);
      totalPrice += linePrice;
    }

    const startAt = input.startAt ? new Date(input.startAt) : existing.startAt;
    const slotDuration =
      input.totalDurationMinutes != null && input.totalDurationMinutes >= 5
        ? input.totalDurationMinutes
        : totalDuration;
    const endAt = calcEndTime(startAt, slotDuration);
    // Derivar manicurista principal: input → existente → primer servicio con manicuristId
    const derivedManicuristId = serviceItems.find((s) => s.manicuristId)?.manicuristId;
    const manicuristId = input.manicuristId ?? derivedManicuristId ?? existing.manicuristId;
    const clientId = input.clientId ?? existing.clientId;
    const finalPrice = input.price != null && input.price >= 0 ? input.price : totalPrice;

    const available = await isSlotAvailable(manicuristId, startAt, endAt, id);
    if (!available) throw new Error("El horario seleccionado no está disponible.");

    const other = await getClientOverlappingAppointment(clientId, startAt, endAt, id);
    if (other) {
      const range = `${format(toCanaryTimezone(other.startAt), "d/M", { locale: es })} ${formatTime(toCanaryTimezone(other.startAt))} – ${formatTime(toCanaryTimezone(other.endAt))}`;
      throw new Error(`El cliente ya tiene un turno en ese horario (${range}). Elegí otro horario o revisá el calendario.`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.appointmentService.deleteMany({ where: { appointmentId: id } });
      for (let i = 0; i < serviceItems.length; i++) {
        const item = serviceItems[i];
        const svc = serviceMap.get(item.serviceId)!;
        const linePrice =
          item.price != null && item.price >= 0 ? item.price : Number(svc.price);
        await tx.appointmentService.create({
          data: {
            appointmentId: id,
            serviceId: item.serviceId,
            manicuristId: item.manicuristId ?? null,
            durationMinutes: item.durationMinutes ?? null,
            price: linePrice,
            sortOrder: i,
          },
        });
      }
      await tx.appointment.update({
        where: { id },
        data: {
          clientId,
          manicuristId,
          serviceId: firstServiceId,
          startAt,
          endAt,
          price: finalPrice,
          ...(input.notes !== undefined && { notes: input.notes }),
          ...(input.status && { status: input.status }),
        },
      });
    });

    const updated = await prisma.appointment.findUniqueOrThrow({
      where: { id },
      include: appointmentInclude,
    });

    if (updated.status !== "COMPLETED") {
      cancelScheduledReminder(id);
      if (input.sendWhatsApp !== false) {
        scheduleReminder(id, startAt);
      }
    }

    return updated as AppointmentWithRelations;
  }

  let startAt = existing.startAt;
  let endAt = existing.endAt;

  if (input.startAt || input.serviceId) {
    startAt = input.startAt ? new Date(input.startAt) : existing.startAt;
    const existingDuration = Math.round(
      (existing.endAt.getTime() - existing.startAt.getTime()) / 60000
    );
    if (input.serviceId) {
      const service = await prisma.service.findUniqueOrThrow({
        where: { id: input.serviceId },
      });
      endAt = calcEndTime(startAt, service.duration);
    } else {
      endAt = calcEndTime(startAt, existingDuration);
    }

    const manicuristId = input.manicuristId ?? existing.manicuristId;
    const available = await isSlotAvailable(manicuristId, startAt, endAt, id);
    if (!available) throw new Error("El nuevo horario no está disponible.");

    const overlapClientId = input.clientId ?? existing.clientId;
    const other = await getClientOverlappingAppointment(overlapClientId, startAt, endAt, id);
    if (other) {
      const range = `${format(toCanaryTimezone(other.startAt), "d/M", { locale: es })} ${formatTime(toCanaryTimezone(other.startAt))} – ${formatTime(toCanaryTimezone(other.endAt))}`;
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
      ...(input.clientId && { clientId: input.clientId }),
      ...(input.startAt && { startAt, endAt }),
      ...(input.price != null && input.price >= 0 && { price: input.price }),
    },
    include: appointmentInclude,
  });

  if (input.startAt && updated.status !== "COMPLETED") {
    cancelScheduledReminder(id);
    if (input.sendWhatsApp !== false) {
      scheduleReminder(id, startAt);
    }
  }

  return updated as AppointmentWithRelations;
}

// ─── Cancel (delete) ─────────────────────────────────────────────────────────

export async function cancelAppointment(id: string): Promise<void> {
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      client: true,
      service: true,
      manicurist: { include: { user: true } },
    },
  });
  if (!appointment) return;

  cancelScheduledReminder(id);

  await processNotification(id, "CANCELLATION");
  await prisma.appointment.delete({ where: { id } });
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getAppointmentsByDate(
  date: Date,
  options?: { manicuristId?: string; businessId?: string }
): Promise<AppointmentWithRelations[]> {
  const dateStr = format(toCanaryTimezone(date), "yyyy-MM-dd");
  const { start, end } = canaryDayBounds(dateStr);

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
  const wsStr = getCanaryDateString(weekStart);
  const start = canaryDate(wsStr, 0, 0);
  const nextWeekTs = weekStart.getTime() + 7 * 24 * 60 * 60 * 1000;
  const nwsStr = getCanaryDateString(new Date(nextWeekTs));
  const end = canaryDate(nwsStr, 0, 0);

  const rows = await prisma.appointment.findMany({
    where: {
      startAt: { gte: start, lt: end },
      ...(options?.businessId ? { businessId: options.businessId } : {}),
      ...(options?.manicuristId ? { manicuristId: options.manicuristId } : {}),
    },
    include: appointmentInclude,
    orderBy: { startAt: "asc" },
  });

  return rows as AppointmentWithRelations[];
}

/** Citas con `startAt` en el mes calendario de `month` (cualquier día 1–último). */
export async function getAppointmentsByMonth(
  month: Date,
  options?: { manicuristId?: string; businessId?: string }
): Promise<AppointmentWithRelations[]> {
  const mStr = getCanaryDateString(month);
  const [y, m] = mStr.split("-").map(Number);
  const start = canaryDate(mStr, 0, 0);
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const nextMStr = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
  const end = canaryDate(nextMStr, 0, 0);

  const rows = await prisma.appointment.findMany({
    where: {
      startAt: { gte: start, lt: end },
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
  serviceDuration: number,
  earliestStart?: Date
): Promise<{ start: Date; end: Date }[]> {
  const dayOfWeek = toCanaryTimezone(date).getDay();
  const schedule = await prisma.schedule.findUnique({
    where: { manicuristId_dayOfWeek: { manicuristId, dayOfWeek } },
  });

  if (!schedule || !schedule.isActive) return [];

  const dateStr = format(toCanaryTimezone(date), "yyyy-MM-dd");
  const { start: dayStart, end: dayEnd } = canaryDayBounds(dateStr);

  const [sh, sm] = schedule.startTime.split(":").map(Number);
  const [eh, em] = schedule.endTime.split(":").map(Number);

  const schedStart = canaryDate(dateStr, sh, sm);
  const schedEnd = canaryDate(dateStr, eh, em);

  const existingAppts = await prisma.appointment.findMany({
    where: {
      manicuristId,
      status: { in: ["PENDING"] },
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

  if (earliestStart) {
    return slots.filter((s) => s.start >= earliestStart);
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
  const currentTime = now();

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
    const date = addDays(currentTime, d);
    const earliestStart = isSameDay(date, currentTime) ? ceilToNextSlotMinute(currentTime) : undefined;
    for (const manicuristId of ids) {
      const daySlots = await getAvailableSlots(manicuristId, date, serviceDuration, earliestStart);
      for (const slot of daySlots) {
        collected.push({ ...slot, manicuristId });
      }
    }
  }

  collected.sort((a, b) => a.start.getTime() - b.start.getTime());
  return collected.slice(0, limit);
}

// ─── Auto-complete ────────────────────────────────────────────────────────────

/**
 * Marks any PENDING appointment whose endAt is in the past as COMPLETED.
 * Called periodically by the worker (every 60 s).
 * Returns the number of rows updated.
 */
export async function autoCompleteExpiredAppointments(): Promise<number> {
  const expired = await prisma.appointment.findMany({
    where: {
      status: "CONFIRMED",
      endAt: { lt: now() },
    },
    select: { id: true },
  });

  if (expired.length === 0) return 0;

  await prisma.appointment.updateMany({
    where: { id: { in: expired.map((a) => a.id) } },
    data: { status: "COMPLETED" },
  });

  // No auto-generate invoices: payment method is unknown for auto-completed appointments.
  // Invoices are only generated when a manicurist manually completes with Bizum / Datáfono.

  return expired.length;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

const appointmentInclude = {
  client: { select: { id: true, name: true, phone: true, email: true } },
  manicurist: {
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  },
  service: { select: { id: true, name: true, duration: true, color: true } },
  services: {
    orderBy: { sortOrder: "asc" },
    include: {
      service: { select: { id: true, name: true, duration: true, color: true } },
      manicurist: {
        select: { id: true, user: { select: { name: true } } },
      },
    },
  },
} as const;
