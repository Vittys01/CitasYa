/**
 * Script de migración para regenerar facturas antiguas.
 *
 * Problema: Las facturas generadas antes del fix trataban el precio como
 * base imponible y sumaban IVA por encima, resultando en un total mayor
 * al precio real que paga el cliente.
 *
 * Solución: Recalcular baseImponible, ivaAmount y total de cada factura
 * usando el precio final (IVA incluido) almacenado en los items.
 *
 * USO:
 *   npx tsx prisma/regenerate-invoices.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function regenerateInvoices() {
  console.log("Iniciando regeneracion de facturas...");

  const invoices = await prisma.invoice.findMany({
    include: { items: { orderBy: { sortOrder: "asc" } } },
    orderBy: { number: "asc" },
  });

  console.log(`Encontradas ${invoices.length} facturas para procesar`);

  let updated = 0;
  let skipped = 0;

  for (const invoice of invoices) {
    const itemSum = invoice.items.reduce(
      (sum, item) => sum + Number(item.totalPrice),
      0
    );

    if (itemSum === 0) {
      console.log(`  Saltando ${invoice.formattedNumber} - sin items`);
      skipped++;
      continue;
    }

    const ivaRate = Number(invoice.ivaRate);
    const total = itemSum;
    const baseImponible = +((total / (1 + ivaRate / 100)).toFixed(2));
    const ivaAmount = +(total - baseImponible).toFixed(2);

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { baseImponible, ivaAmount, total },
    });

    console.log(
      `  Actualizada ${invoice.formattedNumber}: base=${baseImponible} IVA=${ivaAmount} total=${total} ` +
      `(anterior: base=${invoice.baseImponible} IVA=${invoice.ivaAmount} total=${invoice.total})`
    );
    updated++;
  }

  console.log(`\nCompletado: ${updated} actualizadas, ${skipped} saltadas`);
}

regenerateInvoices()
  .then(() => {
    console.log("Migracion completada exitosamente");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error en la migracion:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
