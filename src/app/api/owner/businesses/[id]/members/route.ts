/**
 * POST /api/owner/businesses/[id]/members
 * Creates a user (ADMIN | MANICURIST | RECEPTIONIST) and links them to the business.
 * OWNER only.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/utils";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createMemberSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  role: z.enum(["ADMIN", "MANICURIST", "RECEPTIONIST"]),
  // MANICURIST-only optional fields
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#ec4899"),
  bio: z.string().max(300).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });
  if (session.user.role !== "OWNER") {
    return NextResponse.json(apiError("Solo el owner puede crear miembros"), { status: 403 });
  }

  const { id: businessId } = await params;

  // Verify the business belongs to this owner
  const business = await prisma.business.findFirst({
    where: { id: businessId, ownerId: session.user.id },
    select: { id: true },
  });
  if (!business) {
    return NextResponse.json(apiError("Empresa no encontrada"), { status: 404 });
  }

  const body = await req.json();
  const parsed = createMemberSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Datos inválidos";
    return NextResponse.json(apiError(msg, "VALIDATION"), { status: 422 });
  }

  const { name, email, password, role, color, bio } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      apiError("El email ya está registrado", "CONFLICT"),
      { status: 409 }
    );
  }

  const hashed = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role,
      businessId,
      isActive: true,
      ...(role === "MANICURIST" && {
        manicurist: {
          create: {
            businessId,
            color,
            bio,
            schedules: {
              createMany: {
                data: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
                  dayOfWeek,
                  startTime: "09:00",
                  endTime: "18:00",
                })),
              },
            },
          },
        },
      }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      manicurist: { select: { id: true } },
    },
  });

  return NextResponse.json(apiSuccess(user), { status: 201 });
}
