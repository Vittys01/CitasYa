/**
 * GET  /api/clients  — search / list
 * POST /api/clients  — create
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/utils";
import { createClient, searchClients } from "@/services/client.service";
import { z } from "zod";

const phoneRefine = (v: string) => {
  const digits = v.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
};

const createSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(1).refine(phoneRefine, "Teléfono inválido (código país + número, 8-15 dígitos)"),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });
  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json(apiError("No business context"), { status: 403 });

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");

  const result = await searchClients(q, page, limit, businessId);
  return NextResponse.json({ success: true, ...result });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });
  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json(apiError("No business context"), { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError(parsed.error.message, "VALIDATION"), { status: 422 });
  }

  try {
    const client = await createClient(parsed.data, businessId);
    return NextResponse.json(apiSuccess(client), { status: 201 });
  } catch (err) {
    return NextResponse.json(apiError(String(err), "CONFLICT"), { status: 409 });
  }
}
