/**
 * API endpoint para listar contactos de WhatsApp
 */

import { auth } from "@/lib/auth";
import { getContacts } from "@/services/whatsapp-chat.service";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const businessId = session?.user.businessId;
    if (!businessId) {
      return NextResponse.json({ error: "No business found" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const result = await getContacts(businessId, query, page, limit);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[WhatsApp Contacts API] Error:", error);
    return NextResponse.json(
      { error: "Error al obtener contactos" },
      { status: 500 }
    );
  }
}
