/**
 * GET /api/dashboard
 * Query params:
 *   from — ISO date (default: start of current month)
 *   to   — ISO date (default: today)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiError, apiSuccess, now, canaryDate, getCanaryDateString } from "@/lib/utils";
import { getDashboardStats, getManicuristProductivity } from "@/services/dashboard.service";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });

  const { searchParams } = req.nextUrl;

  const canaryNow = now();
  const nowStr = getCanaryDateString(canaryNow);
  const [y, m] = nowStr.split("-").map(Number);
  const defaultFrom = canaryDate(`${y}-${String(m).padStart(2, "0")}-01`, 0, 0);

  const from = searchParams.get("from")
    ? canaryDate(searchParams.get("from")!.slice(0, 10), 0, 0)
    : defaultFrom;
  const to = searchParams.get("to")
    ? canaryDate(searchParams.get("to")!.slice(0, 10), 23, 59, 59)
    : canaryDate(nowStr, 23, 59, 59);

  const isManicurist = session.user.role === "MANICURIST";
  const manicuristId = isManicurist ? (session.user.manicuristId ?? undefined) : undefined;
  const businessId = session.user.businessId ?? undefined;

  const [stats, productivity] = await Promise.all([
    getDashboardStats(from, to, { businessId, manicuristId }),
    isManicurist ? Promise.resolve([]) : getManicuristProductivity(from, to, businessId),
  ]);

  return NextResponse.json(apiSuccess({ stats, productivity }));
}
