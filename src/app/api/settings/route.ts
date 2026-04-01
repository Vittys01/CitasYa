import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveBusinessIdFromSession } from "@/lib/resolve-business-session";
import { apiError, apiSuccess, canAccessStaffFeatures } from "@/lib/utils";
import { z } from "zod";

const patchSchema = z.record(z.string(), z.string());

/** PATCH /api/settings  — body: { key: value, ... }  (admin/owner only) */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });
  if (!canAccessStaffFeatures(session.user.role)) {
    return NextResponse.json(apiError("Forbidden"), { status: 403 });
  }
  const businessId = await resolveBusinessIdFromSession(session);
  if (!businessId) return NextResponse.json(apiError("No business context"), { status: 403 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError("Invalid payload"), { status: 422 });
  }

  const updates = await Promise.all(
    Object.entries(parsed.data).map(([key, value]) =>
      prisma.appSetting.upsert({
        where:  { businessId_key: { businessId, key } },
        update: { value },
        create: { businessId, key, value },
      })
    )
  );

  return NextResponse.json(apiSuccess(updates));
}
