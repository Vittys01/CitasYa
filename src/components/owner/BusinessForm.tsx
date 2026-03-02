"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES } from "@/lib/format-price";

interface BusinessFormProps {
  initialValues?: {
    name: string;
    slug: string;
    isActive: boolean;
    whatsappProvider?: string | null;
    whatsappInstanceName?: string | null;
    metaPhoneNumberId?: string | null;
    metaAccessToken?: string | null;
    currency?: string | null;
  };
  businessId?: string;
}

export default function BusinessForm({ initialValues, businessId }: BusinessFormProps) {
  const router = useRouter();
  const isEdit = !!businessId;

  const [name, setName] = useState(initialValues?.name ?? "");
  const [slug, setSlug] = useState(initialValues?.slug ?? "");
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);
  const [slugTouched, setSlugTouched] = useState(isEdit);

  // WhatsApp
  const [wpProvider, setWpProvider] = useState<"" | "evolution" | "meta">(
    (initialValues?.whatsappProvider as "" | "evolution" | "meta") ?? ""
  );
  const [wpInstance, setWpInstance] = useState(initialValues?.whatsappInstanceName ?? "");
  const [metaPhone, setMetaPhone] = useState(initialValues?.metaPhoneNumberId ?? "");
  const [metaToken, setMetaToken] = useState(initialValues?.metaAccessToken ?? "");

  // Currency
  const [currency, setCurrency] = useState(initialValues?.currency ?? "ARS");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function autoSlug(value: string) {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function handleNameChange(val: string) {
    setName(val);
    if (!slugTouched) {
      setSlug(autoSlug(val));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const url = isEdit ? `/api/owner/businesses/${businessId}` : "/api/owner/businesses";
    const method = isEdit ? "PATCH" : "POST";

    const body: Record<string, unknown> = { name, slug };
    if (isEdit) {
      body.isActive = isActive;
      body.whatsappProvider = wpProvider;
      body.whatsappInstanceName = wpProvider === "evolution" ? wpInstance || null : null;
      body.metaPhoneNumberId = wpProvider === "meta" ? metaPhone || null : null;
      body.metaAccessToken = wpProvider === "meta" ? metaToken || null : null;
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    if (!res.ok) {
      setLoading(false);
      setError(json?.error?.message ?? "Error al guardar");
      return;
    }

    // Save currency setting when editing
    if (isEdit) {
      const currencyLocale = CURRENCIES[currency]?.locale ?? "es-AR";
      await fetch(`/api/owner/businesses/${businessId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "app.currency": currency,
          "app.currencyLocale": currencyLocale,
        }),
      });
    }

    setLoading(false);
    router.push("/owner");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Datos generales ── */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-[#4a3b32] uppercase tracking-wide">Datos generales</h3>

        <div>
          <label className="block text-sm font-semibold text-[#4a3b32] mb-1.5">
            Nombre de la empresa <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Mi Negocio"
            required
            className="w-full px-4 py-2.5 rounded-xl border border-[#e6d5c3] bg-white text-[#4a3b32] placeholder:text-[#c4a882] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#4a3b32] mb-1.5">
            Slug (URL única) <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center border border-[#e6d5c3] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition bg-white">
            <span className="px-3 text-sm text-[#9c8273] bg-[#faf7f4] border-r border-[#e6d5c3] py-2.5 shrink-0">
              /
            </span>
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              placeholder="mi-negocio"
              required
              pattern="^[a-z0-9-]+$"
              title="Solo letras minúsculas, números y guiones"
              className="flex-1 px-3 py-2.5 text-[#4a3b32] placeholder:text-[#c4a882] focus:outline-none text-sm bg-transparent"
            />
          </div>
          <p className="text-xs text-[#9c8273] mt-1">Se auto-completa desde el nombre.</p>
        </div>

        {isEdit && (
          <>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsActive((v) => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  isActive ? "bg-green-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    isActive ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-sm text-[#4a3b32] font-medium">
                {isActive ? "Empresa activa" : "Empresa inactiva"}
              </span>
            </div>

            {/* Currency */}
            <div>
              <label className="block text-sm font-semibold text-[#4a3b32] mb-1.5">
                Moneda
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#e6d5c3] bg-white text-[#4a3b32] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition text-sm"
              >
                {Object.entries(CURRENCIES).map(([code, cfg]) => (
                  <option key={code} value={code}>
                    {cfg.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[#9c8273] mt-1">
                Se usa para mostrar los precios en esta empresa.
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── WhatsApp (solo en edición) ── */}
      {isEdit && (
        <div className="space-y-4 pt-2 border-t border-[#f0e7de]">
          <h3 className="text-sm font-bold text-[#4a3b32] uppercase tracking-wide">
            WhatsApp
          </h3>

          <div>
            <label className="block text-sm font-semibold text-[#4a3b32] mb-1.5">Proveedor</label>
            <select
              value={wpProvider}
              onChange={(e) => setWpProvider(e.target.value as "" | "evolution" | "meta")}
              className="w-full px-4 py-2.5 rounded-xl border border-[#e6d5c3] bg-white text-[#4a3b32] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition text-sm"
            >
              <option value="">Sin WhatsApp</option>
              <option value="evolution">Evolution API (self-hosted)</option>
              <option value="meta">Meta Cloud API</option>
            </select>
          </div>

          {wpProvider === "evolution" && (
            <div>
              <label className="block text-sm font-semibold text-[#4a3b32] mb-1.5">
                Nombre de instancia Evolution
              </label>
              <input
                type="text"
                value={wpInstance}
                onChange={(e) => setWpInstance(e.target.value)}
                placeholder="montecatini-instance"
                className="w-full px-4 py-2.5 rounded-xl border border-[#e6d5c3] bg-white text-[#4a3b32] placeholder:text-[#c4a882] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition text-sm"
              />
              <p className="text-xs text-[#9c8273] mt-1">
                Debe coincidir con <code className="bg-[#f5ede6] px-1 rounded">EVOLUTION_INSTANCE</code> en el .env de ese negocio.
              </p>
            </div>
          )}

          {wpProvider === "meta" && (
            <>
              <div>
                <label className="block text-sm font-semibold text-[#4a3b32] mb-1.5">
                  Meta Phone Number ID
                </label>
                <input
                  type="text"
                  value={metaPhone}
                  onChange={(e) => setMetaPhone(e.target.value)}
                  placeholder="10000000000"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#e6d5c3] bg-white text-[#4a3b32] placeholder:text-[#c4a882] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#4a3b32] mb-1.5">
                  Meta Access Token
                </label>
                <input
                  type="password"
                  value={metaToken}
                  onChange={(e) => setMetaToken(e.target.value)}
                  placeholder="EAAxxxxxxx"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#e6d5c3] bg-white text-[#4a3b32] placeholder:text-[#c4a882] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition text-sm"
                />
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark disabled:opacity-60 transition-colors shadow-sm"
        >
          {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear empresa"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2.5 text-sm text-[#9c8273] hover:text-[#4a3b32] transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
