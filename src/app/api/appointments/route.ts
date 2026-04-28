/**
 * GET  /api/appointments  — list by date or week range
 * POST /api/appointments  — create new appointment
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveBusinessIdFromSession } from "@/lib/resolve-business-session";
import { apiError, apiSuccess, now, toCanaryTimezone } from "@/lib/utils";
import {
  createAppointment,
  getAppointmentsByDate,
  getAppointmentsByMonth,
  getAppointmentsByWeek,
} from "@/services/appointment.service";
import { z } from "zod";

const appointmentServiceSchema = z.object({
  serviceId: z.string().cuid(),
  durationMinutes: z.number().int().positive().optional(),
  price: z.number().min(0).optional(),
});

const createSchema = z.object({
  clientId: z.string().cuid(),
  manicuristId: z.string().cuid(),
  serviceId: z.string().cuid().optional(),
  services: z.array(appointmentServiceSchema).optional(),
  startAt: z.string().datetime(),
  notes: z.string().optional(),
  price: z.number().min(0).optional(),
  totalDurationMinutes: z.number().int().min(5).max(1440).optional(),
  sendWhatsApp: z.boolean().optional(),
}).refine(
  (d) => d.serviceId || (d.services && d.services.length > 0),
  { message: "Indicá serviceId o services" }
);

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized", "AUTH"), { status: 401 });
  const businessId = await resolveBusinessIdFromSession(session);
  if (!businessId) return NextResponse.json(apiError("No business context"), { status: 403 });

  const { searchParams } = req.nextUrl;
  const date = searchParams.get("date");
  const weekStart = searchParams.get("weekStart");
  /** Primer día del mes en ISO (ej. 2025-03-01) para vista mes */
  const month = searchParams.get("month");
  let manicuristId = searchParams.get("manicuristId") ?? undefined;

  // Restricciones para manicuristas: solo ver sus propias citas
  if (session.user.role === "MANICURIST") {
    const userManicuristId = session.user.manicuristId;
    if (!userManicuristId) {
      return NextResponse.json(apiError("No manicurist asociado", "AUTH"), { status: 403 });
    }
    // Si intentan ver citas de otra manicurista, forzar a ver solo las propias
    if (manicuristId && manicuristId !== userManicuristId) {
      return NextResponse.json(
        apiError("Las manicuristas solo pueden ver sus propias citas", "PERMISSION"),
        { status: 403 }
      );
    }
    manicuristId = userManicuristId;
  }

  const options = { businessId, manicuristId };

  try {
    if (month) {
      const data = await getAppointmentsByMonth(toCanaryTimezone(new Date(month)), options);
      return NextResponse.json(apiSuccess(data));
    }
    if (weekStart) {
      const data = await getAppointmentsByWeek(toCanaryTimezone(new Date(weekStart)), options);
      return NextResponse.json(apiSuccess(data));
    }

    const target = date ? toCanaryTimezone(new Date(date)) : now();
    const data = await getAppointmentsByDate(target, options);
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

  // Restricción para manicuristas: solo pueden crear citas para sí mismas
  if (session.user.role === "MANICURIST") {
    const userManicuristId = session.user.manicuristId;
    if (!userManicuristId) {
      return NextResponse.json(apiError("No manicurist asociado", "AUTH"), { status: 403 });
    }
    if (parsed.data.manicuristId !== userManicuristId) {
      return NextResponse.json(
        apiError("Las manicuristas solo pueden crear citas para sí mismas", "PERMISSION"),
        { status: 403 }
      );
    }
  }

  try {
    const appointment = await createAppointment(parsed.data);
    return NextResponse.json(apiSuccess(appointment), { status: 201 });
  } catch (err) {
    return NextResponse.json(apiError(String(err), "BUSINESS"), { status: 409 });
  }
}
