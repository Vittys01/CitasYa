/**
 * WhatsApp abstraction layer — Meta Cloud API & Twilio.
 */

export interface WhatsAppMessage {
  to: string;   // E.164 phone number, e.g. "+5491112345678"
  body: string;
}

/** Twilio Content API: plantilla aprobada ({{1}}, {{2}}, …) → claves "1", "2", … en JSON. */
export interface WhatsAppContentMessage {
  to: string;
  contentSid: string;
  variables: Record<string, string>;
}

/** Meta Cloud API: plantilla aprobada en WhatsApp Manager (mismas variables {{1}}… que en Twilio). */
export interface WhatsAppMetaTemplateMessage {
  to: string;
  templateName: string;
  /** Código de idioma de la plantilla, p. ej. `es_AR` o `es`. */
  languageCode: string;
  variables: Record<string, string>;
}

export interface WhatsAppSendResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

export interface WhatsAppProvider {
  sendText(msg: WhatsAppMessage): Promise<WhatsAppSendResult>;
  sendContentTemplate?(msg: WhatsAppContentMessage): Promise<WhatsAppSendResult>;
  sendMetaTemplate?(msg: WhatsAppMetaTemplateMessage): Promise<WhatsAppSendResult>;
}

/**
 * Lee Twilio desde .env. Incluye typo frecuente TWILIO_ACCOUUNT_SID → mismo valor que ACCOUNT.
 */
export function twilioCredentialsFromEnv(): { sid: string; token: string; from: string } | null {
  const sid =
    process.env.TWILIO_ACCOUNT_SID?.trim() ||
    process.env.TWILIO_ACCOUUNT_SID?.trim() ||
    "";
  const token = process.env.TWILIO_AUTH_TOKEN?.trim() || "";
  const from = process.env.TWILIO_WHATSAPP_NUMBER?.trim() || "";
  if (sid && token && from) {
    return { sid, token, from };
  }
  return null;
}

function metaCredentialsFromEnv(): { token: string; phoneId: string } | null {
  const token = process.env.META_WHATSAPP_TOKEN?.trim() || "";
  const phoneId = process.env.META_PHONE_NUMBER_ID?.trim() || "";
  if (token && phoneId) return { token, phoneId };
  return null;
}

// ─── Meta Cloud API Provider ──────────────────────────────────────────────────

/** Meta Cloud API: número internacional solo dígitos (sin + ni espacios). */
function toMetaWhatsAppRecipient(to: string): string {
  return to.replace(/\D/g, "");
}

/** Phone number ID en Graph API es numérico (no WABA ID ni texto). */
function isLikelyMetaPhoneNumberId(id: string): boolean {
  return /^\d{10,22}$/.test(id.trim());
}

function hintForMetaJsonError(data: unknown): string {
  const e = data as { error?: { code?: number; error_subcode?: number; message?: string } };
  const code = e?.error?.code;
  const sub = e?.error?.error_subcode;
  if (code === 100 && sub === 33) {
    return (
      " Sugerencia: usá el *Phone number ID* de Meta (WhatsApp → API Setup), no el ID de la app ni el de la cuenta WABA. " +
      "El token debe ser de sistema/usuario con permiso whatsapp_business_messaging y el número del cliente agregado como destinatario de prueba si estás en modo desarrollo."
    );
  }
  return "";
}

class MetaProvider implements WhatsAppProvider {
  private readonly token: string;
  private readonly phoneNumberId: string;

  constructor(config?: { token?: string; phoneNumberId?: string }) {
    this.token = config?.token ?? process.env.META_WHATSAPP_TOKEN ?? "";
    this.phoneNumberId = config?.phoneNumberId ?? process.env.META_PHONE_NUMBER_ID ?? "";
  }

