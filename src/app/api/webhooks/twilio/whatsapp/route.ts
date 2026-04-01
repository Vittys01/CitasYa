/**
 * Webhook Twilio: mensajes entrantes de WhatsApp — BOT DESHABILITADO.
 *
 * Respondemos 200 vacío para que Twilio no reintente errores. Si no usás el bot,
 * en Twilio Console podés vaciar "When a message comes in" para evitar POSTs innecesarios.
 *
 * Las confirmaciones/cancelaciones salientes no pasan por aquí: van por la API de Twilio
 * en `notification.service.ts` + `getWhatsAppProvider()`.
 *
 * Implementación anterior del bot (firma, `handleTwilioInboundMessage`, etc.): historial de git
 * en este archivo y en `src/services/whatsapp-bot.service.ts`.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return new NextResponse(null, { status: 200 });
}

/* ─── Código anterior (referencia; descomentar y restaurar el servicio si reactivás el bot) ───
import { NextRequest, NextResponse } from "next/server";
import { validateTwilioSignature } from "@/lib/twilio-signature";
import {
  getAuthTokenForTwilioWebhook,
  handleTwilioInboundMessage,
  resolveBusinessForTwilioInbound,
} from "@/services/whatsapp-bot.service";

function formBodyToRecord(form: FormData): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v === "string") params[k] = v;
  }
  return params;
}

function publicWebhookUrl(req: NextRequest): string {
  const base = process.env.TWILIO_WEBHOOK_BASE_URL?.replace(/\/$/, "");
  if (base) {
    return `${base}${req.nextUrl.pathname}`;
  }
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  return `${proto}://${host}${req.nextUrl.pathname}`;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const params = formBodyToRecord(form);
  const signature = req.headers.get("X-Twilio-Signature");
  const skipValidation =
    process.env.TWILIO_SKIP_SIGNATURE_VALIDATION?.trim().toLowerCase() === "true";
  if (!skipValidation) {
    const toRaw = params.To ?? "";
    const accountSid = params.AccountSid;
    const business = await resolveBusinessForTwilioInbound({ toRaw, accountSid });
    if (!business) {
      return new NextResponse("Business not found", { status: 404 });
    }
    const token = getAuthTokenForTwilioWebhook(business);
    if (!token) {
      return new NextResponse("Twilio auth not configured", { status: 500 });
    }
    const url = publicWebhookUrl(req);
    if (!validateTwilioSignature(token, signature, url, params)) {
      console.warn("[Twilio webhook] Invalid signature for URL:", url);
      return new NextResponse("Forbidden", { status: 403 });
    }
  }
  await handleTwilioInboundMessage(params);
  return new NextResponse(null, { status: 200 });
}
*/
