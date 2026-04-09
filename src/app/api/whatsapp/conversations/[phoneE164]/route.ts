/**
 * API endpoint para obtener conversación con un contacto específico
 */

import { auth } from "@/lib/auth";
import { getConversation } from "@/services/whatsapp-chat.service";
import { NextResponse } from "next/server";

type Params = {
  params: Promise<{ phoneE164: string }>
}

export async function GET(
  req: Request,
  { params }: Params
) {
  try {
    const session = await auth();
    const businessId = session?.user.businessId;
    if (!businessId) {
      return NextResponse.json({ error: "No business found" }, { status: 401 });
    }

    const { phoneE164 } = await params;
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const phoneDecoded = decodeURIComponent(phoneE164);
    const result = await getConversation(businessId, phoneDecoded, page, limit);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[WhatsApp Conversation API] Error:", error);
    return NextResponse.json(
      { error: "Error al obtener conversación" },
      { status: 500 }
    );
  }
}
