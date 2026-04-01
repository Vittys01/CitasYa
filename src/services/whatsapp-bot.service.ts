/**
 * Bot de agendado por WhatsApp (Twilio inbound) — DESHABILITADO.
 *
 * Toda la lógica (flujo guiado, sesiones, citas vía WhatsApp) se eliminó de la build activa
 * para aislar problemas con los mensajes salientes (confirmaciones / cancelaciones).
 * Restaurá desde git el contenido anterior de este archivo si volvés a activar el bot
 * y reactivá la implementación en `src/app/api/webhooks/twilio/whatsapp/route.ts`.
 */
import "server-only";

export type TwilioInboundForm = Record<string, string>;

export async function resolveBusinessForTwilioInbound(_params: {
  toRaw: string;
  accountSid?: string;
}): Promise<null> {
  return null;
}

export function getAuthTokenForTwilioWebhook(_business: {
  twilioAuthToken: string | null;
}): string {
  return "";
}

export async function handleTwilioInboundMessage(_form: TwilioInboundForm): Promise<void> {
  return;
}
