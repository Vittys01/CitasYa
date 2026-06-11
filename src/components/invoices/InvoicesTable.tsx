"use client";

import { useState } from "react";
import type { InvoiceForClient } from "@/types";

interface Props {
  invoices: InvoiceForClient[];
  meta: { total: number; page: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean };
}

const statusBadge: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-800",
  ISSUED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const statusLabel: Record<string, string> = {
  DRAFT: "Borrador",
  ISSUED: "Emitida",
  CANCELLED: "Anulada",
};

const EUR = (n: number) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InvoicesTable({ invoices, meta }: Props) {
  const [page, setPage] = useState(meta.page);

  const handleDownload = async (id: string, number: string) => {
    const res = await fetch(`/api/invoices/${id}/pdf`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `factura-${number}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStatusChange = async (id: string, status: string) => {
    await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    window.location.reload();
  };

  return (
    <div>
      <div className="rounded-xl border border-[#e6d5c3] overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#fbf6f1] text-[#7f6a5d]">
              <th className="text-left px-4 py-3 font-semibold">Numero</th>
              <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Fecha</th>
              <th className="text-left px-4 py-3 font-semibold">Cliente</th>
              <th className="text-right px-4 py-3 font-semibold hidden md:table-cell">Base</th>
              <th className="text-right px-4 py-3 font-semibold hidden md:table-cell">IVA</th>
              <th className="text-right px-4 py-3 font-semibold hidden lg:table-cell">IRPF</th>
              <th className="text-right px-4 py-3 font-semibold">Total</th>
              <th className="text-center px-4 py-3 font-semibold">Estado</th>
              <th className="text-right px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0e6dc]">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[#9c8273]">
                  No hay facturas emitidas todavia
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-[#fefbf6] transition-colors">
                  <td className="px-4 py-3 font-mono text-[#7f5539] font-semibold">
                    <a href={`/facturas/${inv.id}`} className="hover:underline">
                      {inv.formattedNumber}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-[#7f6a5d] hidden sm:table-cell">
                    {new Date(inv.issuedAt).toLocaleDateString("es-ES")}
                  </td>
                  <td className="px-4 py-3">{inv.clientName}</td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">{EUR(inv.baseImponible)}</td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">{EUR(inv.ivaAmount)}</td>
                  <td className="px-4 py-3 text-right text-red-600 hidden lg:table-cell">-{EUR(inv.irpfAmount)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{EUR(inv.total)} EUR</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[inv.status] ?? ""}`}>
                      {statusLabel[inv.status] ?? inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleDownload(inv.id, inv.formattedNumber)}
                        className="p-1.5 rounded-lg hover:bg-[#f0e6dc] transition-colors"
                        title="Descargar PDF"
                      >
                        <span className="material-symbols-outlined text-[18px] text-[#7f5539]">picture_as_pdf</span>
                      </button>
                      {inv.status === "DRAFT" && (
                        <button
                          onClick={() => handleStatusChange(inv.id, "ISSUED")}
                          className="p-1.5 rounded-lg hover:bg-[#f0e6dc] transition-colors"
                          title="Emitir factura"
                        >
                          <span className="material-symbols-outlined text-[18px] text-green-700">check_circle</span>
                        </button>
                      )}
                      {inv.status !== "CANCELLED" && (
                        <button
                          onClick={() => handleStatusChange(inv.id, "CANCELLED")}
                          className="p-1.5 rounded-lg hover:bg-[#f0e6dc] transition-colors"
                          title="Anular factura"
                        >
                          <span className="material-symbols-outlined text-[18px] text-red-600">cancel</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-sm text-[#9c8273]">
            {meta.total} factura{meta.total !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <button
              disabled={!meta.hasPrevPage}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded-lg text-sm border border-[#e6d5c3] disabled:opacity-40 hover:bg-[#fbf6f1] transition-colors"
            >
              Anterior
            </button>
            <span className="flex items-center text-sm text-[#7f6a5d]">
              {page} / {meta.totalPages}
            </span>
            <button
              disabled={!meta.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg text-sm border border-[#e6d5c3] disabled:opacity-40 hover:bg-[#fbf6f1] transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
