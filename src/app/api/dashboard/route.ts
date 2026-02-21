/**
 * GET /api/dashboard
 * Query params:
 *   from — ISO date (default: start of current month)
 *   to   — ISO date (default: today)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/utils";
import { getDashboardStats, getManicuristProductivity } from "@/services/dashboard.service";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });

  const { searchParams } = req.nextUrl;

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);

  const from = new Date(searchParams.get("from") ?? defaultFrom.toISOString());
  const to = new Date(searchParams.get("to") ?? now.toISOString());

  const [stats, productivity] = await Promise.all([
    getDashboardStats(from, to),
    getManicuristProductivity(from, to),
  ]);

  return NextResponse.json(apiSuccess({ stats, productivity }));
}
