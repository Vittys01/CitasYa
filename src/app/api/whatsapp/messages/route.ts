/**
 * API endpoint para enviar mensajes de WhatsApp
 */

import { auth } from "@/lib/auth";
import { sendMessage } from "@/services/whatsapp-chat.service";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const session = await auth();
    const businessId = session?.user.businessId;
    if (!businessId) {
      return NextResponse.json({ error: "No business found" }, { status: 401 });
    }

    const body = await req.json();
    const { phoneE164, content } = body;

    if (!phoneE164 || !content || !content.trim()) {
      return NextResponse.json(
        { error: "PhoneE164 and content are required" },
        { status: 400 }
      );
    }

    const message = await sendMessage(businessId, phoneE164, content.trim());

    return NextResponse.json({ message });
  } catch (error) {
    console.error("[WhatsApp Messages API] Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Error al enviar mensaje";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
