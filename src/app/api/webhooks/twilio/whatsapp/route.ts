/**
 * Webhook Twilio: mensajes entrantes de WhatsApp
 *
 * Recibe mensajes de Twilio y los guarda en la base de datos para el chat.
 *
 * BOT DESACTIVADO: Solo guarda mensajes. Las confirmaciones/cancelaciones
 * salientes van por notification.service.ts + getWhatsAppProvider().
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

    // Extract message details - Using WaId as phone number and Body as content
    const toRaw = params.To || "";
    const accountSid = params.AccountSid;
    const waId = params.WaId; // Phone number from Twilio (e.g., 573206131892)
    const body = params.Body || "";
    const messageSid = params.MessageSid;
    const from = params.From; // Full format (e.g., whatsapp:+573206131892)

    if (!waId || !body || !accountSid) {
      console.log("[Twilio Webhook] Missing required fields. WaId:", waId, "Body:", body, "AccountSid:", accountSid);
      return new NextResponse(null, { status: 200 });
    }

    // Use WaId directly as phoneE164 (it's the clean phone number without prefix)
    // Optionally add + if it doesn't have it
    const phoneE164 = waId.startsWith("+") ? waId : `+${waId}`;

    console.log("[Twilio Webhook] Processing message:");
    console.log("  From (WaId):", waId);
    console.log("  To:", toRaw);
    console.log("  Body:", body);
    console.log("  PhoneE164:", phoneE164);

    // Find business by Twilio WhatsApp number (To field)
    const business = await prisma.business.findFirst({
      where: {
        twilioWhatsAppNumber: toRaw,
        isActive: true,
      },
    });

    if (!business) {
      console.log("[Twilio Webhook] Business not found for WhatsApp number:", toRaw);

      // Fallback: Try to find any active business
      const fallbackBusiness = await prisma.business.findFirst({
        where: {
          isActive: true,
        },
      });

      if (fallbackBusiness) {
        console.log("[Twilio Webhook] Using fallback business:", fallbackBusiness.name);

        await saveIncomingMessage(
          fallbackBusiness.id,
          phoneE164,
          body,
          {
            provider: "twilio",
            messageSid,
            to: toRaw,
            waId,
          },
          messageSid
        );

        console.log("[Twilio Webhook] Message saved from:", phoneE164, "to fallback business:", fallbackBusiness.name);
      } else {
        console.log("[Twilio Webhook] No active businesses found, message not saved");
      }

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
        waId,
      },
      messageSid
    );

    console.log("[Twilio Webhook] Message saved from:", phoneE164, "to business:", business.name);

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("[Twilio Webhook] Error:", error);
    // Still return 200 to avoid retries from Twilio
    return new NextResponse(null, { status: 200 });
  }
}
