"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { PaginationMeta } from "@/types";
import type { Client } from "@prisma/client";

type ClientWithCount = Client & { _count: { appointments: number } };

interface ClientsTableProps {
  clients: ClientWithCount[];
  meta: PaginationMeta;
  query: string;
  settings?: Record<string, string>;
}

const get = (s: Record<string, string> | undefined, k: string, fallback: string) => (s && s[k]) ?? fallback;

export default function ClientsTable({ clients, meta, query, settings }: ClientsTableProps) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  function handleSearch(q: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("q", q); else params.delete("q");
    params.set("page", "1");
    router.push(`/clients?${params.toString()}`);
  }

  function handlePage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`/clients?${params.toString()}`);
  }

  return (
    <div className="space-y-4">

      {/* Search */}
      <div className="flex items-center bg-[#fbf6f1] border border-[#e6d5c3] rounded-xl p-2 shadow-warm-sm">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-[#bda696]">
            search
          </span>
          <input
            type="search"
            placeholder={get(settings, "search.clients", "Buscar por nombre, teléfono o email...")}
            defaultValue={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-transparent border-none focus:ring-0 text-earth placeholder-[#bda696]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#FFFDF5] rounded-xl border border-[#e6d5c3] shadow-warm-sm overflow-hidden">
        {/* Table header */}
        <div className="bg-[#f5ebe0] border-b border-[#e6d5c3]">
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th className="px-5 py-3.5 text-[10px] font-bold text-earth-muted uppercase tracking-wider">{get(settings, "table.clientColumn", "Cliente")}</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-earth-muted uppercase tracking-wider">{get(settings, "table.phone", "Teléfono")}</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-earth-muted uppercase tracking-wider hidden md:table-cell">{get(settings, "table.email", "Email")}</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-earth-muted uppercase tracking-wider">{get(settings, "table.appointments", "Turnos")}</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-earth-muted uppercase tracking-wider hidden lg:table-cell">{get(settings, "table.notes", "Notas")}</th>
              </tr>
            </thead>
          </table>
        </div>

        {/* Table body */}
        <table className="w-full">
          <tbody className="divide-y divide-[#f0ede8]">
            {clients.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-16">
                  <div className="flex flex-col items-center text-[#bda696]">
                    <span className="material-symbols-outlined text-4xl mb-2">person_search</span>
                    <p className="text-sm">{get(settings, "empty.clients", "No se encontraron clientes")}</p>
                  </div>
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr key={client.id} className="hover:bg-cream-dark transition group">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary-dark font-bold text-sm flex-shrink-0">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <Link
                        href={`/clients/${client.id}`}
                        className="text-sm font-semibold text-earth hover:text-primary-dark transition"
                      >
                        {client.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-1.5 text-sm text-earth-light">
                      <span className="material-symbols-outlined text-[15px] text-[#bda696]">phone</span>
                      {client.phone}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <span className="text-sm text-earth-muted">{client.email ?? "—"}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-primary/10 text-primary-dark px-2.5 py-1 rounded-full border border-primary/20">
                      <span className="material-symbols-outlined text-[13px]">calendar_month</span>
                      {client._count.appointments}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    <p className="text-xs text-[#bda696] truncate max-w-xs">{client.notes ?? "—"}</p>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-earth-muted text-xs">
            {meta.total} {get(settings, "page.clientsSub", "clientes")} · {get(settings, "pagination.page", "página")} {meta.page} de {meta.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              disabled={!meta.hasPrevPage}
              onClick={() => handlePage(meta.page - 1)}
              className={cn(
                "flex items-center gap-1 px-4 py-2 text-xs font-medium rounded-lg border border-[#e6d5c3] transition",
                meta.hasPrevPage
                  ? "text-earth hover:bg-cream-dark bg-[#FFFDF5]"
                  : "opacity-40 cursor-not-allowed bg-stone-50 text-stone-400"
              )}
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              {get(settings, "pagination.previous", "Anterior")}
            </button>
            <button
              disabled={!meta.hasNextPage}
              onClick={() => handlePage(meta.page + 1)}
              className={cn(
                "flex items-center gap-1 px-4 py-2 text-xs font-medium rounded-lg border border-[#e6d5c3] transition",
                meta.hasNextPage
                  ? "text-earth hover:bg-cream-dark bg-[#FFFDF5]"
                  : "opacity-40 cursor-not-allowed bg-stone-50 text-stone-400"
              )}
            >
              {get(settings, "pagination.next", "Siguiente")}
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
