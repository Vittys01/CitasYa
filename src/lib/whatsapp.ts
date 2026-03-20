/**
 * WhatsApp abstraction layer — Meta Cloud API & Twilio.
 */

export interface WhatsAppMessage {
  to: string;   // E.164 phone number, e.g. "+5491112345678"
  body: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

interface WhatsAppProvider {
  sendText(msg: WhatsAppMessage): Promise<WhatsAppSendResult>;
}

// ─── Meta Cloud API Provider ──────────────────────────────────────────────────

class MetaProvider implements WhatsAppProvider {
  private readonly token: string;
  private readonly phoneNumberId: string;

  constructor(config?: { token?: string; phoneNumberId?: string }) {
    this.token = config?.token ?? process.env.META_WHATSAPP_TOKEN ?? "";
    this.phoneNumberId = config?.phoneNumberId ?? process.env.META_PHONE_NUMBER_ID ?? "";
  }

  async sendText({ to, body }: WhatsAppMessage): Promise<WhatsAppSendResult> {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v20.0/${this.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to,
            type: "text",
            text: { preview_url: false, body },
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        return {
          success: false,
          error: `Meta API error ${res.status}: ${JSON.stringify(data)}`,
        };
      }

      const data = (await res.json()) as { messages?: { id?: string }[] };
      return { success: true, externalId: data?.messages?.[0]?.id };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
}

// ─── Twilio Provider ───────────────────────────────────────────────────────────

class TwilioProvider implements WhatsAppProvider {
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly fromNumber: string; // "whatsapp:+14155238886"

  constructor(config: { accountSid: string; authToken: string; fromNumber: string }) {
    this.accountSid = config.accountSid;
    this.authToken = config.authToken;
    this.fromNumber = config.fromNumber.startsWith("whatsapp:") ? config.fromNumber : `whatsapp:${config.fromNumber}`;
  }

  async sendText({ to, body }: WhatsAppMessage): Promise<WhatsAppSendResult> {
    try {
      const toWhatsApp = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");
      const form = new URLSearchParams({
        From: this.fromNumber,
        To: toWhatsApp,
        Body: body,
      });

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${auth}`,
        },
        body: form.toString(),
      });

      const data = (await res.json()) as { sid?: string; message?: string; code?: number };

      if (!res.ok) {
        return {
          success: false,
          error: `Twilio API error ${res.status}: ${data?.message ?? JSON.stringify(data)}`,
        };
      }

      return { success: true, externalId: data?.sid };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export const whatsapp = new MetaProvider();

/** Provider for a given business. Uses per-business config if available, else env vars. */
export function getProviderForBusiness(business: {
  whatsappProvider?: string | null;
  metaPhoneNumberId?: string | null;
  metaAccessToken?: string | null;
  twilioAccountSid?: string | null;
  twilioAuthToken?: string | null;
  twilioWhatsAppNumber?: string | null;
} | null): WhatsAppProvider {
  if (!business) {
    return new MetaProvider();
  }

  if (business.whatsappProvider === "twilio") {
    const sid = business.twilioAccountSid?.trim();
    const token = business.twilioAuthToken?.trim();
    const from = business.twilioWhatsAppNumber?.trim();
    if (sid && token && from) {
      return new TwilioProvider({ accountSid: sid, authToken: token, fromNumber: from });
    }
    const envSid = process.env.TWILIO_ACCOUNT_SID;
    const envToken = process.env.TWILIO_AUTH_TOKEN;
    const envFrom = process.env.TWILIO_WHATSAPP_NUMBER;
    if (envSid && envToken && envFrom) {
      return new TwilioProvider({ accountSid: envSid, authToken: envToken, fromNumber: envFrom });
    }
    throw new Error("Twilio config incompleta: configurá Twilio en el negocio o en .env");
  }

  if (business.whatsappProvider === "meta") {
    const token = business.metaAccessToken?.trim();
    const phoneId = business.metaPhoneNumberId?.trim();
    if (token && phoneId) {
      return new MetaProvider({ token, phoneNumberId: phoneId });
    }
  }

  return new MetaProvider();
}

// ─── Message templates ────────────────────────────────────────────────────────

/** Placeholders: {clientName}, {serviceName}, {manicuristName}, {date}, {time}. Use *text* for bold in WhatsApp. */
function applyTemplate(
  template: string,
  params: { clientName: string; serviceName: string; manicuristName: string; date: string; time: string }
): string {
  return template
    .replace(/\{clientName\}/g, params.clientName)
    .replace(/\{serviceName\}/g, params.serviceName)
    .replace(/\{manicuristName\}/g, params.manicuristName)
    .replace(/\{date\}/g, params.date)
    .replace(/\{time\}/g, params.time);
}

const DEFAULT_CONFIRMATION =
  "✅ *Turno confirmado*\n\nHola {clientName}! Tu turno ha sido agendado:\n\n📅 *Fecha:* {date}\n🕐 *Hora:* {time}\n💅 *Servicio:* {serviceName}\n👩‍🎨 *Profesional:* {manicuristName}\n\nSi necesitás cancelar o modificar, avisanos con al menos 2hs de anticipación. ¡Hasta pronto! 💖";

const DEFAULT_REMINDER =
  "⏰ *Recordatorio de turno*\n\nHola {clientName}! Te recordamos tu turno:\n\n📅 *Fecha:* {date}\n🕐 *Hora:* {time}\n💅 *Servicio:* {serviceName}\n👩‍🎨 *Profesional:* {manicuristName}\n\n¡Te esperamos! 💅✨";

const DEFAULT_CANCELLATION =
  "❌ *Turno cancelado*\n\nHola {clientName}. Tu turno del {date} a las {time} para *{serviceName}* ha sido cancelado.\n\nSi querés reagendar, escribinos cuando quieras. 🌸";

function formatDateLong(d: Date): string {
  return d.toLocaleDateString("es-AR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
function formatDateShort(d: Date): string {
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}
function formatTime(d: Date): string {
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export function buildConfirmationMessage(
  params: {
    clientName: string;
    serviceName: string;
    manicuristName: string;
    startAt: Date;
  },
  customTemplate?: string
): string {
  const template = (customTemplate?.trim() || DEFAULT_CONFIRMATION);
  return applyTemplate(template, {
    clientName: params.clientName,
    serviceName: params.serviceName,
    manicuristName: params.manicuristName,
    date: formatDateLong(params.startAt),
    time: formatTime(params.startAt),
  });
}

export function buildReminderMessage(
  params: {
    clientName: string;
    serviceName: string;
    manicuristName: string;
    startAt: Date;
  },
  customTemplate?: string
): string {
  const template = (customTemplate?.trim() || DEFAULT_REMINDER);
  return applyTemplate(template, {
    clientName: params.clientName,
    serviceName: params.serviceName,
    manicuristName: params.manicuristName,
    date: formatDateShort(params.startAt),
    time: formatTime(params.startAt),
  });
}

export function buildCancellationMessage(
  params: {
    clientName: string;
    serviceName: string;
    startAt: Date;
  },
  customTemplate?: string
): string {
  const template = (customTemplate?.trim() || DEFAULT_CANCELLATION);
  return applyTemplate(template, {
    clientName: params.clientName,
    serviceName: params.serviceName,
    manicuristName: "",
    date: formatDateShort(params.startAt),
    time: formatTime(params.startAt),
  });
}
