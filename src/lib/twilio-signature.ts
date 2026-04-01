/**
 * Valida `X-Twilio-Signature` según
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
import crypto from "crypto";

export function validateTwilioSignature(
  authToken: string,
  signature: string | null | undefined,
  url: string,
  params: Record<string, string>
): boolean {
  if (!signature?.trim() || !authToken) return false;
  const keys = Object.keys(params).sort();
  let data = url;
  for (const key of keys) {
    data += key + params[key];
  }
  const hmac = crypto.createHmac("sha1", authToken);
  hmac.update(Buffer.from(data, "utf-8"));
  const expected = hmac.digest("base64");
  const a = Buffer.from(signature.trim());
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
