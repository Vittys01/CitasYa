/**
 * POST /api/admin/auto-complete-expired
 * Endpoint para completar manualmente citas expiradas (respaldo del worker)
 *
 * Este endpoint completa todas las citas PENDING o CONFIRMED que ya pasaron su fecha/hora
 * marcándolas como COMPLETED. Es útil como respaldo si el worker no está corriendo.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/utils";
import { autoCompleteExpiredAppointments } from "@/services/appointment.service";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(apiError("Unauthorized"), { status: 401 });
    }

    // Solo permitir a owners y admins
    const role = session.user.role;
    if (role !== "OWNER" && role !== "ADMIN") {
      return NextResponse.json(
        apiError("Solo owners y admins pueden ejecutar esta acción"),
        { status: 403 }
      );
    }

    const count = await autoCompleteExpiredAppointments();

    return NextResponse.json(
      apiSuccess({
        message: `${count} cita(s) completada(s) automáticamente`,
        completedCount: count,
      })
    );
  } catch (error) {
    console.error("Error en auto-complete-expired:", error);
    return NextResponse.json(
      apiError("Error al completar citas expiradas"),
      { status: 500 }
    );
  }
}
