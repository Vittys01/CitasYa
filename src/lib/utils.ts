import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { addMinutes, areIntervalsOverlapping } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(Number(amount));
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Atlantic/Canary"
  });
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Atlantic/Canary"
  });
}

/** Formato de fecha corta para calendarios (ej: "lunes 15 de abril") */
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Atlantic/Canary"
  });
}

/** Formato de hora (24h) para calendarios */
export function formatHour(date: Date): string {
  return date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Atlantic/Canary"
  });
}

/** Formato de mes y año (ej: "abril de 2026") */
export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
    timeZone: "Atlantic/Canary"
  });
}

/**
 * Convierte una fecha UTC a la zona horaria de Canarias para usar con date-fns
 * date-fns no soporta timezones nativamente, por lo que convertimos la fecha
 * ajustando la diferencia horaria
 */
export function toCanaryTimezone(date: Date): Date {
  // Obtenemos la fecha/hora en la zona horaria de Canarias
  const canaryTimeStr = date.toLocaleString("en-US", { timeZone: "Atlantic/Canary" });
  return new Date(canaryTimeStr);
}

/** Paso de la grilla de turnos (API, lista de horarios, “desde ahora”). */
export const SCHEDULE_SLOT_MINUTES = 5;

/**
 * Primer instante en la grilla local de `SCHEDULE_SLOT_MINUTES` que sea >= `now`.
 */
export function ceilToNextSlotMinute(now: Date): Date {
  const step = SCHEDULE_SLOT_MINUTES;
  const d = new Date(now);
  d.setSeconds(0, 0);
  const m = d.getMinutes();
  const rem = m % step;
  if (rem !== 0) {
    d.setMinutes(m + (step - rem), 0, 0);
  }
  if (d < now) {
    d.setMinutes(d.getMinutes() + step, 0, 0);
  }
  return d;
}

/** Calculate end time given a start time and duration (minutes) */
export function calcEndTime(startAt: Date, durationMinutes: number): Date {
  return addMinutes(startAt, durationMinutes);
}

/** Check if two time intervals overlap */
export function intervalsOverlap(
  a: { start: Date; end: Date },
  b: { start: Date; end: Date }
): boolean {
  return areIntervalsOverlapping(
    { start: a.start, end: a.end },
    { start: b.start, end: b.end },
    { inclusive: false }
  );
}

/**
 * Normalise phone to E.164 for any country.
 * - Strips spaces, dashes, parentheses; keeps only digits and leading +.
 * - Removes leading 0 (e.g. 054 → 54).
 * - If 10–15 digits: assumes already with country code → +digits.
 * - If 7–9 digits: treats as local and prepends defaultCountryCode (e.g. Argentina 54).
 */
export function normalisePhone(raw: string, defaultCountryCode = "54"): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  if (digits.length >= 7 && digits.length <= 9) return `+${defaultCountryCode}${digits}`;
  if (digits.length > 0) return `+${digits}`;
  return raw.trim() || raw;
}

/** Build paginated metadata */
export function buildPaginationMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
}

/** Standard API success response shape */
export function apiSuccess<T>(data: T, meta?: Record<string, unknown>) {
  return { success: true, data, ...(meta ? { meta } : {}) };
}

/** Standard API error response shape */
export function apiError(message: string, code?: string, status = 400) {
  return { success: false, error: { message, code }, status };
}

/** Roles que pueden acceder a gestión (servicios, equipo, clientes, settings). Manicuristas excluidos. */
export function canAccessStaffFeatures(role: string): boolean {
  return ["ADMIN", "OWNER", "RECEPTIONIST"].includes(role);
}

/** Format phone number for display (e.g. +5491112345678 → +54 9 11 1234-5678) */
export function formatPhoneNumber(phoneE164: string): string {
  if (!phoneE164) return "";

  const digits = phoneE164.replace(/\D/g, "");

  if (digits.length === 13 && digits.startsWith("549")) {
    // Argentina: +54 9 11 1234-5678
    return `+54 9 ${digits.slice(4, 6)} ${digits.slice(6, 10)}-${digits.slice(10)}`;
  }

  if (digits.length === 11 && digits.startsWith("5411")) {
    // Argentina (sin 9): +54 11 1234-5678
    return `+54 ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }

  // Default: just format with spaces every 3-4 digits
  if (digits.length > 6) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }

  return phoneE164;
}

/** Current time in Canary Islands timezone */
export function now(): Date {
  return toCanaryTimezone(new Date());
}

/** Format relative time (e.g. "hace 5 min", "ayer") */
export function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const currentTime = now();
  const diffMs = currentTime.getTime() - dateObj.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "ahora";
  if (diffMins < 60) return `hace ${diffMins} min`;
  if (diffHours < 24) return `hace ${diffHours} h`;
  if (diffDays === 1) return "ayer";
  if (diffDays < 7) return `hace ${diffDays} días`;

  return dateObj.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
  });
}
