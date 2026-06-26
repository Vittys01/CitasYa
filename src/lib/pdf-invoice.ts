/**
 * PDF Invoice Generator — Receipt-style format (Canary Islands, no IVA).
 *
 * Uses pdf-lib for pure JS PDF generation (no Chromium needed).
 * Layout mirrors the thermal receipt so A4 and ticket formats match.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { InvoiceWithRelations } from "@/types";
import { getLogoBytes } from "@/lib/logo";

const EUR = (n: number) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function generateInvoicePdf(
  invoice: InvoiceWithRelations
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Logo (optional — gracefully degrades if missing)
  let logoImg: Awaited<ReturnType<PDFDocument["embedPng"]>> | null = null;
  const logoBytes = getLogoBytes();
  if (logoBytes) {
    try {
      logoImg = await pdfDoc.embedPng(logoBytes);
    } catch {
      logoImg = null;
    }
  }

  // ── Layout constants ─────────────────────────────────────────────────
  const pageW = page.getWidth();
  const colW = 320;                   // centered receipt column
  const left = (pageW - colW) / 2;
  const right = left + colW;
  let y = 800;

  // Colors
  const dark = rgb(0.29, 0.23, 0.2);
  const muted = rgb(0.61, 0.51, 0.45);
  const accent = rgb(0.5, 0.33, 0.22);
  const gray = rgb(0.4, 0.4, 0.4);

  const hasIva = Number(invoice.ivaRate) > 0;

  // ── Helpers ──────────────────────────────────────────────────────────
  const tw = (text: string, size: number, bold = false) =>
    (bold ? fontBold : font).widthOfTextAtSize(text, size);

  const draw = (
    text: string,
    size: number,
    opts: { bold?: boolean; center?: boolean; color?: typeof dark; x?: number } = {}
  ) => {
    const f = opts.bold ? fontBold : font;
    const w = tw(text, size, opts.bold);
    const x = opts.center ? left + (colW - w) / 2 : opts.x ?? left;
    page.drawText(text, { x, y: y - size, size, font: f, color: opts.color ?? dark });
    return w;
  };

  const rightAlign = (
    text: string,
    size: number,
    opts: { bold?: boolean; color?: typeof dark } = {}
  ) => draw(text, size, { ...opts, x: right - tw(text, size, opts.bold) });

  const sep = () => {
    page.drawLine({
      start: { x: left, y: y - 8 },
      end: { x: right, y: y - 8 },
      thickness: 0.5,
      color: muted,
    });
    y -= 14;
  };

  const gap = (h: number) => { y -= h; };

  // ── Logo ─────────────────────────────────────────────────────────────
  if (logoImg) {
    const logoW = 90;
    const logoH = (logoImg.height / logoImg.width) * logoW;
    page.drawImage(logoImg, {
      x: left + (colW - logoW) / 2,
      y: y - logoH,
      width: logoW,
      height: logoH,
    });
    y -= logoH + 8;
  }

  // ── Header ───────────────────────────────────────────────────────────
  draw(invoice.businessName, 13, { bold: true, center: true, color: accent });
  y -= 4;
  if (invoice.businessNif) draw(`NIF: ${invoice.businessNif}`, 8.5, { center: true, color: muted });
  if (invoice.businessAddress) draw(invoice.businessAddress, 8.5, { center: true, color: muted });
  gap(8);
  sep();
  gap(6);

  // ── Title ────────────────────────────────────────────────────────────
  draw("FACTURA", 18, { bold: true, center: true, color: accent });
  draw(invoice.formattedNumber, 11, { center: true, bold: true });
  y -= 4;
  const dateStr = invoice.issuedAt
    ? new Date(invoice.issuedAt).toLocaleDateString("es-ES", {
        day: "2-digit", month: "long", year: "numeric", timeZone: "Atlantic/Canary",
      })
    : "";
  draw(dateStr, 8.5, { center: true, color: muted });
  gap(8);
  sep();
  gap(6);

  // ── Client ───────────────────────────────────────────────────────────
  draw("CLIENTE", 8, { bold: true, color: muted });
  draw(invoice.clientName, 10);
  if (invoice.clientNif) draw(`NIF: ${invoice.clientNif}`, 8.5, { color: muted });
  gap(8);
  sep();

  // ── Items header ─────────────────────────────────────────────────────
  draw("Concepto", 8, { bold: true, color: muted });
  rightAlign("Total", 8, { bold: true, color: muted });
  y -= 4;
  sep();

  // ── Items ────────────────────────────────────────────────────────────
  for (const item of invoice.items) {
    const itemTotal = `${EUR(Number(item.totalPrice))} EUR`;
    const maxDesc = colW - tw(`${itemTotal}  `, 10) - 4;
    let desc = item.description;
    if (tw(desc, 10) > maxDesc) {
      while (tw(desc + "…", 10) > maxDesc && desc.length > 1) desc = desc.slice(0, -1);
      desc += "…";
    }
    draw(desc, 10);
    rightAlign(itemTotal, 10, { bold: true });
    if (item.quantity > 1 || Number(item.unitPrice) !== Number(item.totalPrice)) {
      draw(`${item.quantity} ud. x ${EUR(Number(item.unitPrice))} EUR`, 8, { color: muted });
    }
    y -= 4;
  }
  gap(6);
  sep();

  // ── Totals ───────────────────────────────────────────────────────────
  if (hasIva) {
    rightAlign(`Base imponible  ${EUR(Number(invoice.baseImponible))} EUR`, 9, { color: muted });
    y -= 4;
    rightAlign(`IVA (${Number(invoice.ivaRate)}%)  ${EUR(Number(invoice.ivaAmount))} EUR`, 9, { color: muted });
    y -= 6;
    sep();
  }

  gap(4);
  const totalStr = `TOTAL  ${EUR(Number(invoice.total))} EUR`;
  draw(totalStr, 16, { bold: true, center: true, color: accent });
  sep();

  // ── Status ───────────────────────────────────────────────────────────
  const statusLabels: Record<string, string> = {
    DRAFT: "BORRADOR", ISSUED: "EMITIDA", CANCELLED: "ANULADA",
  };
  const statusColor = invoice.status === "CANCELLED"
    ? rgb(0.8, 0.2, 0.2)
    : invoice.status === "DRAFT"
      ? muted
      : rgb(0.2, 0.6, 0.3);
  draw(`Estado: ${statusLabels[invoice.status] ?? invoice.status}`, 8.5, { center: true, color: statusColor });
  gap(8);

  // ── Footer ───────────────────────────────────────────────────────────
  if (invoice.notes) {
    draw(invoice.notes, 8, { center: true, color: muted });
  }
  draw("Factura generada automaticamente", 7.5, { center: true, color: gray });

  return pdfDoc.save();
}
