/**
 * Invoice Service — Spanish tax-compliant invoice generation.
 *
 * - Auto-generate from completed appointments
 * - Sequential numbering per business (atomic)
 * - IVA calculations (IRPF disabled — exempt)
 */

import { prisma } from "@/lib/db";
import { buildPaginationMeta, now, canaryDate } from "@/lib/utils";
import type { InvoiceWithRelations, InvoiceFilters } from "@/types";
import type { InvoiceStatus } from "@prisma/client";

// ─── Invoice number generation (atomic) ──────────────────────────────────────

function formatInvoiceNumber(prefix: string | null, num: number): string {
  const p = prefix || "F";
  return `${p}-${String(num).padStart(5, "0")}`;
}

// ─── Generate from appointment ────────────────────────────────────────────────

export async function generateInvoiceFromAppointment(
  appointmentId: string
): Promise<InvoiceWithRelations | null> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      client: true,
      service: { select: { id: true, name: true } },
      services: {
        orderBy: { sortOrder: "asc" },
        include: { service: true },
      },
      business: true,
    },
  });

  if (!appointment || appointment.status !== "COMPLETED") return null;

  // Check if invoice already exists for this appointment
  const existing = await prisma.invoice.findUnique({
    where: { appointmentId },
  });
  if (existing) return null;

  const biz = appointment.business;
  const client = appointment.client;

  // Build line items from appointment services
  const items = appointment.services.length > 0
    ? appointment.services.map((s, i) => ({
        description: s.service.name,
        quantity: 1,
        unitPrice: Number(s.price),
        totalPrice: Number(s.price),
        serviceId: s.serviceId,
        sortOrder: i,
      }))
    : [{
        description: appointment.service?.name ?? "Servicio",
        quantity: 1,
        unitPrice: Number(appointment.price),
        totalPrice: Number(appointment.price),
        serviceId: appointment.serviceId,
        sortOrder: 0,
      }];

  const baseImponible = items.reduce((sum, i) => sum + i.totalPrice, 0);
  const ivaRate = Number(biz.defaultIvaRate);
  const ivaAmount = +(baseImponible * ivaRate / 100).toFixed(2);
  const irpfRate = 0;
  const irpfAmount = 0;
  const total = +(baseImponible + ivaAmount).toFixed(2);

  // Format business address
  const addressParts = [
    biz.addressStreet,
    biz.addressPostal,
    biz.addressCity,
    biz.addressProvince,
  ].filter(Boolean);
  const businessAddress = addressParts.length > 0 ? addressParts.join(", ") : null;

  // Create invoice in transaction (atomic number generation)
  const invoice = await prisma.$transaction(async (tx) => {
    const updatedBiz = await tx.business.update({
      where: { id: biz.id },
      data: { nextInvoiceNum: { increment: 1 } },
      select: { nextInvoiceNum: true, invoicePrefix: true },
    });

    const invoiceNum = updatedBiz.nextInvoiceNum - 1;
    const prefix = updatedBiz.invoicePrefix ?? "F";
    const formatted = formatInvoiceNumber(prefix, invoiceNum);

    return tx.invoice.create({
      data: {
        businessId: biz.id,
        number: invoiceNum,
        prefix,
        formattedNumber: formatted,
        appointmentId: appointmentId,
        clientId: client.id,
        clientName: client.name,
        clientNif: client.nif,
        clientEmail: client.email,
        businessName: biz.name,
        businessNif: biz.nif,
        businessAddress,
        issuedAt: now(),
        status: "DRAFT",
        baseImponible,
        ivaRate,
        ivaAmount,
        irpfRate,
        irpfAmount,
        total,
        items: {
          create: items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            serviceId: item.serviceId,
            sortOrder: item.sortOrder,
          })),
        },
      },
      include: invoiceInclude,
    });
  });

  return invoice as InvoiceWithRelations;
}

// ─── List invoices ────────────────────────────────────────────────────────────

export async function getInvoices(
  businessId: string,
  filters: InvoiceFilters = {}
) {
  const { dateFrom, dateTo, clientId, status, q, page = 1, limit = 20 } = filters;

  const where: Record<string, unknown> = { businessId };

  if (dateFrom || dateTo) {
    where.issuedAt = {
      ...(dateFrom ? { gte: canaryDate(dateFrom, 0, 0) } : {}),
      ...(dateTo ? { lte: canaryDate(dateTo, 23, 59, 59) } : {}),
    };
  }
  if (clientId) where.clientId = clientId;
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { formattedNumber: { contains: q, mode: "insensitive" } },
      { clientName: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, invoices] = await prisma.$transaction([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { number: "desc" },
      include: invoiceInclude,
    }),
  ]);

  return { invoices, meta: buildPaginationMeta(total, page, limit) };
}

// ─── Get single invoice ──────────────────────────────────────────────────────

export async function getInvoice(
  id: string,
  businessId: string
): Promise<InvoiceWithRelations | null> {
  return prisma.invoice.findFirst({
    where: { id, businessId },
    include: invoiceInclude,
  }) as Promise<InvoiceWithRelations | null>;
}

// ─── Update invoice status ────────────────────────────────────────────────────

export async function updateInvoiceStatus(
  id: string,
  businessId: string,
  status: InvoiceStatus
): Promise<InvoiceWithRelations | null> {
  const invoice = await prisma.invoice.findFirst({ where: { id, businessId } });
  if (!invoice) return null;

  const updated = await prisma.invoice.update({
    where: { id },
    data: { status },
    include: invoiceInclude,
  });

  return updated as InvoiceWithRelations;
}

// ─── Cancel invoice ──────────────────────────────────────────────────────────

export async function cancelInvoice(
  id: string,
  businessId: string
): Promise<InvoiceWithRelations | null> {
  return updateInvoiceStatus(id, businessId, "CANCELLED");
}

// ─── Private helpers ─────────────────────────────────────────────────────────

const invoiceInclude = {
  items: { orderBy: { sortOrder: "asc" as const } },
  client: { select: { id: true, name: true, phone: true, email: true, nif: true } },
  appointment: { select: { id: true, startAt: true, endAt: true } },
} as const;