  async sendText({ to, body }: WhatsAppMessage): Promise<WhatsAppSendResult> {
    try {
      const token = this.token.trim();
      const phoneNumberId = this.phoneNumberId.trim();
      if (!token || !phoneNumberId) {
        return {
          success: false,
          error:
            "Meta WhatsApp sin configurar: definí META_PHONE_NUMBER_ID y META_WHATSAPP_TOKEN en .env (o WHATSAPP_PROVIDER=meta con esas variables).",
        };
      }

      if (!isLikelyMetaPhoneNumberId(phoneNumberId)) {
        return {
          success: false,
          error: `Meta Phone Number ID inválido ("${phoneNumberId.slice(0, 24)}…"): debe ser solo dígitos (ID del número en WhatsApp → API Setup). No uses el WhatsApp Business Account ID ni el ID de la aplicación.`,
        };
      }

      const recipient = toMetaWhatsAppRecipient(to);
      if (!recipient || recipient.length < 8) {
        return {
          success: false,
          error: `Teléfono del cliente inválido para WhatsApp: "${to}" (se espera E.164, p. ej. +54911…).`,
        };
      }

      const res = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: recipient,
            type: "text",
            text: { preview_url: false, body },
          }),
        }
      );

      if (!res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        const hint = hintForMetaJsonError(data);
        return {
          success: false,
          error: `Meta API error ${res.status}: ${JSON.stringify(data)}.${hint}`,
        };
      }

      const data = (await res.json()) as { messages?: { id?: string }[] };
      return { success: true, externalId: data?.messages?.[0]?.id };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async sendMetaTemplate(msg: WhatsAppMetaTemplateMessage): Promise<WhatsAppSendResult> {
    try {
      const token = this.token.trim();
      const phoneNumberId = this.phoneNumberId.trim();
      if (!token || !phoneNumberId) {
        return {
          success: false,
          error:
            "Meta WhatsApp sin configurar: definí META_PHONE_NUMBER_ID y META_WHATSAPP_TOKEN en .env (o WHATSAPP_PROVIDER=meta con esas variables).",
        };
      }

      if (!isLikelyMetaPhoneNumberId(phoneNumberId)) {
        return {
          success: false,
          error: `Meta Phone Number ID inválido ("${phoneNumberId.slice(0, 24)}…"): debe ser solo dígitos (ID del número en WhatsApp → API Setup). No uses el WhatsApp Business Account ID ni el ID de la aplicación.`,
        };
      }

      const recipient = toMetaWhatsAppRecipient(msg.to);
      if (!recipient || recipient.length < 8) {
        return {
          success: false,
          error: `Teléfono del cliente inválido para WhatsApp: "${msg.to}" (se espera E.164, p. ej. +54911…).`,
        };
      }

      const templateName = msg.templateName?.trim();
      if (!templateName) {
        return { success: false, error: "Meta: nombre de plantilla vacío." };
      }

      const languageCode = (msg.languageCode?.trim() || "es_AR").replace(/-/g, "_");
      const keys = Object.keys(msg.variables).sort((a, b) => {
        const na = Number(a);
        const nb = Number(b);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
        return a.localeCompare(b);
      });
      const parameters = keys.map((k) => ({
        type: "text" as const,
        text: String(msg.variables[k] ?? ""),
      }));
      const components =
        parameters.length > 0 ? [{ type: "body" as const, parameters }] : [];

      const res = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: recipient,
            type: "template",
            template: {
              name: templateName,
              language: { code: languageCode },
              ...(components.length ? { components } : {}),
            },
          }),
        }
      );

      if (!res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        const hint = hintForMetaJsonError(data);
        return {
          success: false,
          error: `Meta API error ${res.status}: ${JSON.stringify(data)}.${hint}`,
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

/** Twilio exige E.164 sin espacios; acepta "+1 318 …" o "whatsapp:+1 318 …" en .env. */
export function normalizeTwilioWhatsAppAddress(raw: string): string {
  const trimmed = raw.trim();
  const hasWa = trimmed.toLowerCase().startsWith("whatsapp:");
  const inner = hasWa ? trimmed.slice("whatsapp:".length).trim() : trimmed;
  const digits = inner.replace(/\D/g, "");
  if (!digits) return trimmed;
  const e164 = `+${digits}`;
  return hasWa ? `whatsapp:${e164}` : e164;
}

/** Instancia Twilio con credenciales explícitas (p. ej. bot inbound por negocio). */
export class TwilioProvider implements WhatsAppProvider {
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly fromNumber: string; // "whatsapp:+14155238886"

  constructor(config: { accountSid: string; authToken: string; fromNumber: string }) {
    this.accountSid = config.accountSid;
    this.authToken = config.authToken;
    const from = normalizeTwilioWhatsAppAddress(config.fromNumber);
    this.fromNumber = from.toLowerCase().startsWith("whatsapp:") ? from : `whatsapp:${from}`;
  }

  async sendText({ to, body }: WhatsAppMessage): Promise<WhatsAppSendResult> {
    try {
      const toNorm = normalizeTwilioWhatsAppAddress(to);
      const toWhatsApp = toNorm.toLowerCase().startsWith("whatsapp:") ? toNorm : `whatsapp:${toNorm}`;
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

  async sendContentTemplate(msg: WhatsAppContentMessage): Promise<WhatsAppSendResult> {
    try {
      const contentSid = msg.contentSid?.trim();
      if (!contentSid) {
        return { success: false, error: "ContentSid vacío para plantilla Twilio." };
      }
      const toNorm = normalizeTwilioWhatsAppAddress(msg.to);
      const toWhatsApp = toNorm.toLowerCase().startsWith("whatsapp:") ? toNorm : `whatsapp:${toNorm}`;
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");
      const form = new URLSearchParams({
        From: this.fromNumber,
        To: toWhatsApp,
        ContentSid: contentSid,
        ContentVariables: JSON.stringify(msg.variables),
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

// ─── Factory (única cuenta WhatsApp para toda la app: solo .env) ─────────────

export const whatsapp = new MetaProvider();

/** Mensaje fijo cuando falta configuración (no lanza al instanciar el servicio). */
class FixedErrorProvider implements WhatsAppProvider {
  constructor(private readonly message: string) {}
  async sendText(): Promise<WhatsAppSendResult> {
    return { success: false, error: this.message };
  }
}

/**
 * Proveedor único global: variables de entorno del servidor.
 *
 * - `WHATSAPP_PROVIDER` = `twilio` | `meta` (opcional): fuerza ese proveedor; si faltan credenciales, el envío falla con mensaje claro.
 * - Sin `WHATSAPP_PROVIDER`: si están las 3 variables Twilio → Twilio; si no, si están las 2 Meta → Meta; si no, error al enviar.
 */
export function getWhatsAppProvider(): WhatsAppProvider {
  const mode = (process.env.WHATSAPP_PROVIDER ?? "").trim().toLowerCase();

  if (mode === "twilio") {
    const tw = twilioCredentialsFromEnv();
    if (tw) {
      return new TwilioProvider({ accountSid: tw.sid, authToken: tw.token, fromNumber: tw.from });
    }
    return new FixedErrorProvider(
      "WHATSAPP_PROVIDER=twilio: definí TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_WHATSAPP_NUMBER en .env"
    );
  }
  if (mode === "meta") {
    const meta = metaCredentialsFromEnv();
    if (meta) {
      return new MetaProvider({ token: meta.token, phoneNumberId: meta.phoneId });
    }
    return new FixedErrorProvider(
      "WHATSAPP_PROVIDER=meta: definí META_WHATSAPP_TOKEN y META_PHONE_NUMBER_ID en .env"
    );
  }

  const tw = twilioCredentialsFromEnv();
  if (tw) {
    return new TwilioProvider({ accountSid: tw.sid, authToken: tw.token, fromNumber: tw.from });
  }
  const meta = metaCredentialsFromEnv();
  if (meta) {
    return new MetaProvider({ token: meta.token, phoneNumberId: meta.phoneId });
  }
  return new FixedErrorProvider(
    "WhatsApp no configurado: en .env usá Twilio (3 variables) o Meta (2 variables). Opcional: WHATSAPP_PROVIDER=twilio o meta."
  );
}

/** Crea proveedor Twilio (mismo que usa getWhatsAppProvider cuando WHATSAPP_PROVIDER=twilio). */
export function createTwilioProvider(config: {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}): WhatsAppProvider {
  return new TwilioProvider(config);
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

/**
 * Variables para plantilla Twilio de recordatorio ({{1}} nombre, {{2}} fecha/hora/servicio, {{3}} profesional).
 * Debe coincidir con el BODY aprobado en Twilio Content.
 */
export function buildReminderTwilioContentVariables(params: {
  clientName: string;
  serviceName: string;
  manicuristName: string;
  startAt: Date;
}): Record<string, string> {
  const date = formatDateShort(params.startAt);
  const time = formatTime(params.startAt);
  return {
    "1": params.clientName,
    "2": `${date}, ${time} — ${params.serviceName}`,
    "3": params.manicuristName,
  };
}

/**
 * Variables para plantilla Twilio de confirmación (mismo orden {{1}},{{2}},{{3}}; fecha larga en {{2}}).
 * Debe coincidir con el BODY aprobado en Twilio Content.
 */
export function buildConfirmationTwilioContentVariables(params: {
  clientName: string;
  serviceName: string;
  manicuristName: string;
  startAt: Date;
}): Record<string, string> {
  const date = formatDateLong(params.startAt);
  const time = formatTime(params.startAt);
  return {
    "1": params.clientName,
    "2": `${date}, ${time} — ${params.serviceName}`,
    "3": params.manicuristName,
  };
}

/**
 * Variables para plantilla Twilio/Meta de cancelación ({{1}} nombre, {{2}} fecha/hora/servicio, {{3}} fijo o guion).
 * Debe coincidir con el BODY aprobado en Twilio Content o en WhatsApp Manager.
 */
export function buildCancellationTwilioContentVariables(params: {
  clientName: string;
  serviceName: string;
  startAt: Date;
}): Record<string, string> {
  const date = formatDateShort(params.startAt);
  const time = formatTime(params.startAt);
  return {
    "1": params.clientName,
    "2": `${date}, ${time} — ${params.serviceName}`,
    "3": "—",
  };
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
