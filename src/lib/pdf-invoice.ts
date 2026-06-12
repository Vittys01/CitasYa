/**
 * PDF Invoice Generator — Spanish tax-compliant factura.
 * Uses pdf-lib for pure JS PDF generation (no Chromium needed).
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { InvoiceWithRelations } from "@/types";

const EUR = (n: number) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function generateInvoicePdf(
  invoice: InvoiceWithRelations
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  // Colors
  const dark = rgb(0.29, 0.23, 0.2);     // #4a3b32
  const muted = rgb(0.61, 0.51, 0.45);   // #9c8273
  const accent = rgb(0.5, 0.33, 0.22);   // #7f5539
  const lineColor = rgb(0.9, 0.84, 0.76); // #e6d5c3
  const white = rgb(1, 1, 1);

  const drawText = (
    text: string,
    x: number,
    yPos: number,
    opts: { size?: number; bold?: boolean; color?: typeof dark } = {}
  ) => {
    const f = opts.bold ? fontBold : font;
    const size = opts.size ?? 10;
    const c = opts.color ?? dark;
    page.drawText(text, { x, y: yPos, size, font: f, color: c });
  };

  // ─── Header ───────────────────────────────────────────────────────────────

  // Business name
  drawText(invoice.businessName, margin, y, { size: 18, bold: true, color: accent });
  y -= 18;

  // Business info
  if (invoice.businessNif) {
    drawText(`NIF: ${invoice.businessNif}`, margin, y, { size: 9, color: muted });
    y -= 14;
  }
  if (invoice.businessAddress) {
    drawText(invoice.businessAddress, margin, y, { size: 9, color: muted });
    y -= 14;
  }
  y -= 10;

  // Separator line
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: lineColor });
  y -= 25;

  // ─── Invoice title + number ───────────────────────────────────────────────

  drawText("FACTURA", margin, y, { size: 22, bold: true, color: accent });
  drawText(invoice.formattedNumber, width - margin - fontBold.widthOfTextAtSize(invoice.formattedNumber, 14), y, { size: 14, bold: true });
  y -= 25;

  // Date
  const dateStr = invoice.issuedAt
    ? new Date(invoice.issuedAt).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "Atlantic/Canary",
      })
    : "";
  drawText(`Fecha de emision: ${dateStr}`, margin, y, { size: 9, color: muted });
  y -= 25;

  // ─── Client section ───────────────────────────────────────────────────────

  drawText("DATOS DEL CLIENTE", margin, y, { size: 10, bold: true });
  y -= 16;
  drawText(invoice.clientName, margin, y, { size: 10 });
  if (invoice.clientNif) {
    drawText(`NIF: ${invoice.clientNif}`, margin, y - 14, { size: 9, color: muted });
    y -= 14;
  }
  y -= 20;

  // ─── Items table ──────────────────────────────────────────────────────────

  // Table header
  const colDesc = margin;
  const colQty = 340;
  const colPrice = 400;
  const colTotal = width - margin - 70;

  // Header background
  page.drawRectangle({
    x: margin,
    y: y - 4,
    width: width - margin * 2,
    height: 20,
    color: rgb(0.96, 0.93, 0.91),
  });

  drawText("Concepto", colDesc, y, { size: 9, bold: true, color: muted });
  drawText("Ud.", colQty, y, { size: 9, bold: true, color: muted });
  drawText("Precio", colPrice, y, { size: 9, bold: true, color: muted });
  drawText("Total", colTotal, y, { size: 9, bold: true, color: muted });
  y -= 22;

  // Line items
  for (const item of invoice.items) {
    const desc = item.description.length > 45
      ? item.description.substring(0, 42) + "..."
      : item.description;
    drawText(desc, colDesc, y, { size: 10 });
    drawText(String(item.quantity), colQty, y, { size: 10 });
    drawText(`${EUR(Number(item.unitPrice))} EUR`, colPrice, y, { size: 10 });
    drawText(`${EUR(Number(item.totalPrice))} EUR`, colTotal, y, { size: 10 });
    y -= 18;
  }

  y -= 10;

  // ─── Totals ───────────────────────────────────────────────────────────────

  // Separator
  page.drawLine({ start: { x: 350, y }, end: { x: width - margin, y }, thickness: 0.5, color: lineColor });
  y -= 16;

  const labelX = 350;
  const valueX = width - margin - 70;

  drawText("Base imponible", labelX, y, { size: 10 });
  drawText(`${EUR(Number(invoice.baseImponible))} EUR`, valueX, y, { size: 10 });
  y -= 16;

  drawText(`IVA (${Number(invoice.ivaRate)}%)`, labelX, y, { size: 10 });
  drawText(`${EUR(Number(invoice.ivaAmount))} EUR`, valueX, y, { size: 10 });
  y -= 16;

  // Total line
  page.drawLine({ start: { x: 350, y }, end: { x: width - margin, y }, thickness: 1, color: accent });
  y -= 18;

  drawText("TOTAL", labelX, y, { size: 13, bold: true, color: accent });
  drawText(`${EUR(Number(invoice.total))} EUR`, valueX, y, { size: 13, bold: true, color: accent });

  y -= 50;

  // ─── Status badge ─────────────────────────────────────────────────────────

  const statusText = invoice.status === "DRAFT" ? "BORRADOR" :
    invoice.status === "ISSUED" ? "EMITIDA" :
    invoice.status === "CANCELLED" ? "ANULADA" : invoice.status;

  const statusColor = invoice.status === "CANCELLED"
    ? rgb(0.8, 0.2, 0.2)
    : invoice.status === "DRAFT"
      ? muted
      : rgb(0.2, 0.6, 0.3);

  drawText(`Estado: ${statusText}`, margin, y, { size: 9, bold: true, color: statusColor });

  // ─── Footer ───────────────────────────────────────────────────────────────

  y = 70;
  page.drawLine({ start: { x: margin, y: y + 15 }, end: { x: width - margin, y: y + 15 }, thickness: 0.5, color: lineColor });

  if (invoice.notes) {
    drawText(`Notas: ${invoice.notes}`, margin, y, { size: 8, color: muted });
    y -= 12;
  }

  drawText("Factura generada automaticamente por CitasYa", margin, 40, { size: 7, color: muted });

  return pdfDoc.save();
}
