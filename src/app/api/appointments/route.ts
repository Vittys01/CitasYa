/**
 * GET  /api/appointments  — list by date or week range
 * POST /api/appointments  — create new appointment
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/utils";
import {
  createAppointment,
  getAppointmentsByDate,
  getAppointmentsByWeek,
} from "@/services/appointment.service";
import { z } from "zod";

const createSchema = z.object({
  clientId: z.string().cuid(),
  manicuristId: z.string().cuid(),
  serviceId: z.string().cuid(),
  startAt: z.string().datetime(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized", "AUTH"), { status: 401 });

  const { searchParams } = req.nextUrl;
  const date = searchParams.get("date");
  const weekStart = searchParams.get("weekStart");
  const manicuristId = searchParams.get("manicuristId") ?? undefined;

  try {
    if (weekStart) {
      const data = await getAppointmentsByWeek(new Date(weekStart), manicuristId);
      return NextResponse.json(apiSuccess(data));
    }

    const target = date ? new Date(date) : new Date();
    const data = await getAppointmentsByDate(target, manicuristId);
    return NextResponse.json(apiSuccess(data));
  } catch (err) {
    return NextResponse.json(apiError(String(err)), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized", "AUTH"), { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError(parsed.error.message, "VALIDATION"), { status: 422 });
  }

  try {
    const appointment = await createAppointment(parsed.data);
    return NextResponse.json(apiSuccess(appointment), { status: 201 });
  } catch (err) {
    return NextResponse.json(apiError(String(err), "BUSINESS"), { status: 409 });
  }
}
