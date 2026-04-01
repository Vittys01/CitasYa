/**
 * Resolución de businessId contra la BD (solo rutas/API Node).
 * No usar en middleware ni en callbacks de NextAuth: allí corre Edge y Prisma no está disponible.
 */
import "server-only";

import { prisma } from "@/lib/db";
import type { Session } from "next-auth";

export async function resolveBusinessIdFromSession(session: Session | null): Promise<string | null> {
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      businessId: true,
      manicurist: { select: { id: true, businessId: true } },
    },
  });
  if (!dbUser) return null;

  let businessId: string | null =
    dbUser.role === "MANICURIST"
      ? dbUser.manicurist?.businessId ?? null
      : dbUser.businessId ?? null;
  if (dbUser.role === "OWNER" && !businessId) {
    const first = await prisma.business.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });
    businessId = first?.id ?? null;
  }
  if (businessId) {
    const exists = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    });
    if (!exists) {
      businessId = null;
      if (dbUser.role === "OWNER") {
        const first = await prisma.business.findFirst({
          where: { ownerId: userId },
          select: { id: true },
        });
        businessId = first?.id ?? null;
      }
    }
  }
  return businessId;
}
