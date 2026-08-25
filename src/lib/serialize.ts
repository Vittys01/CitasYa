/**
 * Serialize Prisma results for passing to Client Components.
 * Next.js cannot pass non-plain objects (e.g. Prisma Decimal) from Server to Client.
 */

import type { Service } from "@prisma/client";
import type { AppointmentWithRelations, InvoiceWithRelations, InvoiceForClient } from "@/types";

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

/** Normaliza el JSON de POST/PATCH `/api/appointments` para el calendario (Decimal → number).
 *  Acepta tanto un objeto como un array. */
export function appointmentFromApiJson(raw: unknown): AppointmentForClient | AppointmentForClient[] | null {
  if (!raw || typeof raw !== "object") return null;
  if (Array.isArray(raw)) {
    const items = raw.map((item) => {
      const a = item as Record<string, unknown>;
      const services = a.services;
      const normalized: Record<string, unknown> = {
        ...a,
        price: Number(a.price ?? 0),
        startAt: a.startAt as string,
        endAt: a.endAt as string,
      };
      if (Array.isArray(services)) {
        normalized.services = services.map((s) => {
          const si = s as Record<string, unknown>;
          return { ...si, price: Number(si.price ?? 0) };
        });
      }
      return normalized as AppointmentForClient;
    });
    return items;
  }
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

/** Serialize Invoice with Prisma Decimals to numbers — safe for Client Components */
export function serializeInvoice(invoice: InvoiceWithRelations): InvoiceForClient {
  const { manicurist, ...rest } = invoice;
  return {
    ...rest,
    manicurist: manicurist ? { id: manicurist.id, name: manicurist.user.name } : null,
    baseImponible: Number(invoice.baseImponible),
    ivaRate: Number(invoice.ivaRate),
    ivaAmount: Number(invoice.ivaAmount),
    irpfRate: Number(invoice.irpfRate),
    irpfAmount: Number(invoice.irpfAmount),
    total: Number(invoice.total),
    items: invoice.items.map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
    })),
  } as InvoiceForClient;
}
