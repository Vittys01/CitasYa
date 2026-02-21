/**
 * PUT /api/manicurists/:id/schedule
 * Replace all schedules for a manicurist (upsert by dayOfWeek)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/utils";
import { z } from "zod";

const scheduleSchema = z.array(
  z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    isActive: z.boolean().default(true),
  })
);

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });

  const { id } = await params;

  // Manicurists can edit their own; admins can edit anyone
  const manicurist = await prisma.manicurist.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!manicurist) return NextResponse.json(apiError("Not found"), { status: 404 });

  if (
    session.user.role !== "ADMIN" &&
    session.user.id !== manicurist.userId
  ) {
    return NextResponse.json(apiError("Forbidden"), { status: 403 });
  }

  const body = await req.json();
  const parsed = scheduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError(parsed.error.message, "VALIDATION"), { status: 422 });
  }

  // Upsert each day
  const results = await prisma.$transaction(
    parsed.data.map((s) =>
      prisma.schedule.upsert({
        where: { manicuristId_dayOfWeek: { manicuristId: id, dayOfWeek: s.dayOfWeek } },
        update: { startTime: s.startTime, endTime: s.endTime, isActive: s.isActive },
        create: { manicuristId: id, ...s },
      })
    )
  );

  return NextResponse.json(apiSuccess(results));
}
