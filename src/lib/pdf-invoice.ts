/**
 * PDF Invoice Generator — Receipt-style format (Canary Islands, no IVA).
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

  // Logo (optional)
  let logoImg: Awaited<ReturnType<PDFDocument["embedPng"]>> | null = null;
  const logoBytes = getLogoBytes();
  if (logoBytes) {
    try { logoImg = await pdfDoc.embedPng(logoBytes); } catch { logoImg = null; }
  }

  // ── Layout constants ─────────────────────────────────────────────────
  const pageW = page.getWidth();
  const colW = 320;
  const left = (pageW - colW) / 2;
  const right = left + colW;
  let y = 800;
  const LG = 3; // line gap

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

  // Draw left + right on the same line, then advance y
  const drawRow = (
    leftText: string,
    rightText: string | null,
    size: number,
    opts: { boldLeft?: boolean; boldRight?: boolean; color?: typeof dark } = {}
  ) => {
    draw(leftText, size, { bold: opts.boldLeft, color: opts.color });
    if (rightText) {
      const w = tw(rightText, size, opts.boldRight);
      draw(rightText, size, { bold: opts.boldRight, color: opts.color, x: right - w });
    }
    y -= size + LG;
  };

  const sep = () => {
    page.drawLine({
      start: { x: left, y: y - 4 },
      end: { x: right, y: y - 4 },
      thickness: 0.5,
      color: muted,
    });
    y -= 10;
  };

  const gap = (n: number) => { y -= n; };

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
    y -= logoH + 10;
  }

  // ── Header ───────────────────────────────────────────────────────────
  draw(invoice.businessName, 13, { bold: true, center: true, color: accent });
  y -= 13 + LG;
  if (invoice.businessNif) { draw(`NIF: ${invoice.businessNif}`, 8.5, { center: true, color: muted }); y -= 8.5 + 1; }
  if (invoice.businessAddress) { draw(invoice.businessAddress, 8.5, { center: true, color: muted }); y -= 8.5 + 1; }
  gap(8); sep(); gap(6);

  // ── Title ────────────────────────────────────────────────────────────
  draw("FACTURA", 18, { bold: true, center: true, color: accent });
  y -= 18 + LG;
  draw(invoice.formattedNumber, 11, { center: true, bold: true });
  y -= 11 + LG;
  gap(2);
  const dateStr = invoice.issuedAt
    ? new Date(invoice.issuedAt).toLocaleDateString("es-ES", {
        day: "2-digit", month: "long", year: "numeric", timeZone: "Atlantic/Canary",
      })
    : "";
  draw(dateStr, 8.5, { center: true, color: muted });
  y -= 8.5 + LG;
  gap(8); sep(); gap(6);

  // ── Client ───────────────────────────────────────────────────────────
  draw("CLIENTE", 8, { bold: true, color: muted });
  y -= 8 + 1;
  draw(invoice.clientName, 10);
  y -= 10 + LG;
  if (invoice.clientNif) { draw(`NIF: ${invoice.clientNif}`, 8.5, { color: muted }); y -= 8.5 + 1; }
  gap(8); sep();

  // ── Items header ─────────────────────────────────────────────────────
  drawRow("Concepto", "Total", 8, { boldLeft: true, boldRight: true, color: muted });
  sep();

  // ── Items ────────────────────────────────────────────────────────────
  for (const item of invoice.items) {
    const itemTotal = `${EUR(Number(item.totalPrice))} EUR`;
    const maxDesc = colW - tw(`  ${itemTotal}`, 10) - 4;
    let desc = item.description;
    if (tw(desc, 10) > maxDesc) {
      while (tw(desc + "...", 10) > maxDesc && desc.length > 1) desc = desc.slice(0, -1);
      desc += "...";
    }
    drawRow(desc, itemTotal, 10, { boldRight: true });
    if (item.quantity > 1 || Number(item.unitPrice) !== Number(item.totalPrice)) {
      draw(`${item.quantity} ud. x ${EUR(Number(item.unitPrice))} EUR`, 8, { color: muted });
      y -= 8 + 1;
    }
  }
  gap(6); sep();

  // ── Totals ───────────────────────────────────────────────────────────
  if (hasIva) {
    const baseStr = `Base imponible  ${EUR(Number(invoice.baseImponible))} EUR`;
    draw(baseStr, 9, { x: right - tw(baseStr, 9), color: muted });
    y -= 9 + 1;
    const ivaStr = `IVA (${Number(invoice.ivaRate)}%)  ${EUR(Number(invoice.ivaAmount))} EUR`;
    draw(ivaStr, 9, { x: right - tw(ivaStr, 9), color: muted });
    y -= 9 + 1;
    gap(4); sep();
  }

  gap(4);
  const totalStr = `TOTAL  ${EUR(Number(invoice.total))} EUR`;
  draw(totalStr, 16, { bold: true, center: true, color: accent });
  y -= 16 + 6;
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
  y -= 8.5 + LG;
  gap(8);

  // ── Footer ───────────────────────────────────────────────────────────
  if (invoice.notes) { draw(invoice.notes, 8, { center: true, color: muted }); y -= 8 + 1; }
  draw("Factura generada automaticamente", 7.5, { center: true, color: gray });

  return pdfDoc.save();
}
