"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES } from "@/lib/format-price";
import { formatPrice } from "@/lib/format-price";

const g = (s: Record<string, string>, k: string, fb: string) => s[k] ?? fb;

const CURRENCY_OPTIONS = [
  { code: "ARS", locale: "es-AR", symbol: "$",  flag: "🇦🇷" },
  { code: "USD", locale: "en-US", symbol: "US$", flag: "🇺🇸" },
  { code: "COP", locale: "es-CO", symbol: "COL$",flag: "🇨🇴" },
  { code: "EUR", locale: "es-ES", symbol: "€",  flag: "🇪🇺" },
] as const;

export default function CurrencySettings({ settings = {} }: { settings?: Record<string, string> }) {
  const [current, setCurrent] = useState(settings["app.currency"] ?? "ARS");
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const router = useRouter();

  async function saveCurrency(code: string) {
    setSaving(true);
    setSaved(false);
    const locale = CURRENCIES[code]?.locale ?? "es-AR";
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "app.currency": code, "app.currencyLocale": locale }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  return (
    <section className="bg-[#FFFDF5] rounded-xl border border-[#e6d5c3] shadow-warm-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#e6d5c3] bg-[#fbf6f1]">
        <h2 className="text-base font-bold text-earth flex items-center gap-2">
          <span className="material-symbols-outlined text-primary-dark text-[18px]">currency_exchange</span>
          {g(settings, "section.currency", "Moneda")}
        </h2>
        <p className="text-xs text-earth-muted mt-0.5">
          {g(settings, "section.currencySub", "Moneda usada para mostrar precios en toda la app")}
        </p>
      </div>

      {/* Currency picker */}
      <div className="px-6 py-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CURRENCY_OPTIONS.map((opt) => {
            const isActive = current === opt.code;
            const previewSettings = { ...settings, "app.currency": opt.code, "app.currencyLocale": opt.locale };
            return (
              <button
                key={opt.code}
                onClick={() => {
                  setCurrent(opt.code);
                  saveCurrency(opt.code);
                }}
                className={`relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all ${
                  isActive
                    ? "border-primary-dark bg-primary/5 shadow-warm-sm"
                    : "border-[#e6d5c3] bg-white hover:border-primary/40 hover:bg-cream-dark"
                }`}
              >
                {/* Active check */}
                {isActive && (
                  <span className="absolute top-2.5 right-2.5 w-5 h-5 bg-primary-dark rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-[14px]">check</span>
                  </span>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-2xl">{opt.flag}</span>
                  <span className="text-lg font-bold text-earth">{opt.symbol}</span>
                </div>

                <div>
                  <p className="text-sm font-bold text-earth">{opt.code}</p>
                  <p className="text-[11px] text-earth-muted leading-tight">
                    {g(settings, `currency.label.${opt.code}`, CURRENCIES[opt.code]?.label ?? opt.code)}
                  </p>
                </div>

                {/* Preview */}
                <p className="text-xs font-semibold text-primary-dark mt-1">
                  {formatPrice(12500, previewSettings)}
                </p>
              </button>
            );
          })}
        </div>

        {/* Save feedback */}
        <div className="mt-4 flex items-center gap-2 h-6">
          {saving && (
            <p className="text-xs text-earth-muted flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
              Guardando...
            </p>
          )}
          {saved && !saving && (
            <p className="text-xs text-emerald-700 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">check_circle</span>
              {g(settings, "common.saved", "Guardado")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
