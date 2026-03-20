/**
 * GET /api/appointments/availability
 * Query params: manicuristId, date (ISO), serviceId
 * Returns: available time slots
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/utils";
import { getAvailableSlots } from "@/services/appointment.service";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });

  const { searchParams } = req.nextUrl;
  const manicuristId = searchParams.get("manicuristId");
  const date = searchParams.get("date");
  const serviceId = searchParams.get("serviceId");

  if (!manicuristId || !date || !serviceId) {
    return NextResponse.json(
      apiError("manicuristId, date y serviceId son requeridos", "VALIDATION"),
      { status: 422 }
    );
  }

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) return NextResponse.json(apiError("Servicio no encontrado"), { status: 404 });

  const durationParam = searchParams.get("duration");
  const duration = durationParam
    ? Math.max(1, parseInt(durationParam, 10) || service.duration)
    : service.duration;

  const dateLocal =
    /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? (() => {
          const [y, m, d] = date.split("-").map(Number);
          return new Date(y, m - 1, d);
        })()
      : new Date(date);

  const slots = await getAvailableSlots(manicuristId, dateLocal, duration);

  return NextResponse.json(
    apiSuccess(
      slots.map((s) => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
      }))
    )
  );
}
