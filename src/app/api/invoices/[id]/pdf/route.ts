/**
 * GET /api/invoices/[id]/pdf  — download PDF
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveBusinessIdFromSession } from "@/lib/resolve-business-session";
import { apiError } from "@/lib/utils";
import { getInvoice } from "@/services/invoice.service";
import { generateInvoicePdf } from "@/lib/pdf-invoice";

const INVOICE_ROLES = ["OWNER", "ADMIN"] as const;

export async function GET(
  _req: NextRequest,
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

  const invoice = await getInvoice(id, businessId);
  if (!invoice) return NextResponse.json(apiError("Not found"), { status: 404 });

  const pdfBytes = await generateInvoicePdf(invoice);

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="factura-${invoice.formattedNumber}.pdf"`,
    },
  });
}
