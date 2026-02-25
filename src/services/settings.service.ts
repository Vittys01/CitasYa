import { prisma } from "@/lib/db";

/** All app labels/config key-value map from DB for a business. */
export async function getAppSettings(businessId: string): Promise<Record<string, string>> {
  const rows = await prisma.appSetting.findMany({
    where: { businessId },
    select: { key: true, value: true },
  });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** Get a single setting value with optional fallback. */
export function getSetting(settings: Record<string, string>, key: string, fallback = ""): string {
  return settings[key] ?? fallback;
}
