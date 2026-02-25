import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/utils";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  duration: z.number().int().min(15).max(480).optional(),
  price: z.number().positive().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  isActive: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OWNER") {
    return NextResponse.json(apiError("Forbidden"), { status: 403 });
  }
  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json(apiError("No business context"), { status: 403 });

  const { id } = await params;
  const existing = await prisma.service.findFirst({ where: { id, businessId } });
  if (!existing) return NextResponse.json(apiError("Servicio no encontrado"), { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError(parsed.error.message, "VALIDATION"), { status: 422 });
  }

  const service = await prisma.service.update({ where: { id }, data: parsed.data });
  return NextResponse.json(apiSuccess(service));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OWNER") {
    return NextResponse.json(apiError("Forbidden"), { status: 403 });
  }
  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json(apiError("No business context"), { status: 403 });

  const { id } = await params;
  const existing = await prisma.service.findFirst({ where: { id, businessId } });
  if (!existing) return NextResponse.json(apiError("Servicio no encontrado"), { status: 404 });

  const apptCount = await prisma.appointment.count({ where: { serviceId: id } });
  if (apptCount > 0) {
    return NextResponse.json(
      apiError(
        `Este servicio tiene ${apptCount} turno${apptCount === 1 ? "" : "s"} asociado${apptCount === 1 ? "" : "s"}. Archivalo en lugar de eliminarlo.`,
        "HAS_APPOINTMENTS"
      ),
      { status: 409 }
    );
  }

  await prisma.service.delete({ where: { id } });
  return NextResponse.json(apiSuccess({ id }));
}
