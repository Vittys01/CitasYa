"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback } from "react";

export default function InvoicesFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") ?? "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") ?? "");

  const apply = useCallback(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    router.push(`/facturas?${params.toString()}`);
  }, [q, status, dateFrom, dateTo, router]);

  const clear = useCallback(() => {
    setQ("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
    router.push("/facturas");
  }, [router]);

  const inputCls =
    "px-3 py-2 text-sm border border-[#D7CCC8] rounded-lg bg-[#FFFDF5] text-earth placeholder-[#BCAAA4] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition";

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="flex-1 min-w-[160px]">
        <label className="block text-xs font-semibold text-earth uppercase tracking-wider mb-1">Buscar</label>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Numero o cliente..."
          className={inputCls + " w-full"}
          onKeyDown={(e) => e.key === "Enter" && apply()}
        />
      </div>
      <div className="min-w-[140px]">
        <label className="block text-xs font-semibold text-earth uppercase tracking-wider mb-1">Estado</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls + " w-full"}>
          <option value="">Todos</option>
          <option value="DRAFT">Borrador</option>
          <option value="ISSUED">Emitida</option>
          <option value="CANCELLED">Anulada</option>
        </select>
      </div>
      <div className="min-w-[140px]">
        <label className="block text-xs font-semibold text-earth uppercase tracking-wider mb-1">Desde</label>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls + " w-full"} />
      </div>
      <div className="min-w-[140px]">
        <label className="block text-xs font-semibold text-earth uppercase tracking-wider mb-1">Hasta</label>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls + " w-full"} />
      </div>
      <div className="flex gap-2">
        <button
          onClick={apply}
          className="px-4 py-2 text-sm font-semibold bg-[#7f5539] text-white rounded-lg hover:bg-[#6d4a32] transition-colors shadow-warm-sm"
        >
          Filtrar
        </button>
        <button
          onClick={clear}
          className="px-4 py-2 text-sm border border-[#D7CCC8] rounded-lg text-earth hover:bg-[#fbf6f1] transition-colors"
        >
          Limpiar
        </button>
      </div>
    </div>
  );
}
