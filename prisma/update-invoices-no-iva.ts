/**
 * Script de migración — Islas Canarias (sin IVA) + facturas para todas las citas.
 *
 * Fases:
 * 1. Pone defaultIvaRate = 0 en todos los negocios.
 * 2. Genera facturas para todas las citas COMPLETED que no tengan factura.
 * 3. Recalcula todas las facturas existentes con IVA = 0
 *    (ivaRate = 0, ivaAmount = 0, baseImponible = total).
 *
 * Los precios de los items (unitPrice, totalPrice) se mantienen igual
 * porque ya son precios finales que paga el cliente.
 *
 * USO:
 *   npx tsx prisma/update-invoices-no-iva.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function formatInvoiceNumber(prefix: string | null, num: number): string {
  const p = prefix || "F";
  return `${p}-${String(num).padStart(5, "0")}`;
}

async function migrateInvoicesNoIva() {
  console.log("=== Migracion Islas Canarias (sin IVA) + facturas para citas ===\n");

  // ── Fase 1: defaultIvaRate = 0 en todos los negocios ───────────────
  console.log("Fase 1: Poniendo defaultIvaRate = 0 en negocios...\n");

  const businesses = await prisma.business.findMany({
    select: {
      id: true, name: true, defaultIvaRate: true,
      invoicePrefix: true, nextInvoiceNum: true,
      nif: true,
      addressStreet: true, addressPostal: true, addressCity: true, addressProvince: true,
    },
  });

  console.log(`  ${businesses.length} negocio(s) encontrado(s)`);

  for (const biz of businesses) {
    await prisma.business.update({
      where: { id: biz.id },
      data: { defaultIvaRate: 0 },
    });
    console.log(`  ${biz.name}: IVA ${biz.defaultIvaRate}% → 0%`);
  }

  // ── Fase 2: Generar facturas para citas COMPLETED sin factura ──────
  console.log("\nFase 2: Generando facturas para citas completadas...\n");

  // Build business lookup map
  const bizMap = new Map(businesses.map((b) => [b.id, b]));

  const appointments = await prisma.appointment.findMany({
    where: { status: "COMPLETED", invoice: null },
    include: {
      client: true,
      service: { select: { id: true, name: true } },
      services: { orderBy: { sortOrder: "asc" }, include: { service: true } },
    },
    orderBy: { startAt: "asc" },
  });

  console.log(`  ${appointments.length} cita(s) completada(s) sin factura\n`);

  let generated = 0;

  for (const apt of appointments) {
    const biz = bizMap.get(apt.businessId);
    if (!biz) {
      console.log(`  Saltando cita ${apt.id} — negocio no encontrado`);
      continue;
    }

    // Build line items
    const items = apt.services.length > 0
      ? apt.services.map((s, i) => ({
          description: s.service.name,
          quantity: 1,
          unitPrice: Number(s.price),
          totalPrice: Number(s.price),
          serviceId: s.serviceId,
          sortOrder: i,
        }))
      : [{
          description: apt.service?.name ?? "Servicio",
          quantity: 1,
          unitPrice: Number(apt.price),
          totalPrice: Number(apt.price),
          serviceId: apt.serviceId,
          sortOrder: 0,
        }];

    const total = items.reduce((sum, i) => sum + i.totalPrice, 0);

    // Format business address
    const addressParts = [
      biz.addressStreet,
      biz.addressPostal,
      biz.addressCity,
      biz.addressProvince,
    ].filter(Boolean);
    const businessAddress = addressParts.length > 0 ? addressParts.join(", ") : null;

    // Atomic invoice number generation
    const updatedBiz = await prisma.business.update({
      where: { id: biz.id },
      data: { nextInvoiceNum: { increment: 1 } },
      select: { nextInvoiceNum: true, invoicePrefix: true },
    });

    const invoiceNum = updatedBiz.nextInvoiceNum - 1;
    const prefix = updatedBiz.invoicePrefix ?? "F";
    const formatted = formatInvoiceNumber(prefix, invoiceNum);

    await prisma.invoice.create({
      data: {
        businessId: biz.id,
        number: invoiceNum,
        prefix,
        formattedNumber: formatted,
        appointmentId: apt.id,
        clientId: apt.clientId,
        clientName: apt.client.name,
        clientNif: apt.client.nif,
        clientEmail: apt.client.email,
        businessName: biz.name,
        businessNif: biz.nif,
        businessAddress,
        issuedAt: apt.startAt,
        status: "ISSUED",
        baseImponible: total,
        ivaRate: 0,
        ivaAmount: 0,
        irpfRate: 0,
        irpfAmount: 0,
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
    });

    console.log(`  ${formatted} ← ${apt.service?.name ?? "multi-servicio"} (${apt.client.name})  ${total.toFixed(2)} EUR`);
    generated++;
  }

  console.log(`\n  ${generated} factura(s) generada(s)`);

  // ── Fase 3: Recalcular facturas existentes con IVA = 0 ─────────────
  console.log("\nFase 3: Recalculando facturas con IVA = 0...\n");

  const invoices = await prisma.invoice.findMany({
    include: { items: { orderBy: { sortOrder: "asc" } } },
    orderBy: { number: "asc" },
  });

  let updated = 0;
  let skipped = 0;

  for (const invoice of invoices) {
    if (invoice.items.length === 0) {
      console.log(`  Saltando ${invoice.formattedNumber} — sin items`);
      skipped++;
      continue;
    }

    const total = invoice.items.reduce(
      (sum, item) => sum + Number(item.totalPrice),
      0
    );

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        ivaRate: 0,
        ivaAmount: 0,
        baseImponible: total,
        total,
      },
    });

    console.log(
      `  ${invoice.formattedNumber}: total=${total.toFixed(2)} EUR ` +
      `(antes: IVA=${invoice.ivaRate}%=${invoice.ivaAmount})`
    );
    updated++;
  }

  // Summary
  console.log(`\n=== Completado ===`);
  console.log(`  Fase 1: ${businesses.length} negocio(s) con IVA = 0%`);
  console.log(`  Fase 2: ${generated} factura(s) generada(s) para citas`);
  console.log(`  Fase 3: ${updated} factura(s) recalculada(s), ${skipped} saltada(s)`);
  console.log("");
}

migrateInvoicesNoIva()
  .then(() => {
    console.log("Migracion completada exitosamente");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error en la migracion:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
