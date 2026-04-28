/**
 * GET /api/appointments/availability
 * Query params: manicuristId, date (ISO), serviceId
 * Returns: available time slots
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiError, apiSuccess, ceilToNextSlotMinute, now, canaryDate, getCanaryDateString } from "@/lib/utils";
import { getAvailableSlots } from "@/services/appointment.service";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });

  const { searchParams } = req.nextUrl;
  let manicuristId = searchParams.get("manicuristId");
  const date = searchParams.get("date");
  const serviceId = searchParams.get("serviceId");

  if (session.user.role === "MANICURIST") {
    const userManicuristId = session.user.manicuristId;
    if (!userManicuristId) {
      return NextResponse.json(apiError("No manicurist asociado", "AUTH"), { status: 403 });
    }
    if (manicuristId && manicuristId !== userManicuristId) {
      return NextResponse.json(
        apiError("Las manicuristas solo pueden ver su propia disponibilidad", "PERMISSION"),
        { status: 403 }
      );
    }
    manicuristId = userManicuristId;
  }

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

  const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : getCanaryDateString(new Date(date));
  const dateLocal = canaryDate(dateStr, 12, 0);

  const canaryNow = now();
  const todayCanaryStr = getCanaryDateString(canaryNow);
  const earliestStart = dateStr === todayCanaryStr ? ceilToNextSlotMinute(canaryNow) : undefined;
  const slots = await getAvailableSlots(manicuristId, dateLocal, duration, earliestStart);

  return NextResponse.json(
    apiSuccess(
      slots.map((s) => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
      }))
    )
  );
}
