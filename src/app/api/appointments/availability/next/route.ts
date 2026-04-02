/**
 * GET /api/appointments/availability/next
 * Query: serviceId, manicuristId (optional), limit (default 3)
 * Returns: next N available slots (start, end, manicuristId, manicuristName)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveBusinessIdFromSession } from "@/lib/resolve-business-session";
import { apiError, apiSuccess } from "@/lib/utils";
import { getNextAvailableSlots } from "@/services/appointment.service";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });
    const businessId = await resolveBusinessIdFromSession(session);
    if (!businessId) return NextResponse.json(apiError("No business context"), { status: 403 });

    const { searchParams } = req.nextUrl;
    const serviceId = searchParams.get("serviceId");
    let manicuristId = searchParams.get("manicuristId");
    const limitParam = searchParams.get("limit") ?? "3";
    const limit = Math.min(20, Math.max(1, parseInt(limitParam, 10) || 3));

    // Restricciones para manicuristas: solo ver su propia disponibilidad
    if (session.user.role === "MANICURIST") {
      const userManicuristId = session.user.manicuristId;
      if (!userManicuristId) {
        return NextResponse.json(apiError("No manicurist asociado", "AUTH"), { status: 403 });
      }
      // Si intentan ver disponibilidad de otra manicurista, forzar a ver solo la propia
      if (manicuristId && manicuristId !== userManicuristId) {
        return NextResponse.json(
          apiError("Las manicuristas solo pueden ver su propia disponibilidad", "PERMISSION"),
          { status: 403 }
        );
      }
      manicuristId = userManicuristId;
    }

    if (!serviceId) {
      return NextResponse.json(apiError("serviceId es requerido"), { status: 422 });
    }

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) {
      return NextResponse.json(apiError("Servicio no encontrado"), { status: 404 });
    }
    if (service.businessId !== businessId) {
      return NextResponse.json(apiError("Servicio no pertenece a tu empresa"), { status: 403 });
    }

    const durationParam = searchParams.get("duration");
    const duration = durationParam
      ? Math.max(1, parseInt(durationParam, 10) || service.duration)
      : Number(service.duration);
    if (!Number.isFinite(duration) || duration < 1) {
      return NextResponse.json(apiError("El servicio no tiene una duración válida"), { status: 422 });
    }

    const manicuristIds = manicuristId ? [manicuristId] : [];
    const slots = await getNextAvailableSlots(manicuristIds, duration, limit, businessId);

    const manicuristIdsSeen = [...new Set(slots.map((s) => s.manicuristId))];
    const manicurists =
      manicuristIdsSeen.length > 0
        ? await prisma.manicurist.findMany({
            where: { id: { in: manicuristIdsSeen } },
            include: { user: { select: { name: true } } },
          })
        : [];
    const nameByManicurist = Object.fromEntries(
      manicurists.map((m) => [m.id, m.user?.name ?? ""])
    );

    return NextResponse.json(
      apiSuccess(
        slots.map((s) => ({
          start: s.start.toISOString(),
          end: s.end.toISOString(),
          manicuristId: s.manicuristId,
          manicuristName: nameByManicurist[s.manicuristId] ?? "",
        }))
      )
    );
  } catch (err) {
    console.error("[GET /api/appointments/availability/next]", err);
    return NextResponse.json(
      apiError(err instanceof Error ? err.message : "Error al obtener disponibilidad"),
      { status: 500 }
    );
  }
}
