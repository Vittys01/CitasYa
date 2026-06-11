/**
 * GET    /api/invoices/[id]  — detail with items
 * PATCH  /api/invoices/[id]  — update status
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveBusinessIdFromSession } from "@/lib/resolve-business-session";
import { apiError, apiSuccess } from "@/lib/utils";
import { getInvoice, updateInvoiceStatus, cancelInvoice } from "@/services/invoice.service";
import { serializeInvoice } from "@/lib/serialize";
import { z } from "zod";

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

  return NextResponse.json(apiSuccess(serializeInvoice(invoice)));
}

const patchSchema = z.object({
  status: z.enum(["DRAFT", "ISSUED", "CANCELLED"]),
});

export async function PATCH(
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

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError(parsed.error.message, "VALIDATION"), { status: 422 });
  }

  const updated = await updateInvoiceStatus(id, businessId, parsed.data.status);
  if (!updated) return NextResponse.json(apiError("Not found"), { status: 404 });

  return NextResponse.json(apiSuccess(serializeInvoice(updated)));
}
