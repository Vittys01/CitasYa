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
  return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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
