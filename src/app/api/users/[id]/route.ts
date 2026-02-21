/**
 * PATCH /api/users/[id] — update user (name). Admin only.
 * DELETE /api/users/[id] — remove from team: delete if no appointments, else deactivate. Admin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/utils";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(2).max(120),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(apiError("Forbidden"), { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError(parsed.error.message, "VALIDATION"), { status: 422 });
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json(apiError("Usuario no encontrado"), { status: 404 });

  const updated = await prisma.user.update({
    where: { id },
    data: { name: parsed.data.name },
  });
  return NextResponse.json(apiSuccess(updated));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(apiError("Forbidden"), { status: 403 });
  }

  const { id } = await params;
  if (session.user.id === id) {
    return NextResponse.json(apiError("No podés eliminarte a vos mismo"), { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: { manicurist: true },
  });
  if (!user) return NextResponse.json(apiError("Usuario no encontrado"), { status: 404 });

  const hasAppointments =
    user.manicurist &&
    (await prisma.appointment.count({ where: { manicuristId: user.manicurist.id } })) > 0;

  if (hasAppointments) {
    await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { isActive: false } }),
      prisma.manicurist.updateMany({ where: { userId: id }, data: { isActive: false } }),
    ]);
    return NextResponse.json(
      apiSuccess({ deactivated: true, message: "Se desactivó el usuario porque tiene turnos asignados." })
    );
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json(apiSuccess({ deleted: true }));
}
