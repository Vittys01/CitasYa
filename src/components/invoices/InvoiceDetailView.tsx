"use client";

import { useState } from "react";
import type { InvoiceForClient } from "@/types";

interface Props {
  invoice: InvoiceForClient;
}

const EUR = (n: number) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InvoiceDetailView({ invoice }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleDownload = async (formato: string, ancho?: string) => {
    const key = ancho ? `${formato}-${ancho}` : formato;
    setLoading(key);
    try {
      const params = new URLSearchParams({ formato });
      if (ancho) params.set("ancho", ancho);
      const res = await fetch(`/api/invoices/${invoice.id}/pdf?${params}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const suffix = ancho ? `-${ancho}mm` : "";
      a.download = `factura-${invoice.formattedNumber}${suffix}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(null);
    }
  };

  const handleStatusChange = async (status: string) => {
    await fetch(`/api/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    window.location.reload();
  };

  const statusLabel: Record<string, string> = {
    DRAFT: "Borrador",
    ISSUED: "Emitida",
    CANCELLED: "Anulada",
  };

  const statusBadge: Record<string, string> = {
    DRAFT: "bg-yellow-100 text-yellow-800",
    ISSUED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#4a3b32]">
            Factura {invoice.formattedNumber}
          </h1>
          <p className="text-sm text-[#9c8273] mt-1">
            {new Date(invoice.issuedAt).toLocaleDateString("es-ES", {
              day: "2-digit", month: "long", year: "numeric", timeZone: "Atlantic/Canary",
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusBadge[invoice.status] ?? ""}`}>
            {statusLabel[invoice.status] ?? invoice.status}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => handleDownload("recibo", "58")}
          disabled={loading !== null}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#7f5539] text-white text-sm font-semibold hover:bg-[#6d4a32] transition-colors shadow-warm-sm disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">receipt</span>
          {loading === "recibo-58" ? "Generando..." : "Ticket 58mm"}
        </button>
        <button
          onClick={() => handleDownload("recibo", "80")}
          disabled={loading !== null}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#7f5539] text-white text-sm font-semibold hover:bg-[#6d4a32] transition-colors shadow-warm-sm disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">receipt_long</span>
          {loading === "recibo-80" ? "Generando..." : "Ticket 80mm"}
        </button>
        <button
          onClick={() => handleDownload("a4")}
          disabled={loading !== null}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#D7CCC8] text-[#4a3b32] text-sm font-semibold hover:bg-[#fbf6f1] transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
          {loading === "a4" ? "Generando..." : "PDF A4"}
        </button>
        {invoice.status === "DRAFT" && (
          <button
            onClick={() => handleStatusChange("ISSUED")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-700 text-white text-sm font-semibold hover:bg-green-800 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            Emitir factura
          </button>
        )}
        {invoice.status !== "CANCELLED" && (
          <button
            onClick={() => handleStatusChange("CANCELLED")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-300 text-red-700 text-sm font-semibold hover:bg-red-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">cancel</span>
            Anular
          </button>
        )}
        {invoice.appointment && (
          <a
            href="/appointments"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#D7CCC8] text-earth text-sm font-semibold hover:bg-[#fbf6f1] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">calendar_month</span>
            Ver cita
          </a>
        )}
      </div>

      {/* Invoice preview card */}
      <div className="rounded-xl border border-[#e6d5c3] bg-white overflow-hidden">
        {/* Business + Client info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 border-b border-[#e6d5c3]">
          <div>
            <h3 className="text-xs font-semibold text-earth uppercase tracking-wider mb-2">Emisor</h3>
            <p className="font-semibold text-[#4a3b32]">{invoice.businessName}</p>
            {invoice.businessNif && <p className="text-sm text-[#7f6a5d]">NIF: {invoice.businessNif}</p>}
            {invoice.businessAddress && <p className="text-sm text-[#7f6a5d]">{invoice.businessAddress}</p>}
          </div>
          <div>
            <h3 className="text-xs font-semibold text-earth uppercase tracking-wider mb-2">Cliente</h3>
            <p className="font-semibold text-[#4a3b32]">{invoice.clientName}</p>
            {invoice.clientNif && <p className="text-sm text-[#7f6a5d]">NIF: {invoice.clientNif}</p>}
            {invoice.clientEmail && <p className="text-sm text-[#7f6a5d]">{invoice.clientEmail}</p>}
          </div>
        </div>

        {/* Items table */}
        <div className="p-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#7f6a5d] border-b border-[#e6d5c3]">
                <th className="text-left py-2 font-semibold">Concepto</th>
                <th className="text-center py-2 font-semibold w-16">Ud.</th>
                <th className="text-right py-2 font-semibold w-28">Precio</th>
                <th className="text-right py-2 font-semibold w-28">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0e6dc]">
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2">{item.description}</td>
                  <td className="py-2 text-center">{item.quantity}</td>
                  <td className="py-2 text-right">{EUR(Number(item.unitPrice))} EUR</td>
                  <td className="py-2 text-right font-semibold">{EUR(Number(item.totalPrice))} EUR</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t border-[#e6d5c3] bg-[#fbf6f1] p-6">
          <div className="ml-auto max-w-xs space-y-2">
            {invoice.ivaRate > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-[#7f6a5d]">Base imponible</span>
                  <span>{EUR(invoice.baseImponible)} EUR</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#7f6a5d]">IVA ({invoice.ivaRate}%)</span>
                  <span>{EUR(invoice.ivaAmount)} EUR</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-base font-bold border-t border-[#e6d5c3] pt-2">
              <span className="text-[#7f5539]">TOTAL</span>
              <span className="text-[#7f5539]">{EUR(invoice.total)} EUR</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="p-6 border-t border-[#e6d5c3]">
            <p className="text-xs font-semibold text-earth uppercase tracking-wider mb-1">Notas</p>
            <p className="text-sm text-[#7f6a5d]">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
