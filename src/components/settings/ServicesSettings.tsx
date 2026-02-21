"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format-price";
import type { ServiceForClient } from "@/lib/serialize";

const g = (s: Record<string, string>, k: string, fb: string) => s[k] ?? fb;

type ServiceForm = { name: string; duration: number; price: number; color: string };
const EMPTY_FORM: ServiceForm = { name: "", duration: 60, price: 0, color: "#b08968" };

export default function ServicesSettings({ services, settings = {} }: { services: ServiceForClient[]; settings?: Record<string, string> }) {
  const [mode, setMode]         = useState<"idle" | "add" | { edit: ServiceForClient }>("idle");
  const [form, setForm]         = useState<ServiceForm>(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null); // service id to confirm
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const router = useRouter();

  function openAdd() {
    setForm(EMPTY_FORM);
    setError(null);
    setMode("add");
  }

  function openEdit(s: ServiceForClient) {
    setForm({ name: s.name, duration: s.duration, price: Number(s.price), color: s.color });
    setError(null);
    setMode({ edit: s });
  }

  function cancel() {
    setMode("idle");
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const isEdit = typeof mode === "object" && "edit" in mode;
    const url    = isEdit ? `/api/services/${(mode as { edit: ServiceForClient }).edit.id}` : "/api/services";
    const method = isEdit ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) { const j = await res.json(); setError(j.error?.message ?? "Error"); return; }
    setMode("idle");
    router.refresh();
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/services/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    router.refresh();
  }

  async function deleteService(id: string) {
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const j = await res.json();
      setDeleteError(j.error?.message ?? "Error al eliminar");
      return;
    }
    setConfirmDelete(null);
    router.refresh();
  }

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-[#D7CCC8] rounded-lg bg-[#FFFDF5] text-earth placeholder-[#BCAAA4] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition";
  const isAdd    = mode === "add";
  const editId   = typeof mode === "object" && "edit" in mode ? (mode as { edit: ServiceForClient }).edit.id : null;

  return (
    <section className="bg-[#FFFDF5] rounded-xl border border-[#e6d5c3] shadow-warm-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#e6d5c3] bg-[#fbf6f1]">
        <div>
          <h2 className="text-base font-bold text-earth flex items-center gap-2">
            <span className="material-symbols-outlined text-primary-dark text-[18px]">spa</span>
            {g(settings, "section.services", "Catálogo de servicios")}
          </h2>
          <p className="text-xs text-earth-muted mt-0.5">{services.length} {g(settings, "section.servicesSub", "servicios registrados")}</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-primary-dark hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-warm-sm transition"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          {g(settings, "section.addService", "Agregar servicio")}
        </button>
      </div>

      {/* Add / Edit form */}
      {mode !== "idle" && (
        <div className="px-6 py-4 bg-cream-dark border-b border-[#e6d5c3] space-y-3">
          <p className="text-xs font-bold text-earth-muted uppercase tracking-wider">
            {isAdd ? g(settings, "section.addService", "Agregar servicio") : g(settings, "action.editService", "Editar servicio")}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-earth-muted mb-1">{g(settings, "form.field.name", "Nombre")}</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={g(settings, "form.placeholder.service", "Manicura clásica")}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-earth-muted mb-1">{g(settings, "form.field.durationMin", "Duración (min)")}</label>
              <input type="number" min={5} value={form.duration} onChange={(e) => setForm({ ...form, duration: +e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-earth-muted mb-1">{g(settings, "form.field.priceArs", "Precio")}</label>
              <input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: +e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-earth-muted mb-1">{g(settings, "form.field.color", "Color")}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="h-[42px] w-14 rounded-lg border border-[#D7CCC8] cursor-pointer p-0.5 bg-[#FFFDF5]"
                />
                <span className="text-xs text-earth-muted font-mono">{form.color}</span>
              </div>
            </div>
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button onClick={cancel} className="px-4 py-2 text-xs border border-[#D7CCC8] rounded-lg text-earth hover:bg-cream-dark bg-white transition">
              {g(settings, "common.cancel", "Cancelar")}
            </button>
            <button onClick={save} disabled={saving} className="px-4 py-2 text-xs font-bold bg-primary-dark text-white rounded-lg hover:bg-primary-hover transition disabled:opacity-50">
              {saving ? g(settings, "common.saving", "Guardando...") : g(settings, "common.save", "Guardar")}
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (() => {
        const svc = services.find((s) => s.id === confirmDelete);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
            <div className="relative bg-[#FFFDF5] rounded-2xl shadow-2xl border border-[#e6d5c3] p-6 w-full max-w-sm mx-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-red-500 text-[22px]">delete_forever</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-earth">
                    {g(settings, "confirm.deleteService.title", "¿Eliminar servicio?")}
                  </h3>
                  <p className="text-sm text-earth-muted mt-1">
                    {g(settings, "confirm.deleteService.body", "Vas a eliminar permanentemente")}
                    {" "}<span className="font-semibold text-earth">"{svc?.name}"</span>.
                    {" "}{g(settings, "confirm.deleteService.warn", "Esta acción no se puede deshacer.")}
                  </p>
                  {deleteError && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                      <span className="material-symbols-outlined text-amber-500 text-[16px] mt-0.5 shrink-0">warning</span>
                      <p className="text-xs text-amber-700">{deleteError}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-5 justify-end">
                <button
                  onClick={() => { setConfirmDelete(null); setDeleteError(null); }}
                  className="px-4 py-2 text-sm border border-[#D7CCC8] rounded-lg text-earth hover:bg-cream-dark bg-white transition"
                >
                  {g(settings, "common.cancel", "Cancelar")}
                </button>
                <button
                  onClick={() => deleteService(confirmDelete)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-bold bg-red-500 hover:bg-red-600 text-white rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                >
                  {deleting && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                  {deleting ? g(settings, "common.deleting", "Eliminando...") : g(settings, "action.delete", "Eliminar")}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#f5ebe0]">
            <tr>
              <th className="px-5 py-3.5 text-left text-[10px] font-bold text-earth-muted uppercase tracking-wider">{g(settings, "table.service", "Servicio")}</th>
              <th className="px-5 py-3.5 text-left text-[10px] font-bold text-earth-muted uppercase tracking-wider">{g(settings, "table.duration", "Duración")}</th>
              <th className="px-5 py-3.5 text-left text-[10px] font-bold text-earth-muted uppercase tracking-wider">{g(settings, "table.price", "Precio")}</th>
              <th className="px-5 py-3.5 text-left text-[10px] font-bold text-earth-muted uppercase tracking-wider">{g(settings, "table.status", "Estado")}</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0ede8]">
            {services.map((s) => (
              <tr
                key={s.id}
                className={cn(
                  "group hover:bg-cream-dark transition",
                  !s.isActive && "opacity-50",
                  editId === s.id && "bg-primary/5 ring-1 ring-inset ring-primary/20"
                )}
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.color + "30" }}>
                      <span className="material-symbols-outlined text-[18px]" style={{ color: s.color }}>spa</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-earth">{s.name}</p>
                      {s.description && <p className="text-xs text-earth-muted">{s.description}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className="flex items-center gap-1.5 text-sm text-earth-light">
                    <span className="material-symbols-outlined text-[15px] text-[#bda696]">schedule</span>
                    {s.duration} {g(settings, "common.minutes", "min")}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className="text-sm font-semibold text-earth">{formatPrice(Number(s.price), settings)}</span>
                </td>
                <td className="px-5 py-4">
                  {s.isActive ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                      </span>
                      {g(settings, "common.active", "Activo")}
                    </span>
                  ) : (
                    <span className="text-xs text-[#bda696]">{g(settings, "common.archived", "Archivado")}</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => openEdit(s)}
                      className="p-1.5 rounded-lg hover:bg-[#e6d5c3] text-earth-muted hover:text-earth transition"
                      title={g(settings, "action.editService", "Editar")}
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button
                      onClick={() => toggleActive(s.id, s.isActive)}
                      className="p-1.5 rounded-lg hover:bg-[#e6d5c3] text-earth-muted hover:text-earth transition"
                      title={s.isActive ? g(settings, "action.archive", "Archivar") : g(settings, "action.activate", "Activar")}
                    >
                      <span className="material-symbols-outlined text-[18px]">{s.isActive ? "archive" : "unarchive"}</span>
                    </button>
                    <button
                      onClick={() => { setConfirmDelete(s.id); setDeleteError(null); }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-earth-muted hover:text-red-500 transition"
                      title={g(settings, "action.delete", "Eliminar")}
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
