/** Currency configs supported by the app */
export const CURRENCIES: Record<string, { locale: string; currency: string; label: string }> = {
  ARS: { locale: "es-AR", currency: "ARS", label: "Peso argentino (ARS)" },
  USD: { locale: "en-US", currency: "USD", label: "Dólar (USD)" },
  COP: { locale: "es-CO", currency: "COP", label: "Peso colombiano (COP)" },
  EUR: { locale: "es-ES", currency: "EUR", label: "Euro (EUR)" },
};

/**
 * Format a numeric amount according to the app.currency / app.currencyLocale
 * settings stored in the DB. Falls back to ARS if not configured.
 */
export function formatPrice(
  amount: number | string,
  settings?: Record<string, string>
): string {
  const currency = settings?.["app.currency"] ?? "ARS";
  const locale   = settings?.["app.currencyLocale"] ?? CURRENCIES[currency]?.locale ?? "es-AR";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(Number(amount));
}
