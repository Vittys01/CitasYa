/**
 * Meta WhatsApp Cloud API webhook endpoint.
 * - GET:  Webhook verification challenge
 * - POST: Incoming message events (optional, for future two-way conversations)
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
    console.log("[Webhook] Meta webhook verified");
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  // For future: handle inbound messages (e.g., client replies "CONFIRMAR")
  const body = await req.json();
  console.log("[Webhook] Incoming WhatsApp event:", JSON.stringify(body, null, 2));

  // Always return 200 quickly so Meta doesn't retry
  return NextResponse.json({ received: true });
}
