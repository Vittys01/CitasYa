import { prisma } from "@/lib/db";

/** All app labels/config key-value map from DB. Use in server components and pass to client as needed. */
export async function getAppSettings(): Promise<Record<string, string>> {
  if (!prisma.appSetting) {
    return {};
  }
  const rows = await prisma.appSetting.findMany({ select: { key: true, value: true } });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** Get a single setting value with optional fallback. */
export function getSetting(settings: Record<string, string>, key: string, fallback = ""): string {
  return settings[key] ?? fallback;
}
