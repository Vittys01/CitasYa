/**
 * GET  /api/invoices  — list with filters
 * POST /api/invoices  — create manual invoice
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveBusinessIdFromSession } from "@/lib/resolve-business-session";
import { apiError, apiSuccess } from "@/lib/utils";
import { getInvoices } from "@/services/invoice.service";
import { serializeInvoice } from "@/lib/serialize";
import { z } from "zod";

const INVOICE_ROLES = ["OWNER", "ADMIN", "MANICURIST"] as const;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });
  if (!INVOICE_ROLES.includes(session.user.role as (typeof INVOICE_ROLES)[number])) {
    return NextResponse.json(apiError("Forbidden"), { status: 403 });
  }
  const businessId = await resolveBusinessIdFromSession(session);
  if (!businessId) return NextResponse.json(apiError("No business context"), { status: 403 });

  const isManicurist = session.user.role === "MANICURIST";
  const { searchParams } = req.nextUrl;
  const result = await getInvoices(businessId, {
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    clientId: searchParams.get("clientId") ?? undefined,
    status: (searchParams.get("status") as "DRAFT" | "ISSUED" | "CANCELLED") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    manicuristId: isManicurist
      ? session.user.manicuristId ?? undefined
      : searchParams.get("manicuristId") ?? undefined,
    paymentMethod: (searchParams.get("paymentMethod") as "EFECTIVO" | "BIZUM" | "DATAFONO") ?? undefined,
    page: parseInt(searchParams.get("page") ?? "1"),
    limit: parseInt(searchParams.get("limit") ?? "20"),
  });

  return NextResponse.json({
    success: true,
    data: result.invoices.map(serializeInvoice),
    meta: result.meta,
  });
}

const createSchema = z.object({
  clientId: z.string().min(1),
  appointmentId: z.string().optional(),
  issuedAt: z.string().optional(),
  ivaRate: z.number().min(0).max(100).optional(),
  irpfRate: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });
  if (!INVOICE_ROLES.includes(session.user.role as (typeof INVOICE_ROLES)[number])) {
    return NextResponse.json(apiError("Forbidden"), { status: 403 });
  }
  const businessId = await resolveBusinessIdFromSession(session);
  if (!businessId) return NextResponse.json(apiError("No business context"), { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError(parsed.error.message, "VALIDATION"), { status: 422 });
  }

  try {
    // For now, manual invoices use the same flow via appointment (if provided)
    // or we can extend later. Return not implemented for manual without appointment.
    return NextResponse.json(apiError("Las facturas se generan automaticamente al completar citas", "NOT_IMPLEMENTED"), { status: 400 });
  } catch (err) {
    return NextResponse.json(apiError(String(err)), { status: 500 });
  }
}
