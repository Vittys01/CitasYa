import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { InvoiceWithRelations } from "@/types";
import { getLogoBytes } from "@/lib/logo";

const EUR = (n: number) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const WIDTHS = { 58: 288, 80: 480 } as const;

const black = rgb(0, 0, 0);
const gray = rgb(0.4, 0.4, 0.4);

export async function generateReceiptPdf(
  invoice: InvoiceWithRelations,
  paperWidth: 58 | 80 = 58
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Logo (optional)
  let logoImg: Awaited<ReturnType<PDFDocument["embedPng"]>> | null = null;
  const logoBytes = getLogoBytes();
  if (logoBytes) {
    try { logoImg = await pdfDoc.embedPng(logoBytes); } catch { logoImg = null; }
  }

  const pageWidth = WIDTHS[paperWidth];
  const m = 16;
  const is80 = paperWidth === 80;

  const F = {
    title: is80 ? 14 : 11,
    subtitle: is80 ? 10 : 9,
    body: is80 ? 9 : 8,
    small: is80 ? 7.5 : 7,
    total: is80 ? 18 : 14,
  };

  const logoW = is80 ? 80 : 55;
  const logoH = logoImg ? (logoImg.height / logoImg.width) * logoW : 0;
  const hasIva = Number(invoice.ivaRate) > 0;
  const LG = 2; // line gap

  // ── Compute total height ────────────────────────────────────────────
  let h = m;
  if (logoImg) h += logoH + 6;
  h += F.subtitle + LG;
  if (invoice.businessNif) h += F.small + 1;
  if (invoice.businessAddress) h += F.small + 1;
  h += 6 + 8 + 4;                          // gap + sep + gap
  h += F.title + LG;
  h += F.body + LG;
  h += 2 + F.small + LG + 4 + 8 + 4;       // gap + date + gap + sep + gap
  h += F.small + 1;                        // CLIENTE label
  h += F.body + LG;                        // client name
  if (invoice.clientNif) h += F.small + 1;
  h += 6 + 8;                              // gap + sep
  if (is80) h += F.small + 1 + 8;          // items header + sep
  for (const _ of invoice.items)
    h += is80 ? F.body + LG + F.small + 1 : F.body + LG;
  h += 4 + 8;                              // gap + sep
  if (hasIva && is80) h += (F.small + 1) * 2 + 4 + 8;
  h += 4 + F.total + 4 + 8;               // gap + total + gap + sep
  h += F.small + LG + 4;                   // status + gap
  if (invoice.notes) h += F.small + 1;
  h += F.small + 1;                        // app name
  h += m;                                   // bottom margin

  const pageHeight = Math.max(h, 150);
  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - m;

  // ── Helpers ──────────────────────────────────────────────────────────
  const tw = (text: string, size: number, bold = false) =>
    (bold ? fontBold : font).widthOfTextAtSize(text, size);

  const draw = (
    text: string,
    size: number,
    opts: { bold?: boolean; center?: boolean; color?: typeof black; x?: number } = {}
  ) => {
    const f = opts.bold ? fontBold : font;
    const w = tw(text, size, opts.bold);
    const x = opts.center ? (pageWidth - w) / 2 : opts.x ?? m;
    page.drawText(text, { x, y: y - size, size, font: f, color: opts.color ?? black });
    return w;
  };

  // Draw left + right on the same line, then advance y
  const drawRow = (
    leftText: string,
    rightText: string | null,
    size: number,
    opts: { bold?: boolean; boldRight?: boolean; color?: typeof black } = {}
  ) => {
    draw(leftText, size, opts);
    if (rightText) {
      const w = tw(rightText, size, opts.boldRight);
      draw(rightText, size, { ...opts, bold: opts.boldRight, x: pageWidth - m - w });
    }
    y -= size + LG;
  };

  const sep = () => {
    page.drawLine({
      start: { x: m, y: y - 4 },
      end: { x: pageWidth - m, y: y - 4 },
      thickness: 0.5,
      color: gray,
    });
    y -= 8;
  };

  const gap = (n: number) => { y -= n; };

  // ── Logo ─────────────────────────────────────────────────────────────
  if (logoImg) {
    page.drawImage(logoImg, {
      x: (pageWidth - logoW) / 2,
      y: y - logoH,
      width: logoW,
      height: logoH,
    });
    y -= logoH + 6;
  }

  // ── Header ───────────────────────────────────────────────────────────
  draw(invoice.businessName, F.subtitle, { bold: true, center: true });
  y -= F.subtitle + LG;
  if (invoice.businessNif) { draw(`NIF: ${invoice.businessNif}`, F.small, { center: true, color: gray }); y -= F.small + 1; }
  if (invoice.businessAddress) { draw(invoice.businessAddress, F.small, { center: true, color: gray }); y -= F.small + 1; }
  gap(6); sep(); gap(4);

  // ── Title ────────────────────────────────────────────────────────────
  draw("FACTURA", F.title, { bold: true, center: true });
  y -= F.title + LG;
  draw(invoice.formattedNumber, F.body, { center: true });
  y -= F.body + LG;
  gap(2);
  const dateStr = invoice.issuedAt
    ? new Date(invoice.issuedAt).toLocaleDateString("es-ES", {
        day: "2-digit", month: "long", year: "numeric", timeZone: "Atlantic/Canary",
      })
    : "";
  draw(dateStr, F.small, { center: true, color: gray });
  y -= F.small + LG;
  gap(4); sep(); gap(4);

  // ── Client ───────────────────────────────────────────────────────────
  draw("CLIENTE", F.small, { bold: true, color: gray });
  y -= F.small + 1;
  draw(invoice.clientName, F.body);
  y -= F.body + LG;
  if (invoice.clientNif) { draw(`NIF: ${invoice.clientNif}`, F.small, { color: gray }); y -= F.small + 1; }
  gap(6); sep();

  // ── Items ────────────────────────────────────────────────────────────
  if (is80) {
    drawRow("Concepto", "Total", F.small, { bold: true, boldRight: true, color: gray });
    sep();
  }

  for (const item of invoice.items) {
    const total = `${EUR(Number(item.totalPrice))} EUR`;
    if (is80) {
      drawRow(item.description, total, F.body, { boldRight: true });
      const detail = `${item.quantity} ud. x ${EUR(Number(item.unitPrice))} EUR`;
      draw(detail, F.small, { color: gray });
      y -= F.small + 1;
    } else {
      drawRow(item.description, total, F.body, { boldRight: true });
    }
  }
  gap(4); sep();

  // ── Totals ───────────────────────────────────────────────────────────
  if (hasIva && is80) {
    const baseStr = `Base imponible  ${EUR(Number(invoice.baseImponible))} EUR`;
    const ivaStr = `IVA (${Number(invoice.ivaRate)}%)  ${EUR(Number(invoice.ivaAmount))} EUR`;
    draw(baseStr, F.small, { x: pageWidth - m - tw(baseStr, F.small) });
    y -= F.small + 1;
    draw(ivaStr, F.small, { x: pageWidth - m - tw(ivaStr, F.small) });
    y -= F.small + 1;
    gap(4); sep();
  }

  gap(4);
  const totalLabel = `TOTAL  ${EUR(Number(invoice.total))} EUR`;
  draw(totalLabel, F.total, { bold: true, center: true });
  y -= F.total + 4;
  sep();

  // ── Status ───────────────────────────────────────────────────────────
  const statusLabels: Record<string, string> = {
    DRAFT: "BORRADOR", ISSUED: "EMITIDA", CANCELLED: "ANULADA",
  };
  draw(`Estado: ${statusLabels[invoice.status] ?? invoice.status}`, F.small, { center: true, color: gray });
  y -= F.small + LG;
  gap(4);

  // ── Footer ───────────────────────────────────────────────────────────
  if (invoice.notes) { draw(invoice.notes, F.small, { center: true, color: gray }); y -= F.small + 1; }
  draw("CitasYa", F.small, { center: true, color: gray });

  return pdfDoc.save();
}
