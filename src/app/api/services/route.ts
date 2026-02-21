/**
 * GET  /api/services  — list active services
 * POST /api/services  — create (Admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/utils";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  duration: z.number().int().min(15).max(480),
  price: z.number().positive(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });

  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(apiSuccess(services));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(apiError("Forbidden"), { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError(parsed.error.message, "VALIDATION"), { status: 422 });
  }

  const service = await prisma.service.create({ data: parsed.data });
  return NextResponse.json(apiSuccess(service), { status: 201 });
}
