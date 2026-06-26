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

  const pageWidth = WIDTHS[paperWidth];
  const m = 16;
  const cw = pageWidth - m * 2;
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

  // ── Height estimate ──────────────────────────────────────────────────
  const L = (h: number) => { calcY += h; };
  let calcY = m;
  if (logoImg) { L(logoH + 6); }  // logo
  L(F.subtitle + 6);
  if (invoice.businessNif) L(F.small + 2);
  if (invoice.businessAddress) L(F.small + 2);
  L(4); L(0.5); L(8);
  L(F.title + 6);
  L(F.body + 3);
  L(F.small + 8);
  L(F.small + 4); // CLIENTE label
  L(F.body + 3);
  if (invoice.clientNif) L(F.small + 3);
  L(6);
  L(F.small + 4);
  for (const _ of invoice.items) L(is80 ? F.body + F.small + 8 : F.body + 10);
  L(4); L(0.5); L(8);
  if (hasIva && is80) { L(F.small + 4); L(F.small + 4); L(4); L(0.5); }
  L(F.total + 12);
  L(0.5); L(8);
  L(F.small + 4);
  if (invoice.notes) L(F.small + 4);
  L(F.small + 12);

  const pageHeight = Math.max(calcY + m, 150);
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

  const right = (text: string, size: number, opts: { bold?: boolean; color?: typeof black } = {}) =>
    draw(text, size, { ...opts, x: pageWidth - m - tw(text, size, opts.bold) });

  const sep = () => {
    const line = "─".repeat(Math.floor(cw / tw("─", F.small)));
    draw(line, F.small, { center: true, color: gray });
    y -= 4;
  };

  const gap = (h: number) => { y -= h; };

  // ── Logo ─────────────────────────────────────────────────────────────
  if (logoImg) {
    page.drawImage(logoImg, {
      x: (pageWidth - logoW) / 2,
      y: y - logoH,
      width: logoW,
      height: logoH,
    });
    y -= logoH + 4;
  }

  // ── Header ───────────────────────────────────────────────────────────
  draw(invoice.businessName, F.subtitle, { bold: true, center: true });
  y -= 4;
  if (invoice.businessNif) draw(`NIF: ${invoice.businessNif}`, F.small, { center: true, color: gray });
  if (invoice.businessAddress) draw(invoice.businessAddress, F.small, { center: true, color: gray });
  gap(6);
  sep();
  gap(4);

  // ── Title ────────────────────────────────────────────────────────────
  draw("FACTURA", F.title, { bold: true, center: true });
  draw(invoice.formattedNumber, F.body, { center: true });
  gap(2);
  const dateStr = invoice.issuedAt
    ? new Date(invoice.issuedAt).toLocaleDateString("es-ES", {
        day: "2-digit", month: "long", year: "numeric", timeZone: "Atlantic/Canary",
      })
    : "";
  draw(dateStr, F.small, { center: true, color: gray });
  gap(4);
  sep();
  gap(4);

  // ── Client ───────────────────────────────────────────────────────────
  draw("CLIENTE", F.small, { bold: true, color: gray });
  draw(invoice.clientName, F.body);
  if (invoice.clientNif) draw(`NIF: ${invoice.clientNif}`, F.small, { color: gray });
  gap(6);
  sep();

  // ── Items ────────────────────────────────────────────────────────────
  if (is80) {
    draw("Concepto", F.small, { bold: true, color: gray });
    right("Total", F.small, { bold: true, color: gray });
    y -= 2;
    sep();
  }

  for (const item of invoice.items) {
    const total = `${EUR(Number(item.totalPrice))} EUR`;
    if (is80) {
      draw(item.description, F.body);
      right(total, F.body, { bold: true });
      const detail = `${item.quantity} ud. x ${EUR(Number(item.unitPrice))} EUR`;
      draw(detail, F.small, { color: gray });
    } else {
      draw(item.description, F.body);
      right(total, F.body, { bold: true });
    }
  }
  gap(4);
  sep();

  // ── Totals ───────────────────────────────────────────────────────────
  if (hasIva && is80) {
    right(`Base imponible  ${EUR(Number(invoice.baseImponible))} EUR`, F.small);
    right(`IVA (${Number(invoice.ivaRate)}%)  ${EUR(Number(invoice.ivaAmount))} EUR`, F.small);
    gap(4);
    sep();
  }

  gap(4);
  const totalLabel = `TOTAL  ${EUR(Number(invoice.total))} EUR`;
  draw(totalLabel, F.total, { bold: true, center: true });
  sep();

  // ── Status ───────────────────────────────────────────────────────────
  const statusLabels: Record<string, string> = {
    DRAFT: "BORRADOR", ISSUED: "EMITIDA", CANCELLED: "ANULADA",
  };
  draw(`Estado: ${statusLabels[invoice.status] ?? invoice.status}`, F.small, { center: true, color: gray });
  gap(4);

  // ── Footer ───────────────────────────────────────────────────────────
  if (invoice.notes) {
    draw(invoice.notes, F.small, { center: true, color: gray });
  }
  draw("CitasYa", F.small, { center: true, color: gray });

  return pdfDoc.save();
}
