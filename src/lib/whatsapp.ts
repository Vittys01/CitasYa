/**
 * WhatsApp abstraction layer — Meta Cloud API only.
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

// ─── Factory ──────────────────────────────────────────────────────────────────

export const whatsapp = new MetaProvider();

/** Provider for a given business. Uses per-business Meta config if available, else env vars. */
export function getProviderForBusiness(business: {
  whatsappProvider?: string | null;
  metaPhoneNumberId?: string | null;
  metaAccessToken?: string | null;
} | null): WhatsAppProvider {
  if (!business || business.whatsappProvider !== "meta") {
    return new MetaProvider();
  }
  const token = business.metaAccessToken?.trim();
  const phoneId = business.metaPhoneNumberId?.trim();
  if (token && phoneId) {
    return new MetaProvider({ token, phoneNumberId: phoneId });
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
