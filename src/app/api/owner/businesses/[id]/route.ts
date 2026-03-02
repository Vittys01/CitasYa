/**
 * GET    /api/owner/businesses/[id]  — detail with members
 * PATCH  /api/owner/businesses/[id]  — update name / slug / isActive
 * DELETE /api/owner/businesses/[id]  — delete (cascade)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/utils";
import { z } from "zod";

async function getOwnedBusiness(session: Awaited<ReturnType<typeof auth>>, id: string) {
  if (!session) return null;
  if (session.user.role !== "OWNER") return null;
  return prisma.business.findFirst({ where: { id, ownerId: session.user.id } });
}

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones")
    .optional(),
  isActive: z.boolean().optional(),
  // WhatsApp
  whatsappProvider: z.enum(["evolution", "meta", ""]).optional(),
  whatsappInstanceName: z.string().max(100).optional().nullable(),
  metaPhoneNumberId: z.string().max(100).optional().nullable(),
  metaAccessToken: z.string().max(500).optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });
  if (session.user.role !== "OWNER") return NextResponse.json(apiError("Forbidden"), { status: 403 });

  const business = await prisma.business.findFirst({
    where: { id, ownerId: session.user.id },
    include: {
      members: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          manicurist: { select: { id: true, color: true, isActive: true } },
        },
      },
      manicurists: {
        include: {
          user: {
            select: { id: true, name: true, email: true, isActive: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: {
          appointments: true,
          clients: true,
          services: true,
        },
      },
    },
  });

  if (!business) return NextResponse.json(apiError("Not found"), { status: 404 });

  return NextResponse.json(apiSuccess(business));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const biz = await getOwnedBusiness(session, id);
  if (!biz) return NextResponse.json(apiError(!session ? "Unauthorized" : "Forbidden"), { status: !session ? 401 : 403 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError(parsed.error.message, "VALIDATION"), { status: 422 });
  }

  if (parsed.data.slug && parsed.data.slug !== biz.slug) {
    const conflict = await prisma.business.findUnique({ where: { slug: parsed.data.slug } });
    if (conflict) return NextResponse.json(apiError("El slug ya está en uso", "SLUG_TAKEN"), { status: 409 });
  }

  const { whatsappProvider, ...rest } = parsed.data;

  const updated = await prisma.business.update({
    where: { id },
    data: {
      ...rest,
      // Empty string means "remove" the provider
      ...(whatsappProvider !== undefined
        ? { whatsappProvider: whatsappProvider === "" ? null : whatsappProvider }
        : {}),
    },
  });

  return NextResponse.json(apiSuccess(updated));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const biz = await getOwnedBusiness(session, id);
  if (!biz) return NextResponse.json(apiError(!session ? "Unauthorized" : "Forbidden"), { status: !session ? 401 : 403 });

  await prisma.business.delete({ where: { id } });

  return NextResponse.json(apiSuccess({ deleted: true }));
}
