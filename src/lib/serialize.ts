/**
 * Serialize Prisma results for passing to Client Components.
 * Next.js cannot pass non-plain objects (e.g. Prisma Decimal) from Server to Client.
 */

import type { Service, Prisma } from "@prisma/client";
import type { AppointmentWithRelations } from "@/types";

/** Service with price as number for client */
export type ServiceForClient = Omit<Service, "price"> & { price: number };

export function serializeService(s: Service): ServiceForClient {
  return { ...s, price: Number(s.price) };
}

export function serializeServices(services: Service[]): ServiceForClient[] {
  return services.map(serializeService);
}

/** Appointment-like with price as number (and optional nested serialization) */
export function serializeAppointmentPrice<T extends { price: Prisma.Decimal | number }>(a: T): Omit<T, "price"> & { price: number } {
  return { ...a, price: Number(a.price) };
}

/** AppointmentWithRelations with price serialized to number — safe to pass to Client Components */
export type AppointmentForClient = Omit<AppointmentWithRelations, "price"> & { price: number };
