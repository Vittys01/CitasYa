/**
 * POST /api/whatsapp/qr-receiver
 *
 * Recibe el evento QRCODE_UPDATED de Evolution API y guarda el QR base64 en Redis.
 * Evolution está configurado para enviar este webhook cuando genera un nuevo código QR.
 */

import { NextRequest, NextResponse } from "next/server";
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const INSTANCE = process.env.EVOLUTION_INSTANCE ?? "dates-instance";
const QR_REDIS_KEY = `whatsapp:qr:${INSTANCE}`;
const QR_TTL_SECONDS = 60;

let redis: IORedis | null = null;

function getRedis(): IORedis {
  if (!redis || redis.status === "end") {
    redis = new IORedis(REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: false });
  }
  return redis;
}

type EvolutionQrEvent = {
  event?: string;
  instance?: string;
  data?: {
    qrcode?: {
      base64?: string;
      code?: string;
      pairingCode?: string;
    };
    base64?: string;
    code?: string;
    pairingCode?: string;
  };
  // fallback — some versions send fields at root level
  base64?: string;
  code?: string;
  pairingCode?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as EvolutionQrEvent;

    const nested = body.data?.qrcode ?? body.data ?? {};
    const base64 =
      nested.base64 ??
      body.base64 ??
      (typeof nested.code === "string" ? nested.code : undefined) ??
      (typeof body.code === "string" ? body.code : undefined);

    const pairingCode = nested.pairingCode ?? body.pairingCode ?? undefined;

    if (base64 || pairingCode) {
      const payload = JSON.stringify({ base64: base64 ?? null, pairingCode: pairingCode ?? null });
      await getRedis().set(QR_REDIS_KEY, payload, "EX", QR_TTL_SECONDS);
    }

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ received: false }, { status: 400 });
  }
}
