/**
 * GET    /api/appointments/:id  — get single appointment
 * PATCH  /api/appointments/:id  — update status / reschedule
 * DELETE /api/appointments/:id  — cancel
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/utils";
import {
  updateAppointment,
  cancelAppointment,
} from "@/services/appointment.service";
import { prisma } from "@/lib/db";
import { z } from "zod";

const appointmentServiceSchema = z.object({
  serviceId: z.string().cuid(),
  durationMinutes: z.number().int().positive().optional(),
  price: z.number().min(0).optional(),
});

const updateSchema = z.object({
  status: z.enum(["PENDING", "COMPLETED"]).optional(),
  notes: z.string().optional(),
  startAt: z.string().datetime().optional(),
  manicuristId: z.string().cuid().optional(),
  clientId: z.string().cuid().optional(),
  serviceId: z.string().cuid().optional(),
  services: z.array(appointmentServiceSchema).optional(),
  price: z.number().min(0).optional(),
  totalDurationMinutes: z.number().int().min(5).max(1440).optional(),
  sendWhatsApp: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });

  const { id } = await params;
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      client: true,
      service: true,
      manicurist: { include: { user: true } },
      notifications: true,
    },
  });

  if (!appointment) return NextResponse.json(apiError("Not found"), { status: 404 });

  // Restricciones para manicuristas: solo ver sus propias citas
  if (session.user.role === "MANICURIST") {
    const userManicuristId = session.user.manicuristId;
    if (!userManicuristId || appointment.manicuristId !== userManicuristId) {
      return NextResponse.json(
        apiError("Solo puedes ver tus propias citas", "PERMISSION"),
        { status: 403 }
      );
    }
  }

  return NextResponse.json(apiSuccess(appointment));
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError(parsed.error.message, "VALIDATION"), { status: 422 });
  }

  // Restricciones para manicuristas
  if (session.user.role === "MANICURIST") {
    const userManicuristId = session.user.manicuristId;
    if (!userManicuristId) {
      return NextResponse.json(apiError("No manicurist asociado", "AUTH"), { status: 403 });
    }

    // Obtener la cita existente para verificar permisos
    const existingAppointment = await prisma.appointment.findUnique({
      where: { id },
      select: { manicuristId: true },
    });

    if (!existingAppointment) {
      return NextResponse.json(apiError("Cita no encontrada"), { status: 404 });
    }

    // Las manicuristas solo pueden modificar sus propias citas
    if (existingAppointment.manicuristId !== userManicuristId) {
      return NextResponse.json(
        apiError("Solo puedes modificar tus propias citas", "PERMISSION"),
        { status: 403 }
      );
    }

    // Las manicuristas no pueden cambiar el manicuristId de la cita
    if (parsed.data.manicuristId && parsed.data.manicuristId !== userManicuristId) {
      return NextResponse.json(
        apiError("No puedes cambiar la profesional de la cita", "PERMISSION"),
        { status: 403 }
      );
    }
  }

  try {
    const updated = await updateAppointment(id, parsed.data);
    if (updated === null) {
      return NextResponse.json(apiSuccess({ deleted: true }));
    }
    return NextResponse.json(apiSuccess(updated));
  } catch (err) {
    return NextResponse.json(apiError(String(err), "BUSINESS"), { status: 409 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });

  const { id } = await params;

  // Restricciones para manicuristas
  if (session.user.role === "MANICURIST") {
    const userManicuristId = session.user.manicuristId;
    if (!userManicuristId) {
      return NextResponse.json(apiError("No manicurist asociado", "AUTH"), { status: 403 });
    }

    // Obtener la cita para verificar permisos
    const existingAppointment = await prisma.appointment.findUnique({
      where: { id },
      select: { manicuristId: true },
    });

    if (!existingAppointment) {
      return NextResponse.json(apiError("Cita no encontrada"), { status: 404 });
    }

    // Las manicuristas solo pueden cancelar sus propias citas
    if (existingAppointment.manicuristId !== userManicuristId) {
      return NextResponse.json(
        apiError("Solo puedes cancelar tus propias citas", "PERMISSION"),
        { status: 403 }
      );
    }
  }

  try {
    await cancelAppointment(id);
    return NextResponse.json(apiSuccess({ cancelled: true }));
  } catch (err) {
    return NextResponse.json(apiError(String(err)), { status: 500 });
  }
}
