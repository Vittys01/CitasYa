/**
 * GET /api/invoices/[id]/pdf  — download PDF
 *
 * Query params:
 *   ?formato=a4|recibo  (default: recibo)
 *   ?ancho=58|80        (default: 58, only for recibo)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveBusinessIdFromSession } from "@/lib/resolve-business-session";
import { apiError } from "@/lib/utils";
import { getInvoice } from "@/services/invoice.service";
import { generateInvoicePdf } from "@/lib/pdf-invoice";
import { generateReceiptPdf } from "@/lib/thermal-receipt";

const INVOICE_ROLES = ["OWNER", "ADMIN", "MANICURIST"] as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });
  if (!INVOICE_ROLES.includes(session.user.role as (typeof INVOICE_ROLES)[number])) {
    return NextResponse.json(apiError("Forbidden"), { status: 403 });
  }
  const businessId = await resolveBusinessIdFromSession(session);
  if (!businessId) return NextResponse.json(apiError("No business context"), { status: 403 });

  const isManicurist = session.user.role === "MANICURIST";
  const invoice = await getInvoice(
    id,
    businessId,
    isManicurist ? session.user.manicuristId ?? undefined : undefined
  );
  if (!invoice) return NextResponse.json(apiError("Not found"), { status: 404 });

  const { searchParams } = new URL(req.url);
  const formato = searchParams.get("formato") || "recibo";

  if (formato === "a4") {
    const pdfBytes = await generateInvoicePdf(invoice);
    return new Response(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="factura-${invoice.formattedNumber}.pdf"`,
      },
    });
  }

  const anchoParam = searchParams.get("ancho") || "58";
  const ancho = anchoParam === "80" ? 80 : 58;

  const pdfBytes = await generateReceiptPdf(invoice, ancho);

  const suffix = ancho === 80 ? "80mm" : "58mm";
  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="ticket-${invoice.formattedNumber}-${suffix}.pdf"`,
    },
  });
}
