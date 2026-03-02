/**
 * GET  /api/owner/businesses  — list all businesses owned by the current OWNER
 * POST /api/owner/businesses  — create a new business
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/utils";
import { z } from "zod";

function requireOwner(session: Awaited<ReturnType<typeof auth>>) {
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });
  if (session.user.role !== "OWNER") return NextResponse.json(apiError("Forbidden"), { status: 403 });
  return null;
}

const createSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones"),
});

export async function GET() {
  const session = await auth();
  const err = requireOwner(session);
  if (err) return err;

  const businesses = await prisma.business.findMany({
    where: { ownerId: session!.user.id },
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          members: true,
          manicurists: true,
          appointments: true,
        },
      },
    },
  });

  return NextResponse.json(apiSuccess(businesses));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const err = requireOwner(session);
  if (err) return err;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError(parsed.error.message, "VALIDATION"), { status: 422 });
  }

  const existing = await prisma.business.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) {
    return NextResponse.json(apiError("El slug ya está en uso", "SLUG_TAKEN"), { status: 409 });
  }

  const business = await prisma.business.create({
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      ownerId: session!.user.id,
    },
  });

  return NextResponse.json(apiSuccess(business), { status: 201 });
}
