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

const updateSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]).optional(),
  notes: z.string().optional(),
  startAt: z.string().datetime().optional(),
  manicuristId: z.string().cuid().optional(),
  serviceId: z.string().cuid().optional(),
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

  try {
    const updated = await updateAppointment(id, parsed.data);
    return NextResponse.json(apiSuccess(updated));
  } catch (err) {
    return NextResponse.json(apiError(String(err), "BUSINESS"), { status: 409 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });

  const { id } = await params;
  try {
    await cancelAppointment(id);
    return NextResponse.json(apiSuccess({ cancelled: true }));
  } catch (err) {
    return NextResponse.json(apiError(String(err)), { status: 500 });
  }
}
