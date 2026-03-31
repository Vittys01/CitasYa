/**
 * Serialize Prisma results for passing to Client Components.
 * Next.js cannot pass non-plain objects (e.g. Prisma Decimal) from Server to Client.
 */

import type { Service } from "@prisma/client";
import type { AppointmentWithRelations } from "@/types";

/** Service with price as number for client */
export type ServiceForClient = Omit<Service, "price"> & { price: number };

export function serializeService(s: Service): ServiceForClient {
  return { ...s, price: Number(s.price) };
}

export function serializeServices(services: Service[]): ServiceForClient[] {
  return services.map(serializeService);
}

/** AppointmentWithRelations with price serialized to number — safe to pass to Client Components */
export type AppointmentForClient = Omit<AppointmentWithRelations, "price" | "services" | "startAt" | "endAt"> & {
  price: number;
  startAt: string | Date;
  endAt: string | Date;
  services?: Array<Omit<NonNullable<AppointmentWithRelations["services"]>[number], "price"> & { price: number }>;
};

/** Appointment-like with price as number (and optional nested services) */
export function serializeAppointmentPrice(a: AppointmentWithRelations): AppointmentForClient {
  const result: Record<string, unknown> = { ...a, price: Number(a.price) };
  if (a.services?.length) {
    result.services = a.services.map((s) => ({ ...s, price: Number(s.price) }));
  }
  return result as AppointmentForClient;
}

/** Normaliza el JSON de POST/PATCH `/api/appointments` para el calendario (Decimal → number). */
export function appointmentFromApiJson(raw: unknown): AppointmentForClient | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const services = a.services;
  const normalized: Record<string, unknown> = {
    ...a,
    price: Number(a.price ?? 0),
    startAt: a.startAt as string,
    endAt: a.endAt as string,
  };
  if (Array.isArray(services)) {
    normalized.services = services.map((item) => {
      const s = item as Record<string, unknown>;
      return { ...s, price: Number(s.price ?? 0) };
    });
  }
  return normalized as AppointmentForClient;
}
