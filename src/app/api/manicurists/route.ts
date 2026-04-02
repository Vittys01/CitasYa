/**
 * GET  /api/manicurists  — list all active manicurists
 * POST /api/manicurists  — create (Admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveBusinessIdFromSession } from "@/lib/resolve-business-session";
import { apiError, apiSuccess, canAccessStaffFeatures } from "@/lib/utils";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#ec4899"),
  bio: z.string().optional(),
  schedules: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
      })
    )
    .optional(),
});

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });
  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json(apiError("No business context"), { status: 403 });

  // Restricciones para manicuristas: solo verse a sí mismas
  let whereClause: any = { businessId, isActive: true };
  if (session.user.role === "MANICURIST") {
    const userManicuristId = session.user.manicuristId;
    if (!userManicuristId) {
      return NextResponse.json(apiError("No manicurist asociado", "AUTH"), { status: 403 });
    }
    whereClause.id = userManicuristId;
  }

  const manicurists = await prisma.manicurist.findMany({
    where: whereClause,
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      schedules: true,
    },
    orderBy: { user: { name: "asc" } },
  });

  return NextResponse.json(apiSuccess(manicurists));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });
  if (!canAccessStaffFeatures(session.user.role)) {
    return NextResponse.json(apiError("Forbidden"), { status: 403 });
  }
  const businessId = await resolveBusinessIdFromSession(session);
  if (!businessId) return NextResponse.json(apiError("No business context"), { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError(parsed.error.message, "VALIDATION"), { status: 422 });
  }

  const { name, email, password, color, bio, schedules } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(apiError("El email ya está registrado", "CONFLICT"), { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: "MANICURIST",
      manicurist: {
        create: {
          businessId,
          color,
          bio,
          ...(schedules && {
            schedules: { createMany: { data: schedules } },
          }),
        },
      },
    },
    include: {
      manicurist: { include: { schedules: true } },
    },
  });

  return NextResponse.json(apiSuccess(user), { status: 201 });
}
