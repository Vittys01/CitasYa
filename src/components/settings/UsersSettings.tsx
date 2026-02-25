"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { User, Manicurist, Schedule } from "@prisma/client";
import { cn } from "@/lib/utils";

type UserWithManicurist = User & {
  manicurist: (Manicurist & { schedules: Schedule[] }) | null;
};

type ScheduleRow = { dayOfWeek: number; startTime: string; endTime: string; isActive: boolean };

const roleBadge: Record<string, { bg: string; text: string; border: string }> = {
  OWNER:       { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
  ADMIN:       { bg: "bg-[#EDE7F6]", text: "text-[#5E35B1]", border: "border-[#D1C4E9]" },
  MANICURIST:  { bg: "bg-primary/10", text: "text-primary-dark", border: "border-primary/20" },
  RECEPTIONIST: { bg: "bg-[#E3F2FD]", text: "text-[#1565C0]", border: "border-[#BBDEFB]" },
};

const roleLabel: Record<string, string> = {
  OWNER: "Dueño",
  ADMIN: "Administrador",
  MANICURIST: "Manicurista",
  RECEPTIONIST: "Recepcionista",
};

const g = (s: Record<string, string>, k: string, fb: string) => s[k] ?? fb;

const DEFAULT_TIMES = { startTime: "09:00", endTime: "18:00" };

function buildScheduleRows(schedules: Schedule[]): ScheduleRow[] {
  const byDay = Object.fromEntries(schedules.map((s) => [s.dayOfWeek, s]));
  return Array.from({ length: 7 }, (_, i) => {
    const existing = byDay[i];
    return existing
      ? { dayOfWeek: i, startTime: existing.startTime, endTime: existing.endTime, isActive: existing.isActive }
      : { dayOfWeek: i, ...DEFAULT_TIMES, isActive: false };
  });
}

export default function UsersSettings({ users, settings = {} }: { users: UserWithManicurist[]; settings?: Record<string, string> }) {
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", color: "#b08968" });
  const [error, setError] = useState<string | null>(null);
  const [editScheduleUser, setEditScheduleUser] = useState<UserWithManicurist | null>(null);
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [editNameUser, setEditNameUser] = useState<UserWithManicurist | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [editNameSaving, setEditNameSaving] = useState(false);
  const [editNameError, setEditNameError] = useState<string | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserWithManicurist | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const router = useRouter();

  const dayName = (i: number) => {
    const name = g(settings, `calendar.day.${i}`, ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][i]);
    return name === "Vle" ? "Vie" : name;
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (roleLabel[u.role] && roleLabel[u.role].toLowerCase().includes(q))
    );
  }, [users, search]);

  const openScheduleEdit = (user: UserWithManicurist) => {
    if (!user.manicurist) return;
    setEditScheduleUser(user);
    setScheduleRows(buildScheduleRows(user.manicurist.schedules));
    setScheduleError(null);
  };

  const updateScheduleRow = (dayOfWeek: number, patch: Partial<ScheduleRow>) => {
    setScheduleRows((prev) =>
      prev.map((r) => (r.dayOfWeek === dayOfWeek ? { ...r, ...patch } : r))
    );
  };

  const saveSchedule = async () => {
    if (!editScheduleUser?.manicurist) return;
    setScheduleSaving(true);
    setScheduleError(null);
    const res = await fetch(`/api/manicurists/${editScheduleUser.manicurist.id}/schedule`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scheduleRows),
    });
    setScheduleSaving(false);
    if (!res.ok) {
      const j = await res.json();
      setScheduleError(j.error?.message ?? "Error al guardar");
      return;
    }
    setEditScheduleUser(null);
    router.refresh();
  };

  async function createManicurist() {
    setError(null);
    const res = await fetch("/api/manicurists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, schedules: [1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, startTime: "09:00", endTime: "18:00" })) }),
    });
    if (!res.ok) {
      const j = await res.json();
      setError(j.error?.message ?? "Error");
      return;
    }
    setAdding(false);
    router.refresh();
  }

  const openEditName = (user: UserWithManicurist) => {
    setEditNameUser(user);
    setEditNameValue(user.name);
    setEditNameError(null);
  };

  const saveEditName = async () => {
    if (!editNameUser || editNameValue.trim().length < 2) return;
    setEditNameSaving(true);
    setEditNameError(null);
    const res = await fetch(`/api/users/${editNameUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editNameValue.trim() }),
    });
    const j = await res.json().catch(() => ({}));
    setEditNameSaving(false);
    if (!res.ok) {
      setEditNameError(j.error?.message ?? "Error al guardar");
      return;
    }
    setEditNameUser(null);
    router.refresh();
  };

  const confirmDelete = async () => {
    if (!deleteConfirmUser) return;
    setDeleteSaving(true);
    const res = await fetch(`/api/users/${deleteConfirmUser.id}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    setDeleteSaving(false);
    setDeleteConfirmUser(null);
    if (!res.ok) {
      setError(j.error?.message ?? "Error al eliminar");
      return;
    }
    router.refresh();
  };

  const inputCls =
    "w-full px-3.5 py-2.5 text-sm border border-[#D7CCC8] rounded-lg bg-[#FFFDF5] text-[#4a3b32] placeholder-[#BCAAA4] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition";

  return (
    <section className="rounded-xl border border-[#e6d5c3] bg-[#FFFDF5] shadow-sm overflow-hidden">
      {/* Encabezado de sección */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-6 py-5 border-b border-[#e6d5c3] bg-[#fbf6f1]">
        <div>
          <h2 className="text-xl font-bold text-[#4a3b32] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#7f5539] text-[22px]">group</span>
            {g(settings, "section.team", "Gestión del equipo")}
          </h2>
          <p className="text-sm text-[#9c8273] mt-1">
            Administrá a tus manicuristas, sus horarios y disponibilidad.
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center justify-center gap-2 bg-[#7f5539] hover:bg-[#6d4a32] text-white px-5 py-2.5 rounded-lg font-semibold text-sm shadow-md shadow-[#7f5539]/20 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          {g(settings, "action.addManicurist", "Agregar miembro del equipo")}
        </button>
      </div>

      {/* Formulario agregar */}
      {adding && (
        <div className="px-6 py-5 bg-[#f5ebe0] border-b border-[#e6d5c3] space-y-4">
          <h3 className="text-sm font-bold text-[#4a3b32]">Nuevo miembro del equipo</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#7f6a5d] mb-1">{g(settings, "form.field.name", "Nombre")}</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={g(settings, "form.placeholder.nameMani", "Sofía Romero")}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#7f6a5d] mb-1">{g(settings, "table.email", "Correo electrónico")}</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder={g(settings, "form.placeholder.emailMani", "sofia@ejemplo.com")}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#7f6a5d] mb-1">{g(settings, "form.field.password", "Contraseña")}</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={g(settings, "form.placeholder.password", "Mínimo 8 caracteres")}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#7f6a5d] mb-1">{g(settings, "form.field.calendarColor", "Color en el calendario")}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-10 h-10 rounded-lg border border-[#D7CCC8] cursor-pointer"
                />
                <span className="text-xs text-[#9c8273]">{form.color}</span>
              </div>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => setAdding(false)}
              className="px-4 py-2 text-sm border border-[#D7CCC8] rounded-lg text-[#5e4b3f] hover:bg-[#efe6dd] bg-white transition"
            >
              {g(settings, "common.cancel", "Cancelar")}
            </button>
            <button
              onClick={createManicurist}
              className="px-4 py-2 text-sm font-semibold bg-[#7f5539] text-white rounded-lg hover:bg-[#6d4a32] transition"
            >
              {g(settings, "action.createManicurist", "Crear manicurista")}
            </button>
          </div>
        </div>
      )}

      {/* Barra de búsqueda */}
      <div className="flex flex-col md:flex-row gap-4 p-4 md:p-5 bg-[#fbf6f1] border-b border-[#e6d5c3]">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#bda696] text-[20px]">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, correo o rol..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#e6d5c3] rounded-lg text-sm text-[#4a3b32] placeholder-[#bda696] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
      </div>

      {/* Grid de tarjetas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
        {filtered.map((user) => (
          <div
            key={user.id}
            className="group rounded-xl border border-[#e6d5c3] bg-[#f5ebe0] hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col"
          >
            <div
              className="relative h-20 bg-gradient-to-r from-[#e8dacd] to-[#d6c4b4]"
              style={
                user.manicurist?.color
                  ? { background: `linear-gradient(135deg, ${user.manicurist.color}30, ${user.manicurist.color}15)` }
                  : undefined
              }
            >
              {user.manicurist && (
                <div
                  className="absolute top-3 right-3 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: user.manicurist.color }}
                />
              )}
            </div>
            <div className="px-5 pb-5 -mt-10 flex flex-col flex-1">
              <div className="relative mb-3">
                <div
                  className="w-20 h-20 rounded-full border-4 border-[#f5ebe0] bg-primary/20 flex items-center justify-center text-primary-dark text-2xl font-bold shadow-md"
                  style={user.manicurist?.color ? { borderColor: "#f5ebe0", backgroundColor: user.manicurist.color + "25" } : undefined}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-[#4a3b32] group-hover:text-[#7f5539] transition-colors">
                    {user.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => openEditName(user)}
                    className="p-1 rounded-lg text-[#9c8273] hover:text-[#7f5539] hover:bg-[#e6d5c3]/50 transition-colors"
                    title="Editar nombre"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                </div>
                <p className="text-sm text-[#9c8273] mt-0.5">{user.email}</p>
              </div>
              <span
                className={cn(
                  "inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border",
                  roleBadge[user.role]?.bg ?? "bg-gray-100",
                  roleBadge[user.role]?.text ?? "text-gray-700",
                  roleBadge[user.role]?.border ?? "border-gray-200"
                )}
              >
                {g(settings, `role.${user.role}`, roleLabel[user.role] ?? user.role)}
              </span>

              {user.manicurist && (
                <div className="mt-4 pt-4 border-t border-[#e6d5c3] flex-1 flex flex-col">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-[10px] font-semibold text-[#9c8273] uppercase tracking-wider">Horario</p>
                    <button
                      type="button"
                      onClick={() => openScheduleEdit(user)}
                      className="text-xs font-semibold text-[#7f5539] hover:text-[#6d4a32] flex items-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">edit</span>
                      {g(settings, "action.editSchedule", "Editar horario")}
                    </button>
                  </div>
                  {user.manicurist.schedules.filter((s) => s.isActive).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {user.manicurist.schedules
                        .filter((s) => s.isActive)
                        .map((s) => (
                          <span
                            key={s.id}
                            className="text-[10px] bg-primary/10 text-primary-dark px-2 py-1 rounded font-medium"
                          >
                            {dayName(s.dayOfWeek)} {s.startTime}–{s.endTime}
                          </span>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#9c8273]">{g(settings, "schedule.empty", "Sin horario cargado")}</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-4 mt-4 border-t border-[#e6d5c3]">
                {user.manicurist && (
                  <>
                    <button
                      type="button"
                      onClick={() => openScheduleEdit(user)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[#5e4b3f] bg-[#e6d5c3]/50 hover:bg-[#d6c4b4] transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">schedule</span>
                      Gestionar
                    </button>
                    <button
                      type="button"
                      onClick={() => openScheduleEdit(user)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[#7f5539]/15 hover:bg-[#7f5539]/25 text-[#7f5539] transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit_calendar</span>
                      Editar horario
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setDeleteConfirmUser(user)}
                  className="col-span-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">person_remove</span>
                  Eliminar del equipo
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Tarjeta "Agregar miembro" */}
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d6c4b4] bg-[#fbf6f1]/50 p-6 text-center hover:border-[#7f5539]/50 hover:bg-[#7f5539]/5 transition-all cursor-pointer group min-h-[320px]"
        >
          <div className="w-16 h-16 rounded-full bg-[#f5ebe0] flex items-center justify-center mb-4 group-hover:bg-[#7f5539]/20 text-[#bda696] group-hover:text-[#7f5539] transition-colors">
            <span className="material-symbols-outlined text-4xl">add</span>
          </div>
          <h3 className="text-base font-bold text-[#4a3b32] mb-1">Agregar miembro del equipo</h3>
          <p className="text-sm text-[#9c8273] max-w-[200px]">Registrá un nuevo manicurista en el equipo.</p>
        </button>
      </div>

      {/* Pie con cantidad */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-[#e6d5c3] bg-[#fbf6f1]">
        <p className="text-sm text-[#9c8273]">
          Mostrando {filtered.length} de {users.length} miembros
        </p>
      </div>

      {/* Modal editar horario */}
      {editScheduleUser?.manicurist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm" onClick={() => setEditScheduleUser(null)} />
          <div
            className="relative w-full max-w-lg bg-[#FFFDF5] rounded-2xl shadow-2xl border border-[#e6d5c3] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[#e6d5c3] bg-[#fbf6f1] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#4a3b32]">
                  {g(settings, "action.editSchedule", "Editar horario")} — {editScheduleUser.name}
                </h3>
                <p className="text-xs text-[#9c8273] mt-0.5">
                  {g(settings, "schedule.editSub", "Las citas se ofrecen según este horario")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditScheduleUser(null)}
                className="p-1.5 rounded-lg hover:bg-[#efe6dd] text-[#9c8273] transition-colors"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[70vh]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e6d5c3]">
                    <th className="text-left py-2 text-[10px] font-bold text-[#9c8273] uppercase">{g(settings, "calendar.dayLabel", "Día")}</th>
                    <th className="text-left py-2 text-[10px] font-bold text-[#9c8273] uppercase w-20">{g(settings, "common.active", "Activo")}</th>
                    <th className="text-left py-2 text-[10px] font-bold text-[#9c8273] uppercase">{g(settings, "schedule.from", "Desde")}</th>
                    <th className="text-left py-2 text-[10px] font-bold text-[#9c8273] uppercase">{g(settings, "schedule.to", "Hasta")}</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleRows.map((row) => (
                    <tr key={row.dayOfWeek} className="border-b border-[#f0ede8]">
                      <td className="py-2.5 font-medium text-[#4a3b32]">{dayName(row.dayOfWeek)}</td>
                      <td className="py-2.5">
                        <input
                          type="checkbox"
                          checked={row.isActive}
                          onChange={(e) => updateScheduleRow(row.dayOfWeek, { isActive: e.target.checked })}
                          className="rounded border-[#D7CCC8] text-primary-dark focus:ring-primary/30"
                        />
                      </td>
                      <td className="py-2.5">
                        <input
                          type="time"
                          value={row.startTime}
                          onChange={(e) => updateScheduleRow(row.dayOfWeek, { startTime: e.target.value })}
                          disabled={!row.isActive}
                          className="w-full px-2 py-1.5 text-xs border border-[#D7CCC8] rounded-lg bg-[#FFFDF5] disabled:opacity-50 text-[#4a3b32]"
                        />
                      </td>
                      <td className="py-2.5">
                        <input
                          type="time"
                          value={row.endTime}
                          onChange={(e) => updateScheduleRow(row.dayOfWeek, { endTime: e.target.value })}
                          disabled={!row.isActive}
                          className="w-full px-2 py-1.5 text-xs border border-[#D7CCC8] rounded-lg bg-[#FFFDF5] disabled:opacity-50 text-[#4a3b32]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {scheduleError && <p className="text-red-600 text-sm mt-3">{scheduleError}</p>}
            </div>
            <div className="px-5 py-4 border-t border-[#e6d5c3] bg-[#fbf6f1] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditScheduleUser(null)}
                className="px-4 py-2 text-sm border border-[#D7CCC8] rounded-lg text-[#5e4b3f] hover:bg-[#efe6dd] bg-white transition"
              >
                {g(settings, "common.cancel", "Cancelar")}
              </button>
              <button
                type="button"
                onClick={saveSchedule}
                disabled={scheduleSaving}
                className="px-4 py-2 text-sm font-semibold bg-[#7f5539] text-white rounded-lg hover:bg-[#6d4a32] transition disabled:opacity-50"
              >
                {scheduleSaving ? g(settings, "common.saving", "Guardando…") : g(settings, "common.save", "Guardar")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar nombre */}
      {editNameUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm" onClick={() => setEditNameUser(null)} />
          <div
            className="relative w-full max-w-sm bg-[#FFFDF5] rounded-2xl shadow-2xl border border-[#e6d5c3] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[#e6d5c3] bg-[#fbf6f1] flex items-center justify-between">
              <h3 className="text-base font-bold text-[#4a3b32]">Editar nombre</h3>
              <button
                type="button"
                onClick={() => setEditNameUser(null)}
                className="p-1.5 rounded-lg hover:bg-[#efe6dd] text-[#9c8273] transition-colors"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>
            <div className="p-5">
              <label className="block text-xs font-semibold text-[#7f6a5d] mb-1">Nombre</label>
              <input
                type="text"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                placeholder="Nombre del miembro"
                className="w-full px-3.5 py-2.5 text-sm border border-[#D7CCC8] rounded-lg bg-[#FFFDF5] text-[#4a3b32] placeholder-[#BCAAA4] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              {editNameError && <p className="text-sm text-red-600 mt-2">{editNameError}</p>}
            </div>
            <div className="px-5 py-4 border-t border-[#e6d5c3] bg-[#fbf6f1] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditNameUser(null)}
                className="px-4 py-2 text-sm border border-[#D7CCC8] rounded-lg text-[#5e4b3f] hover:bg-[#efe6dd] bg-white transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveEditName}
                disabled={editNameSaving || editNameValue.trim().length < 2}
                className="px-4 py-2 text-sm font-semibold bg-[#7f5539] text-white rounded-lg hover:bg-[#6d4a32] transition disabled:opacity-50"
              >
                {editNameSaving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar eliminar */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm" onClick={() => !deleteSaving && setDeleteConfirmUser(null)} />
          <div
            className="relative w-full max-w-sm bg-[#FFFDF5] rounded-2xl shadow-2xl border border-[#e6d5c3] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[#e6d5c3] bg-[#fbf6f1]">
              <h3 className="text-base font-bold text-[#4a3b32]">Eliminar del equipo</h3>
              <p className="text-sm text-[#7f6a5d] mt-1">
                ¿Querés eliminar a <strong>{deleteConfirmUser.name}</strong>? Si tiene turnos asignados, se desactivará la cuenta en lugar de borrarla.
              </p>
            </div>
            <div className="px-5 py-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                disabled={deleteSaving}
                className="px-4 py-2 text-sm border border-[#D7CCC8] rounded-lg text-[#5e4b3f] hover:bg-[#efe6dd] bg-white transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteSaving}
                className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleteSaving ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
