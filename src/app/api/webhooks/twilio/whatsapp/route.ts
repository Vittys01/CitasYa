/**
 * Webhook Twilio: mensajes entrantes de WhatsApp
 *
 * Recibe mensajes de Twilio y los guarda en la base de datos para el chat.
 *
 * Las confirmaciones/cancelaciones salientes no pasan por aquí: van por la API de Twilio
 * en `notification.service.ts` + `getWhatsAppProvider()`.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saveIncomingMessage } from "@/services/whatsapp-chat.service";

export const runtime = "nodejs";

function formBodyToRecord(form: FormData): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v === "string") params[k] = v;
  }
  return params;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const params = formBodyToRecord(form);

    console.log("[Twilio Webhook] Incoming message:", params);

    // Extract message details
    const toRaw = params.To || "";
    const accountSid = params.AccountSid;
    const from = params.From; // E.164 format from Twilio (whatsapp:+1234567890)
    const body = params.Body || "";
    const messageSid = params.MessageSid;

    if (!from || !body || !accountSid) {
      console.log("[Twilio Webhook] Missing required fields");
      return new NextResponse(null, { status: 200 });
    }

    // Extract E.164 phone number from Twilio format
    const phoneE164 = from.replace("whatsapp:", "").trim();

    // Find business by Twilio Account SID
    const business = await prisma.business.findFirst({
      where: {
        twilioAccountSid: accountSid,
        isActive: true,
      },
    });

    if (!business) {
      console.log("[Twilio Webhook] Business not found for account SID:", accountSid);
      return new NextResponse(null, { status: 200 });
    }

    // Save incoming message to database
    await saveIncomingMessage(
      business.id,
      phoneE164,
      body,
      {
        provider: "twilio",
        messageSid,
        to: toRaw,
      },
      messageSid
    );

    console.log("[Twilio Webhook] Message saved from:", phoneE164, "to business:", business.name);

    // Respond 200 OK to Twilio
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("[Twilio Webhook] Error:", error);
    // Still return 200 to avoid retries from Twilio
    return new NextResponse(null, { status: 200 });
  }
}
