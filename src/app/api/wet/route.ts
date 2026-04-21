/**
 * Twilio WhatsApp Webhook Endpoint
 *
 * Endpoint para recibir mensajes entrantes de Twilio WhatsApp y procesarlos con el bot.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saveIncomingMessage } from "@/services/whatsapp-chat.service";
import { handleTwilioWhatsAppMessage } from "@/services/whatsapp-bot-twilio.service";
import { now } from "@/lib/utils";
import crypto from "crypto";

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export type TwilioInboundForm = Record<string, string>;

// ─── Validación de Firma Twilio ─────────────────────────────────────────────

/**
 * Valida que el request viene realmente de Twilio
 */
function validateTwilioSignature(
  body: string,
  url: string,
  signature: string
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!authToken) {
    console.warn(
      "[Twilio Webhook] TWILIO_AUTH_TOKEN not found, skipping signature validation"
    );
    // En desarrollo, podemos saltar la validación
    return process.env.TWILIO_SKIP_SIGNATURE_VALIDATION === "true";
  }

  try {
    const computedSignature = crypto
      .createHmac("sha1", authToken)
      .update(url + body)
      .digest("base64");

    return crypto.timingSafeEqual(
      Buffer.from(computedSignature),
      Buffer.from(signature)
    );
  } catch (error) {
    console.error("[Twilio Webhook] Error validating signature:", error);
    return false;
  }
}

/**
 * Obtiene el token de autenticación para validación de firma
 */
function getAuthTokenForTwilioWebhook(business: {
  twilioAuthToken: string | null;
}): string {
  return business.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN || "";
}

// ─── GET: Twilio Webhook Validation (Opcional) ───────────────────────

export async function GET(req: NextRequest) {
  // Twilio también puede hacer GET para validación inicial
  return new NextResponse("OK", { status: 200 });
}

// ─── POST: Twilio Incoming Message Handler ───────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Obtener el body como texto (para validación de firma)
    const bodyText = await req.text();

    console.log("[Twilio Webhook] Incoming request:", bodyText);

    // Convertir el body a FormData para fácil acceso
    const formData = new URLSearchParams(bodyText);
    const form: TwilioInboundForm = {};
    formData.forEach((value, key) => {
      form[key] = value;
    });

    // Validar la firma de Twilio
    const signature = req.headers.get("X-Twilio-Signature") || "";
    const url = req.url;

    if (!validateTwilioSignature(bodyText, url, signature)) {
      console.error("[Twilio Webhook] Invalid signature received");
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Extraer información del mensaje
    const messageSid = form["MessageSid"] || "";
    const from = form["From"] || "";
    const to = form["To"] || "";
    const body = form["Body"] || "";

    if (!from || !body) {
      console.log("[Twilio Webhook] Missing required fields");
      return new NextResponse("OK", { status: 200 }); // Devolver 200 para que Twilio no reintente
    }

    console.log(
      `[Twilio Webhook] Message from ${from} to ${to}: "${body}"`
    );

    // Identificar el negocio por el número destino
    const business = await resolveBusinessForTwilioInbound({
      toRaw: to,
      accountSid: form["AccountSid"],
    });

    if (!business) {
      console.error(
        `[Twilio Webhook] Business not found for number ${to}`
      );
      return new NextResponse("OK", { status: 200 });
    }

    // Normalizar el número de origen
    const normalisedFrom = normalisePhone(from);
    const normalisedTo = normalisePhone(to);

    // Guardar el mensaje entrante en la base de datos
    await saveIncomingMessage(
      business.id,
      normalisedFrom,
      body,
      {
        provider: "twilio",
        messageId: messageSid,
        timestamp: form["SmsTimestamp"] || now().toISOString(),
        from: normalisedFrom,
        to: normalisedTo,
      },
      messageSid
    );

    console.log(
      "[Twilio Webhook] Message saved from:",
      normalisedFrom,
      "to business:",
      business.name
    );

    // Trigger WhatsApp bot para procesar el mensaje
    try {
      await handleTwilioWhatsAppMessage(
        business.id,
        normalisedFrom,
        body
      );
    } catch (botError) {
      console.error("[Twilio Webhook] Error processing bot message:", botError);
      // No fallar la respuesta del webhook si el bot falla
    }

    // Devolver respuesta inmediata a Twilio (TwiML opcional)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`;

    return new NextResponse(twiml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml",
      },
    });
  } catch (error) {
    console.error("[Twilio Webhook] Error processing request:", error);

    // Devolver 200 para que Twilio no reintente
    return new NextResponse("OK", { status: 200 });
  }
}

// ─── Funciones de Ayuda ─────────────────────────────────────────────────────

/**
 * Resuelve el negocio para mensajes entrantes de Twilio
 */
async function resolveBusinessForTwilioInbound(params: {
  toRaw: string;
  accountSid?: string;
}) {
  const { toRaw, accountSid } = params;

  // Normalizar el número destino
  const normalisedTo = normalisePhone(toRaw);

  // Primero, buscar por número de WhatsApp configurado
  const businessByPhone = await prisma.business.findFirst({
    where: {
      twilioWhatsAppNumber: normalisedTo,
      isActive: true,
    },
  });

  if (businessByPhone) {
    return businessByPhone;
  }

  // Segundo, buscar por Account SID (si se proporciona)
  if (accountSid) {
    const businessByAccountSid = await prisma.business.findFirst({
      where: {
        twilioAccountSid: accountSid,
        isActive: true,
      },
    });

    if (businessByAccountSid) {
      return businessByAccountSid;
    }
  }

  // Tercero, usar el primer negocio activo como fallback
  const firstBusiness = await prisma.business.findFirst({
    where: {
      isActive: true,
    },
  });

  return firstBusiness;
}

/**
 * Normaliza un número de teléfono a formato E.164
 */
function normalisePhone(raw: string): string {
  // Eliminar prefijos de WhatsApp (whatsapp:+...)
  let cleaned = raw.replace(/^whatsapp:/i, "");

  // Eliminar espacios, guiones, paréntesis
  cleaned = cleaned.replace(/[\s\-\(\)]/g, "");

  // Si ya tiene el código de país con +, devolver tal cual
  if (cleaned.startsWith("+")) {
    return cleaned;
  }

  // Si empieza con código de país sin +, agregar +
  const countryCodeMatch = cleaned.match(/^(\d{1,3})(.*)/);
  if (countryCodeMatch) {
    const countryCode = countryCodeMatch[1];
    const number = countryCodeMatch[2];

    // Códigos comunes de país (solo algunos ejemplos)
    const commonCountryCodes = ["1", "54", "55", "34", "39", "33", "44", "49"];
    if (commonCountryCodes.includes(countryCode)) {
      return `+${cleaned}`;
    }
  }

  // Default: agregar +54 (Argentina) si parece un número local
  if (cleaned.length === 10) {
    return `+54${cleaned}`;
  }

  // Si no coincide, asumir que ya está en formato correcto
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

// ─── Exportaciones ─────────────────────────────────────────────────────────────

