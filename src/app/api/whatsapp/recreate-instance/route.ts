/**
 * POST /api/whatsapp/recreate-instance
 *
 * Elimina la instancia actual de Evolution y crea una nueva SIN número,
 * para que el Manager muestre QR en lugar de pairing por número.
 * Requiere EVOLUTION_API_URL, EVOLUTION_API_KEY y EVOLUTION_INSTANCE.
 */

import { NextResponse } from "next/server";

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL ?? "http://localhost:8080";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY ?? "";
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE ?? "dates-instance";

export async function POST() {
  if (!EVOLUTION_API_KEY) {
    return NextResponse.json(
      { error: "EVOLUTION_API_KEY no está configurada" },
      { status: 500 }
    );
  }

  const base = EVOLUTION_API_URL.replace(/\/$/, "");
  const headers = {
    "Content-Type": "application/json",
    apikey: EVOLUTION_API_KEY,
  };

  try {
    // 1. Eliminar la instancia actual (puede devolver 404 si no existe)
    const deleteRes = await fetch(`${base}/instance/delete/${EVOLUTION_INSTANCE}`, {
      method: "DELETE",
      headers,
    });
    if (!deleteRes.ok && deleteRes.status !== 404) {
      const text = await deleteRes.text();
      return NextResponse.json(
        { error: `Error al eliminar instancia: ${deleteRes.status} ${text}` },
        { status: 502 }
      );
    }

    // Pequeña pausa para que Evolution libere la instancia
    await new Promise((r) => setTimeout(r, 1500));

    // 2. Crear instancia nueva SIN número → modo QR
    const createBody = {
      instanceName: EVOLUTION_INSTANCE,
      token: EVOLUTION_API_KEY,
      integration: "WHATSAPP-BAILEYS",
      // No enviamos "number" para que use QR en lugar de pairing por número
    };
    const createRes = await fetch(`${base}/instance/create`, {
      method: "POST",
      headers,
      body: JSON.stringify(createBody),
    });

    if (!createRes.ok) {
      const text = await createRes.text();
      return NextResponse.json(
        { error: `Error al crear instancia: ${createRes.status} ${text}` },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Instancia recreada sin número. Abrí el Manager y tocá «Get QR Code».",
    });
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
