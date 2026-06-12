"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface BusinessData {
  id: string;
  nif: string;
  addressStreet: string;
  addressCity: string;
  addressProvince: string;
  addressPostal: string;
  invoicePrefix: string;
  defaultIvaRate: number;
  invoiceFooter: string;
}

export default function TaxSettings({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [data, setData] = useState<BusinessData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/owner/businesses/${businessId}`)
      .then((r) => r.json())
      .then((r) => {
        if (r.data) {
          setData({
            id: r.data.id,
            nif: r.data.nif ?? "",
            addressStreet: r.data.addressStreet ?? "",
            addressCity: r.data.addressCity ?? "",
            addressProvince: r.data.addressProvince ?? "",
            addressPostal: r.data.addressPostal ?? "",
            invoicePrefix: r.data.invoicePrefix ?? "F",
            defaultIvaRate: Number(r.data.defaultIvaRate ?? 21),
            invoiceFooter: r.data.invoiceFooter ?? "",
          });
        }
      });
  }, [businessId]);

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/owner/businesses/${businessId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nif: data.nif || null,
          addressStreet: data.addressStreet || null,
          addressCity: data.addressCity || null,
          addressProvince: data.addressProvince || null,
          addressPostal: data.addressPostal || null,
          invoicePrefix: data.invoicePrefix || "F",
          defaultIvaRate: data.defaultIvaRate,
          invoiceFooter: data.invoiceFooter || null,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error?.message ?? "Error al guardar");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } catch {
      setError("Error de conexion");
    } finally {
      setSaving(false);
    }
  };

  const labelCls = "block text-xs font-semibold text-earth uppercase tracking-wider mb-1.5";
  const inputCls =
    "w-full px-3.5 py-2.5 text-sm border border-[#D7CCC8] rounded-lg bg-[#FFFDF5] text-earth placeholder-[#BCAAA4] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition";

  if (!data) return null;

  return (
    <section className="bg-[#FFFDF5] rounded-xl border border-[#e6d5c3] shadow-warm-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-[#e6d5c3] bg-[#fbf6f1]">
        <h2 className="text-base font-bold text-earth flex items-center gap-2">
          <span className="material-symbols-outlined text-primary-dark text-[18px]">receipt_long</span>
          Datos fiscales
        </h2>
        <p className="text-xs text-earth-muted mt-0.5">
          Configura los datos fiscales que aparecen en las facturas
        </p>
      </div>

      <div className="px-6 py-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>NIF / CIF</label>
            <input
              type="text"
              value={data.nif}
              onChange={(e) => setData({ ...data, nif: e.target.value })}
              placeholder="B12345678"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Prefijo factura</label>
            <input
              type="text"
              value={data.invoicePrefix}
              onChange={(e) => setData({ ...data, invoicePrefix: e.target.value })}
              placeholder="F"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Direccion</label>
          <input
            type="text"
            value={data.addressStreet}
            onChange={(e) => setData({ ...data, addressStreet: e.target.value })}
            placeholder="Calle Mayor 12, 3A"
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Codigo postal</label>
            <input
              type="text"
              value={data.addressPostal}
              onChange={(e) => setData({ ...data, addressPostal: e.target.value })}
              placeholder="28001"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Ciudad</label>
            <input
              type="text"
              value={data.addressCity}
              onChange={(e) => setData({ ...data, addressCity: e.target.value })}
              placeholder="Madrid"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Provincia</label>
            <input
              type="text"
              value={data.addressProvince}
              onChange={(e) => setData({ ...data, addressProvince: e.target.value })}
              placeholder="Madrid"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>IVA por defecto (%)</label>
          <input
            type="number"
            step="0.01"
            value={data.defaultIvaRate}
            onChange={(e) => setData({ ...data, defaultIvaRate: parseFloat(e.target.value) || 0 })}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Pie de factura</label>
          <textarea
            value={data.invoiceFooter}
            onChange={(e) => setData({ ...data, invoiceFooter: e.target.value })}
            rows={2}
            placeholder="Texto opcional que aparece al final de cada factura"
            className={`${inputCls} resize-none`}
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-xs px-3.5 py-2.5 rounded-lg border border-red-100 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px]">error</span>
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 text-sm font-bold bg-primary-dark hover:bg-primary-hover text-white rounded-lg shadow-warm-sm transition disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar datos fiscales"}
          </button>
          {saved && !saving && (
            <p className="text-xs text-emerald-700 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">check_circle</span>
              Guardado
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
