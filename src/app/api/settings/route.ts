import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/utils";
import { z } from "zod";

const patchSchema = z.record(z.string(), z.string());

/** PATCH /api/settings  — body: { key: value, ... }  (admin only) */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(apiError("Forbidden"), { status: 403 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError("Invalid payload"), { status: 422 });
  }

  const updates = await Promise.all(
    Object.entries(parsed.data).map(([key, value]) =>
      prisma.appSetting.upsert({
        where:  { key },
        update: { value },
        create: { key, value },
      })
    )
  );

  return NextResponse.json(apiSuccess(updates));
}
