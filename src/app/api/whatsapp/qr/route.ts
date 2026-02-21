/**
 * GET /api/whatsapp/qr
 *
 * Llama directamente a GET /instance/connect/{instance} de Evolution API,
 * que devuelve el QR (base64) o pairingCode de forma síncrona.
 * Sin WebSocket → sin problemas de timing.
 */

import { NextRequest, NextResponse } from "next/server";

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL ?? "http://localhost:8080";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY ?? "";
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE ?? "dates-instance";

export async function GET(req: NextRequest) {
  if (process.env.WHATSAPP_PROVIDER !== "evolution") {
    return NextResponse.json(
      { error: "Solo disponible con WHATSAPP_PROVIDER=evolution" },
      { status: 400 }
    );
  }
  if (!EVOLUTION_API_KEY) {
    return NextResponse.json({ error: "EVOLUTION_API_KEY no está configurada" }, { status: 500 });
  }

  const number = req.nextUrl.searchParams.get("number")?.replace(/\D/g, "") ?? "";
  const connectUrl = number
    ? `${EVOLUTION_API_URL}/instance/connect/${EVOLUTION_INSTANCE}?number=${number}`
    : `${EVOLUTION_API_URL}/instance/connect/${EVOLUTION_INSTANCE}`;

  try {
    const res = await fetch(connectUrl, {
      method: "GET",
      headers: { apikey: EVOLUTION_API_KEY },
      // 20 s debería ser más que suficiente para la llamada REST
      signal: AbortSignal.timeout(20_000),
    });

    const data = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      return NextResponse.json(
        { error: `Evolution respondió ${res.status}`, detail: data },
        { status: res.status }
      );
    }

    // Evolution puede devolver la imagen en distintos niveles del JSON
    const qr = data?.qrcode as Record<string, unknown> | undefined;
    const base64 =
      (qr?.base64 ?? data?.base64 ?? data?.code) as string | null ?? null;
    const pairingCode =
      (qr?.pairingCode ?? data?.pairingCode) as string | null ?? null;

    if (!base64 && !pairingCode) {
      // La instancia podría ya estar conectada
      const state = (data?.state ?? data?.status ?? data?.instance) as string | undefined;
      if (state) {
        return NextResponse.json(
          { error: `La instancia está en estado: ${state}. Si ya está conectada, no necesita QR.` },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Evolution no devolvió QR ni código. Asegurate de que la instancia esté desconectada y sin número.", detail: data },
        { status: 502 }
      );
    }

    return NextResponse.json({ base64: base64 ?? null, pairingCode: pairingCode ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `No se pudo contactar Evolution API: ${message}` },
      { status: 502 }
    );
  }
}
