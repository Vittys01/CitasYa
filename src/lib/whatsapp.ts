/**
 * WhatsApp abstraction layer.
 *
 * Supports two providers via WHATSAPP_PROVIDER env var:
 *   - "evolution"  → Evolution API (self-hosted, open-source)
 *   - "meta"       → Meta Cloud API (official, requires approval)
 *
 * To add a new provider: implement the WhatsAppProvider interface below.
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

// ─── Evolution API Provider ───────────────────────────────────────────────────

class EvolutionProvider implements WhatsAppProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly instance: string;

  constructor() {
    this.baseUrl = process.env.EVOLUTION_API_URL ?? "http://localhost:8080";
    this.apiKey = process.env.EVOLUTION_API_KEY ?? "";
    this.instance = process.env.EVOLUTION_INSTANCE ?? "default";
  }

  async sendText({ to, body }: WhatsAppMessage): Promise<WhatsAppSendResult> {
    try {
      const res = await fetch(
        `${this.baseUrl}/message/sendText/${this.instance}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: this.apiKey,
          },
          body: JSON.stringify({
            number: to.replace("+", ""),
            text: body,
          }),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        return { success: false, error: `Evolution API error ${res.status}: ${text}` };
      }

      const data = (await res.json()) as { key?: { id?: string }; id?: string };
      return { success: true, externalId: data?.key?.id ?? data?.id };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
}

// ─── Meta Cloud API Provider ──────────────────────────────────────────────────

class MetaProvider implements WhatsAppProvider {
  private readonly token: string;
  private readonly phoneNumberId: string;

  constructor() {
    this.token = process.env.META_WHATSAPP_TOKEN ?? "";
    this.phoneNumberId = process.env.META_PHONE_NUMBER_ID ?? "";
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

function createProvider(): WhatsAppProvider {
  const provider = process.env.WHATSAPP_PROVIDER ?? "evolution";
  if (provider === "meta") return new MetaProvider();
  return new EvolutionProvider();
}

export const whatsapp = createProvider();

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
