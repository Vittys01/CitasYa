/**
 * GET  /api/owner/businesses/[id]/settings  — read all settings for a business
 * PATCH /api/owner/businesses/[id]/settings  — upsert key/value pairs (OWNER only)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/utils";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

async function resolveOwnership(id: string, ownerId: string) {
  return prisma.business.findFirst({
    where: { id, ownerId },
    select: { id: true },
  });
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });
  if (session.user.role !== "OWNER") {
    return NextResponse.json(apiError("Solo el owner puede ver esto"), { status: 403 });
  }

  const { id } = await params;
  const business = await resolveOwnership(id, session.user.id);
  if (!business) return NextResponse.json(apiError("Empresa no encontrada"), { status: 404 });

  const rows = await prisma.appSetting.findMany({
    where: { businessId: id },
    select: { key: true, value: true },
  });

  return NextResponse.json(
    apiSuccess(Object.fromEntries(rows.map((r) => [r.key, r.value])))
  );
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });
  if (session.user.role !== "OWNER") {
    return NextResponse.json(apiError("Solo el owner puede modificar esto"), { status: 403 });
  }

  const { id } = await params;
  const business = await resolveOwnership(id, session.user.id);
  if (!business) return NextResponse.json(apiError("Empresa no encontrada"), { status: 404 });

  const body = await req.json();
  const parsed = z.record(z.string(), z.string()).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError("Payload inválido"), { status: 422 });
  }

  const updates = await Promise.all(
    Object.entries(parsed.data).map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { businessId_key: { businessId: id, key } },
        update: { value },
        create: { businessId: id, key, value },
      })
    )
  );

  return NextResponse.json(apiSuccess(updates));
}
