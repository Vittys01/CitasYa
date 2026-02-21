"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  format,
  addDays,
  startOfWeek,
  isSameDay,
  differenceInMinutes,
  setHours,
  setMinutes,
} from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format-price";
import type { Manicurist, Client, Schedule } from "@prisma/client";
import type { ServiceForClient, AppointmentForClient } from "@/lib/serialize";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Day start hour shown in the grid */
const GRID_START_HOUR = 8;
/** Number of hours visible */
const GRID_HOURS      = 12; // 8 AM → 8 PM
/** Pixel height per hour */
const PX_PER_HOUR     = 96;
/** Min width per day column (week view) so overlapping appointments don’t get squished */
const MIN_DAY_WIDTH_PX = 160;

type ManicuristWithDetails = Manicurist & {
  user: { id: string; name: string };
  schedules: Schedule[];
};

export type EmptySlotPayload = { date: string; startAt: string; manicuristId?: string };

interface CalendarProps {
  initialAppointments: AppointmentForClient[];
  /** YYYY-MM-DD of the Monday of the week that initialAppointments is for */
  initialWeekStartKey: string;
  manicurists: ManicuristWithDetails[];
  services: ServiceForClient[];
  clients: Client[];
  settings?: Record<string, string>;
  lockedManicuristId?: string;
  onEmptySlotClick?: (slot: EmptySlotPayload) => void;
}

// ─── Status style map ─────────────────────────────────────────────────────────

const apptStyle: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  PENDING:   { bg: "bg-[#f4ece4]",   border: "border-[#c7b299]", text: "text-[#5c4030]", badge: "bg-[#e8e0d5] text-[#8c7352]" },
  CONFIRMED: { bg: "bg-[#f0ebd8]",   border: "border-[#a68a64]", text: "text-[#4a3b28]", badge: "bg-[#e8e0d5] text-[#8c7352]" },
  COMPLETED: { bg: "bg-[#ede4d8]",   border: "border-[#8c7352]", text: "text-[#3e2e1e]", badge: "bg-[#d6cbb6] text-[#5c4d3c]" },
  CANCELLED: { bg: "bg-stone-50",     border: "border-stone-300", text: "text-stone-400",  badge: "bg-stone-100 text-stone-400" },
};

const defaultStatusLabel: Record<string, string> = {
  PENDING:   "Pendiente",
  CONFIRMED: "Confirmado",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

// ─── Helper: pixel offset from top of grid ────────────────────────────────────

function topPx(date: Date): number {
  const minutes = (date.getHours() - GRID_START_HOUR) * 60 + date.getMinutes();
  return (minutes / 60) * PX_PER_HOUR;
}

function heightPx(start: Date, end: Date): number {
  const mins = Math.max(differenceInMinutes(end, start), 30);
  return (mins / 60) * PX_PER_HOUR;
}

/** Two intervals [s1,e1] and [s2,e2] overlap if s1 < e2 && s2 < e1 */
function overlaps(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1.getTime() < end2.getTime() && start2.getTime() < end1.getTime();
}

/**
 * For each appointment in the list, assign a column index so that overlapping
 * appointments get different columns (side-by-side). Returns a map apptId -> { columnIndex, totalColumns }.
 */
function computeColumns<T extends { id: string; startAt: Date | string; endAt: Date | string }>(
  appts: T[]
): Map<string, { columnIndex: number; totalColumns: number }> {
  const result = new Map<string, { columnIndex: number; totalColumns: number }>();
  if (appts.length === 0) return result;

  const sorted = [...appts].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );
  const columnAssigned = new Map<string, number>();

  for (const appt of sorted) {
    const start = new Date(appt.startAt);
    const end   = new Date(appt.endAt);
    const overlapping = sorted.filter(
      (o) =>
        o.id !== appt.id &&
        overlaps(start, end, new Date(o.startAt), new Date(o.endAt))
    );
    const usedColumns = new Set(
      overlapping.map((o) => columnAssigned.get(o.id)).filter((c): c is number => c !== undefined)
    );
    let col = 0;
    while (usedColumns.has(col)) col++;
    columnAssigned.set(appt.id, col);
  }

  for (const appt of sorted) {
    const start = new Date(appt.startAt);
    const end   = new Date(appt.endAt);
    const overlapping = sorted.filter((o) =>
      overlaps(start, end, new Date(o.startAt), new Date(o.endAt))
    );
    const maxCol = Math.max(
      ...overlapping.map((o) => columnAssigned.get(o.id) ?? 0),
      columnAssigned.get(appt.id) ?? 0
    );
    const totalColumns = maxCol + 1;
    result.set(appt.id, {
      columnIndex: columnAssigned.get(appt.id) ?? 0,
      totalColumns,
    });
  }
  return result;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AppointmentsCalendar({
  initialAppointments,
  initialWeekStartKey,
  manicurists,
  settings,
  lockedManicuristId,
  onEmptySlotClick,
}: CalendarProps) {
  const router = useRouter();
  const statusLabel = (status: string) => (settings && settings[`status.${status}`]) ?? defaultStatusLabel[status] ?? status;
  type StatusFilter = "all" | "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

  const [view, setView]           = useState<"week" | "day">("week");
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [weekStart, setWeekStart]  = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [filterMani, setFilterMani] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [appointments, setAppointments] = useState<AppointmentForClient[]>(initialAppointments);
  const [fetchedByWeek, setFetchedByWeek] = useState<Record<string, AppointmentForClient[]>>({});
  const [loadingWeek, setLoadingWeek] = useState<string | null>(null);

  // Sincronizar con datos del servidor cuando cambian (p. ej. tras crear turno y router.refresh())
  useEffect(() => {
    setAppointments(initialAppointments);
  }, [initialAppointments]);

  // Semana que estamos mostrando (en vista día es la semana del día seleccionado)
  const viewWeekStart = view === "week" ? weekStart : startOfWeek(selectedDay, { weekStartsOn: 1 });
  const viewWeekKey = format(viewWeekStart, "yyyy-MM-dd");

  // Cargar citas de otras semanas desde la API
  useEffect(() => {
    if (viewWeekKey === initialWeekStartKey) return;
    if (fetchedByWeek[viewWeekKey] !== undefined) return;

    let cancelled = false;
    setLoadingWeek(viewWeekKey);
    const params = new URLSearchParams({ weekStart: viewWeekStart.toISOString() });
    if (lockedManicuristId) params.set("manicuristId", lockedManicuristId);
    fetch(`/api/appointments?${params}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        const list = (json?.data ?? []).map((a: AppointmentForClient & { price?: unknown }) =>
          typeof a.price === "number" ? a : { ...a, price: Number(a.price ?? 0) }
        ) as AppointmentForClient[];
        setFetchedByWeek((prev) => ({ ...prev, [viewWeekKey]: list }));
      })
      .finally(() => {
        if (!cancelled) setLoadingWeek(null);
      });
    return () => { cancelled = true; };
  }, [viewWeekKey, initialWeekStartKey, lockedManicuristId]);

  const displayAppointments = viewWeekKey === initialWeekStartKey
    ? appointments
    : (fetchedByWeek[viewWeekKey] ?? []);

  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentForClient | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const goToToday = useCallback(() => {
    const today = new Date();
    setSelectedDay(today);
    setWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
    setView("day");
  }, []);

  const prevWeek = useCallback(() => setWeekStart((d) => addDays(d, -7)), []);
  const nextWeek = useCallback(() => setWeekStart((d) => addDays(d, 7)), []);

  const prevDay = useCallback(() => {
    setSelectedDay((d) => addDays(d, -1));
  }, []);
  const nextDay = useCallback(() => {
    setSelectedDay((d) => addDays(d, 1));
  }, []);

  const filtered = useMemo(
    () =>
      displayAppointments.filter((a) => {
        if (filterMani !== "all" && a.manicuristId !== filterMani) return false;
        if (filterStatus !== "all" && a.status !== filterStatus) return false;
        return true;
      }),
    [displayAppointments, filterMani, filterStatus]
  );

  const viewDays = view === "week" ? days : [selectedDay];

  /** En vista día: manicuristas a mostrar como columnas (según filtro) */
  const dayViewManicurists = useMemo(
    () => (filterMani === "all" ? manicurists : manicurists.filter((m) => m.id === filterMani)),
    [manicurists, filterMani]
  );

  function getApptForDay(day: Date) {
    return filtered.filter((a) => isSameDay(new Date(a.startAt), day));
  }

  function getApptForDayAndManicurist(day: Date, manicuristId: string) {
    return getApptForDay(day).filter((a) => a.manicuristId === manicuristId);
  }

  const hours = Array.from({ length: GRID_HOURS }, (_, i) => GRID_START_HOUR + i);
  const gridHeight = GRID_HOURS * PX_PER_HOUR;

  const statusShort: Record<string, string> = {
    PENDING: "Pend.",
    CONFIRMED: "Conf.",
    COMPLETED: "Compl.",
    CANCELLED: "Canc.",
  };

  return (
    <div className="bg-[#FFFDF5] rounded-xl border border-[#e6d5c3] shadow-warm-sm overflow-hidden flex flex-col">

      {/* ── Detail modal (click on appointment) ───────────────────────────────── */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm" onClick={() => setSelectedAppointment(null)} />
          <div
            className="relative w-full max-w-md bg-[#FFFDF5] rounded-2xl shadow-2xl border border-[#e6d5c3] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="h-1.5 w-full"
              style={{ backgroundColor: selectedAppointment.manicurist.color }}
            />
            <div className="p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-bold text-earth">
                  {(settings && settings["calendar.detailTitle"]) ?? "Detalle del turno"}
                </h3>
                <button
                  onClick={() => setSelectedAppointment(null)}
                  className="p-1.5 rounded-lg hover:bg-cream-dark text-earth-muted hover:text-earth transition"
                >
                  <span className="material-symbols-outlined text-[22px]">close</span>
                </button>
              </div>
              <div className="grid gap-4">
                <div>
                  <p className="text-[10px] font-bold text-earth-muted uppercase tracking-wider mb-1">
                    {(settings && settings["form.section.clientData"]) ?? "Cliente"}
                  </p>
                  <p className="text-sm font-semibold text-earth">{selectedAppointment.client.name}</p>
                  {selectedAppointment.client.phone && (
                    <p className="text-xs text-earth-muted mt-0.5">{selectedAppointment.client.phone}</p>
                  )}
                  {selectedAppointment.client.email && (
                    <p className="text-xs text-earth-muted">{selectedAppointment.client.email}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-8 rounded-full shrink-0"
                    style={{ backgroundColor: selectedAppointment.manicurist.color }}
                  />
                  <div>
                    <p className="text-[10px] font-bold text-earth-muted uppercase tracking-wider">
                      {(settings && settings["form.field.manicurist"]) ?? "Profesional"}
                    </p>
                    <p className="text-sm font-semibold text-earth">{selectedAppointment.manicurist.user.name}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-earth-muted uppercase tracking-wider mb-1">
                    {(settings && settings["form.section.service"]) ?? "Servicio"}
                  </p>
                  <p className="text-sm font-semibold text-earth">{selectedAppointment.service.name}</p>
                  <p className="text-xs text-earth-muted mt-0.5">
                    {selectedAppointment.service.duration} {(settings && settings["common.minutes"]) ?? "min"} · {formatPrice(Number(selectedAppointment.price), settings)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-earth-muted uppercase tracking-wider mb-1">
                    {(settings && settings["form.section.schedule"]) ?? "Horario"}
                  </p>
                  <p className="text-sm text-earth">
                    {format(new Date(selectedAppointment.startAt), "EEEE d 'de' MMMM", { locale: es })}
                  </p>
                  <p className="text-sm font-semibold text-earth mt-0.5">
                    {format(new Date(selectedAppointment.startAt), "HH:mm")} – {format(new Date(selectedAppointment.endAt), "HH:mm")}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-earth-muted uppercase tracking-wider">
                    {(settings && settings["table.status"]) ?? "Estado"}
                  </span>
                  <span className={cn("text-xs font-bold px-2 py-1 rounded uppercase", apptStyle[selectedAppointment.status].badge)}>
                    {statusLabel(selectedAppointment.status)}
                  </span>
                </div>
                {selectedAppointment.notes && (
                  <div>
                    <p className="text-[10px] font-bold text-earth-muted uppercase tracking-wider mb-1">
                      {(settings && settings["form.field.internalNotes"]) ?? "Notas"}
                    </p>
                    <p className="text-sm text-earth-muted">{selectedAppointment.notes}</p>
                  </div>
                )}
              </div>
              {/* Cancel appointment — only for pending/confirmed */}
              {selectedAppointment.status !== "CANCELLED" && selectedAppointment.status !== "COMPLETED" && (
                <div className="pt-4 mt-4 border-t border-[#e6d5c3]">
                  {cancelError && <p className="text-red-500 text-xs mb-2">{cancelError}</p>}
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm((settings && settings["confirm.cancelAppointment"]) ?? "¿Cancelar este turno?")) return;
                      setCancelError(null);
                      setCancelling(true);
                      const res = await fetch(`/api/appointments/${selectedAppointment.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "CANCELLED" }),
                      });
                      setCancelling(false);
                      if (!res.ok) {
                        const j = await res.json();
                        setCancelError(j.error?.message ?? "Error al cancelar");
                        return;
                      }
                      setAppointments((prev) =>
                        prev.map((a) => (a.id === selectedAppointment.id ? { ...a, status: "CANCELLED" as const } : a))
                      );
                      setSelectedAppointment(null);
                      router.refresh();
                    }}
                    disabled={cancelling}
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">cancel</span>
                    {cancelling ? ((settings && settings["common.cancelling"]) ?? "Cancelando...") : ((settings && settings["action.cancelAppointment"]) ?? "Cancelar turno")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Toolbar: vista y navegación ─────────────────────────────────────── */}
      <div className="px-5 py-3.5 border-b border-[#e6d5c3] bg-[#fbf6f1] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center bg-[#f5ebe0] p-1 rounded-lg">
            <button
              onClick={() => {
                setView("week");
                setWeekStart(startOfWeek(selectedDay, { weekStartsOn: 1 }));
              }}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                view === "week"
                  ? "bg-white text-earth shadow-warm-sm"
                  : "text-earth-muted hover:text-earth"
              )}
            >
              {(settings && settings["calendar.view.week"]) ?? "Semana"}
            </button>
            <button
              onClick={() => setView("day")}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                view === "day"
                  ? "bg-white text-earth shadow-warm-sm"
                  : "text-earth-muted hover:text-earth"
              )}
            >
              {(settings && settings["calendar.view.day"]) ?? "Día"}
            </button>
          </div>
          <div className="flex items-center gap-1 border border-[#e6d5c3] rounded-lg p-0.5 bg-white">
            <button
              onClick={view === "day" ? prevDay : prevWeek}
              className="p-1.5 hover:bg-cream-dark rounded-md text-earth-muted hover:text-earth transition"
              title={view === "day" ? "Día anterior" : "Semana anterior"}
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <button
              onClick={view === "day" ? nextDay : nextWeek}
              className="p-1.5 hover:bg-cream-dark rounded-md text-earth-muted hover:text-earth transition"
              title={view === "day" ? "Día siguiente" : "Semana siguiente"}
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#e6d5c3] bg-white text-earth-muted hover:text-earth hover:bg-[#f5ebe0] transition"
          >
            {(settings && settings["calendar.today"]) ?? "Hoy"}
          </button>
          <h2 className="text-sm font-bold text-earth hidden sm:block min-w-0 truncate max-w-[200px] md:max-w-none flex items-center gap-2">
            {loadingWeek === viewWeekKey ? (
              <span className="text-earth-muted font-normal">Cargando…</span>
            ) : view === "week" ? (
              `${format(weekStart, "d MMM", { locale: es })} – ${format(addDays(weekStart, 6), "d MMM yyyy", { locale: es })}`
            ) : (
              format(selectedDay, "EEEE d MMM yyyy", { locale: es })
            )}
          </h2>
        </div>
      </div>

      {/* ── Filtros: profesional y estado ────────────────────────────────────── */}
      <div className="px-5 py-3 border-b border-[#e6d5c3] bg-white flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-[#9c8273] uppercase tracking-wider shrink-0">
            {(settings && settings["calendar.filter.professional"]) ?? "Profesional:"}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterMani("all")}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition font-medium",
                filterMani === "all"
                  ? "bg-primary-dark text-white border-primary-dark"
                  : "text-earth-muted border-[#e6d5c3] hover:bg-[#f5ebe0]"
              )}
            >
              {(settings && settings["calendar.filter.all"]) ?? "Todas"}
            </button>
            {manicurists.map((m) => (
              <button
                key={m.id}
                onClick={() => setFilterMani(m.id)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-full border transition font-medium",
                  filterMani === m.id
                    ? "text-white border-transparent"
                    : "text-earth-muted border-[#e6d5c3] hover:bg-[#f5ebe0]"
                )}
                style={
                  filterMani === m.id
                    ? { backgroundColor: m.color, borderColor: m.color }
                    : {}
                }
              >
                {m.user.name.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-[#9c8273] uppercase tracking-wider shrink-0">
            {(settings && settings["calendar.filter.status"]) ?? "Estado:"}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { value: "all" as const, label: (settings && settings["calendar.filter.allStatus"]) ?? "Todos" },
                { value: "PENDING" as const, label: statusLabel("PENDING") },
                { value: "CONFIRMED" as const, label: statusLabel("CONFIRMED") },
                { value: "COMPLETED" as const, label: statusLabel("COMPLETED") },
                { value: "CANCELLED" as const, label: statusLabel("CANCELLED") },
              ] as const
            ).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilterStatus(value)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-full border transition font-medium",
                  filterStatus === value
                    ? "bg-primary-dark text-white border-primary-dark"
                    : "text-earth-muted border-[#e6d5c3] hover:bg-[#f5ebe0]"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Calendar grid ───────────────────────────────────────────────────── */}
      <div className="overflow-auto no-scrollbar">
        <div
          className={cn(view === "day" && "min-w-[320px]")}
          style={
            view === "week"
              ? { minWidth: 64 + 7 * MIN_DAY_WIDTH_PX }
              : view === "day" && dayViewManicurists.length > 0
                ? { minWidth: 64 + dayViewManicurists.length * MIN_DAY_WIDTH_PX }
                : undefined
          }
        >

          {/* Headers: en semana = días; en día = columnas por manicurista */}
          <div
            className={cn(
              "grid border-b border-[#e6d5c3] bg-white sticky top-0 z-20",
              view === "week" ? "grid-cols-[64px_repeat(7,minmax(160px,1fr))]" : "grid-cols-[64px_repeat(var(--day-cols),minmax(160px,1fr))]"
            )}
            style={
              view === "week"
                ? { gridTemplateColumns: `64px repeat(7, minmax(${MIN_DAY_WIDTH_PX}px, 1fr))` }
                : view === "day"
                  ? { gridTemplateColumns: `64px repeat(${Math.max(1, dayViewManicurists.length)}, minmax(${MIN_DAY_WIDTH_PX}px, 1fr))` }
                  : undefined
            }
          >
            <div className="border-r border-[#e6d5c3]" />
            {view === "week" &&
              viewDays.map((day) => {
                const isToday = isSameDay(day, new Date());
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => { setSelectedDay(day); setView("day"); }}
                    className={cn(
                      "px-2 py-3 text-center border-r border-[#e6d5c3] last:border-r-0 hover:bg-cream-dark transition",
                      isToday ? "bg-primary/5" : ""
                    )}
                  >
                    <p className="text-[10px] font-semibold uppercase text-earth-muted">
                      {format(day, "EEE", { locale: es })}
                    </p>
                    <div
                      className={cn(
                        "w-8 h-8 mx-auto mt-1 flex items-center justify-center rounded-full text-sm font-bold",
                        isToday
                          ? "bg-primary-dark text-white shadow-md shadow-primary/30"
                          : "text-earth"
                      )}
                    >
                      {format(day, "d")}
                    </div>
                  </button>
                );
              })}
            {view === "day" &&
              (dayViewManicurists.length > 0 ? (
                dayViewManicurists.map((m) => (
                  <div
                    key={m.id}
                    className="px-2 py-3 text-center border-r border-[#e6d5c3] last:border-r-0 flex flex-col items-center justify-center gap-1"
                    style={{ borderTop: `3px solid ${m.color}` }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ backgroundColor: m.color }}
                    >
                      {m.user.name.charAt(0)}
                    </div>
                    <p className="text-xs font-semibold text-earth leading-tight truncate w-full">
                      {m.user.name.split(" ")[0]}
                    </p>
                  </div>
                ))
              ) : (
                <div className="col-span-1 px-2 py-3 text-center text-[#9c8273] text-sm">
                  {(settings && settings["calendar.noManicurists"]) ?? "Sin profesionales"}
                </div>
              ))}
          </div>

          {/* Time grid + appointments */}
          <div className="flex relative">

            {/* Current time indicator */}
            <CurrentTimeLine gridStartHour={GRID_START_HOUR} pxPerHour={PX_PER_HOUR} />

            {/* Hour labels */}
            <div className="w-16 shrink-0 relative border-r border-[#e6d5c3]">
              {hours.map((h) => (
                <div key={h} style={{ height: PX_PER_HOUR }} className="relative">
                  <span className="absolute -top-2.5 right-2 text-[10px] font-medium text-[#bda696] bg-[#FFFDF5] px-1 select-none">
                    {h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`}
                  </span>
                </div>
              ))}
            </div>

            {/* Columnas: semana = por día; día = por manicurista */}
            <div
              className={cn("flex-1 grid min-w-0", view === "week" && "grid-cols-7")}
              style={
                view === "week"
                  ? { gridTemplateColumns: `repeat(7, minmax(${MIN_DAY_WIDTH_PX}px, 1fr))` }
                  : view === "day"
                    ? { gridTemplateColumns: `repeat(${Math.max(1, dayViewManicurists.length)}, minmax(${MIN_DAY_WIDTH_PX}px, 1fr))` }
                    : undefined
              }
            >
              {view === "week" &&
                viewDays.map((day) => {
                  const dayAppts   = getApptForDay(day);
                  const dayOfWeek  = day.getDay();
                  const columnMap  = computeColumns(dayAppts);
                  const workBands = manicurists
                    .filter((m) => filterMani === "all" || m.id === filterMani)
                    .flatMap((m) => {
                      const sched = m.schedules.find(
                        (s) => s.isActive && s.dayOfWeek === dayOfWeek
                      );
                      if (!sched) return [];
                      const [sh, sm] = sched.startTime.split(":").map(Number);
                      const [eh, em] = sched.endTime.split(":").map(Number);
                      const topOffset  = ((sh + sm / 60) - GRID_START_HOUR) * PX_PER_HOUR;
                      const bandHeight = ((eh + em / 60) - (sh + sm / 60)) * PX_PER_HOUR;
                      return [{ manicuristId: m.id, color: m.color, top: topOffset, height: bandHeight }];
                    });

                  return (
                    <DayColumn
                      key={day.toISOString()}
                      gridHeight={gridHeight}
                      workBands={workBands}
                      hours={hours}
                      dayAppts={dayAppts}
                      columnMap={columnMap}
                      showManiChip={filterMani === "all"}
                      apptStyle={apptStyle}
                      statusShort={statusShort}
                      statusLabel={statusLabel}
                      settings={settings}
                      formatPrice={formatPrice}
                      onApptClick={setSelectedAppointment}
                      onEmptySlotClick={onEmptySlotClick}
                      slotDay={day}
                      slotManicuristId={undefined}
                    />
                  );
                })}
              {view === "day" &&
                (dayViewManicurists.length > 0
                  ? dayViewManicurists.map((m) => {
                      const dayAppts  = getApptForDayAndManicurist(selectedDay, m.id);
                      const dayOfWeek = selectedDay.getDay();
                      const columnMap  = computeColumns(dayAppts);
                      const sched = m.schedules.find(
                        (s) => s.isActive && s.dayOfWeek === dayOfWeek
                      );
                      const workBands = sched
                        ? (() => {
                            const [sh, sm] = sched.startTime.split(":").map(Number);
                            const [eh, em] = sched.endTime.split(":").map(Number);
                            const topOffset  = ((sh + sm / 60) - GRID_START_HOUR) * PX_PER_HOUR;
                            const bandHeight = ((eh + em / 60) - (sh + sm / 60)) * PX_PER_HOUR;
                            return [{ manicuristId: m.id, color: m.color, top: topOffset, height: bandHeight }];
                          })()
                        : [];

                      return (
                        <DayColumn
                          key={m.id}
                          gridHeight={gridHeight}
                          workBands={workBands}
                          hours={hours}
                          dayAppts={dayAppts}
                          columnMap={columnMap}
                          showManiChip={false}
                          apptStyle={apptStyle}
                          statusShort={statusShort}
                          statusLabel={statusLabel}
                          settings={settings}
                          formatPrice={formatPrice}
                          onApptClick={setSelectedAppointment}
                          onEmptySlotClick={onEmptySlotClick}
                          slotDay={selectedDay}
                          slotManicuristId={m.id}
                        />
                      );
                    })
                  : (
                    <div className="border-r border-[#e6d5c3] relative flex items-center justify-center text-[#9c8273] text-sm" style={{ height: gridHeight }}>
                      {(settings && settings["calendar.noManicurists"]) ?? "Sin profesionales"}
                    </div>
                  ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Day column (una columna de la grilla: bandas, horas, turnos) ─────────────

type WorkBand = { manicuristId: string; color: string; top: number; height: number };

function slotFromOffsetY(offsetY: number, slotDay: Date): Date {
  const totalMinutes = GRID_START_HOUR * 60 + (offsetY / PX_PER_HOUR) * 60;
  const rounded = Math.max(0, Math.round(totalMinutes / 15) * 15);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  const start = new Date(slotDay);
  start.setHours(h, m, 0, 0);
  return start;
}

function DayColumn({
  gridHeight,
  workBands,
  hours,
  dayAppts,
  columnMap,
  showManiChip,
  apptStyle,
  statusShort,
  statusLabel,
  settings,
  formatPrice,
  onApptClick,
  onEmptySlotClick,
  slotDay,
  slotManicuristId,
}: {
  gridHeight: number;
  workBands: WorkBand[];
  hours: number[];
  dayAppts: AppointmentForClient[];
  columnMap: Map<string, { columnIndex: number; totalColumns: number }>;
  showManiChip: boolean;
  apptStyle: Record<string, { bg: string; border: string; text: string; badge: string }>;
  statusShort: Record<string, string>;
  statusLabel: (s: string) => string;
  settings?: Record<string, string>;
  formatPrice: (n: number, s?: Record<string, string>) => string;
  onApptClick: (a: AppointmentForClient) => void;
  onEmptySlotClick?: (slot: EmptySlotPayload) => void;
  slotDay: Date;
  slotManicuristId?: string;
}) {
  const handleColumnClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onEmptySlotClick) return;
      if ((e.target as HTMLElement).closest("button")) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      if (offsetY < 0 || offsetY > gridHeight) return;
      const startAt = slotFromOffsetY(offsetY, slotDay);
      const dateStr = format(slotDay, "yyyy-MM-dd");
      onEmptySlotClick({
        date: dateStr,
        startAt: startAt.toISOString(),
        ...(slotManicuristId && { manicuristId: slotManicuristId }),
      });
    },
    [onEmptySlotClick, slotDay, slotManicuristId, gridHeight]
  );

  return (
    <div
      className={cn(
        "border-r border-[#e6d5c3] last:border-r-0 relative",
        onEmptySlotClick && "cursor-pointer"
      )}
      style={{ height: gridHeight }}
      onClick={handleColumnClick}
      role={onEmptySlotClick ? "button" : undefined}
      aria-label={onEmptySlotClick ? "Agregar turno en este horario" : undefined}
    >
      {workBands.map((band, i) => (
        <div
          key={`${band.manicuristId}-${i}`}
          className="absolute left-0 right-0 pointer-events-none z-0"
          style={{
            top:    Math.max(0, band.top),
            height: Math.min(band.height, gridHeight - Math.max(0, band.top)),
            backgroundColor: band.color + "12",
            borderLeft: `2px solid ${band.color}30`,
          }}
        />
      ))}
      {hours.map((h) => (
        <div key={h}>
          <div
            className="absolute left-0 right-0 border-t border-[#f0ede8] z-[1]"
            style={{ top: (h - GRID_START_HOUR) * PX_PER_HOUR }}
          />
          <div
            className="absolute left-0 right-0 border-t border-dashed border-[#f5ebe0] z-[1]"
            style={{ top: (h - GRID_START_HOUR) * PX_PER_HOUR + PX_PER_HOUR / 2 }}
          />
        </div>
      ))}
      {dayAppts.map((appt) => {
        const start        = new Date(appt.startAt);
        const end          = new Date(appt.endAt);
        const top          = topPx(start);
        const height       = heightPx(start, end);
        const s            = apptStyle[appt.status];
        const short        = height < 60;
        const maniColor    = appt.manicurist.color;
        const maniName     = appt.manicurist.user.name.split(" ")[0];
        const cols         = columnMap.get(appt.id);
        const totalCols    = cols?.totalColumns ?? 1;
        const colIndex     = cols?.columnIndex ?? 0;
        const isSideBySide = totalCols > 1;
        const leftPct      = isSideBySide ? 4 + colIndex * (92 / totalCols) : 4;
        const widthPct     = isSideBySide ? 92 / totalCols - 0.5 : 92;

        return (
          <button
            key={appt.id}
            type="button"
            onClick={() => onApptClick(appt)}
            className={cn(
              "absolute rounded-r-md rounded-l-sm border-l-4 px-2 py-1.5 cursor-pointer hover:brightness-95 transition-all hover:shadow-warm-sm z-10 text-left w-full min-w-0 flex flex-col",
              s.bg, s.text
            )}
            style={{
              top,
              left: `${leftPct}%`,
              width: `${widthPct}%`,
              height: Math.max(height, 28),
              borderLeftColor: showManiChip ? maniColor : undefined,
              borderLeftStyle: "solid",
              borderLeftWidth: "4px",
            }}
            title={`${appt.client.name} · ${appt.service.name} · ${appt.manicurist.user.name} · ${formatPrice(Number(appt.price), settings)} — Click para ver detalle`}
          >
            <div className="flex items-start justify-between gap-1 min-h-0 flex-1 min-w-0">
              <p className="text-xs font-bold leading-tight truncate min-w-0">{appt.client.name}</p>
              <span className={cn("text-[9px] font-bold px-1 py-0.5 rounded uppercase tracking-wide whitespace-nowrap flex-shrink-0", s.badge)}>
                {short ? statusShort[appt.status] ?? appt.status : statusLabel(appt.status)}
              </span>
            </div>
            {!short && (
              <p className="text-[10px] opacity-70 truncate mt-0.5 leading-tight">{appt.service.name}</p>
            )}
            <div className="flex items-center justify-between mt-0.5 gap-1 flex-shrink-0">
              <span className="text-[10px] opacity-60 whitespace-nowrap tabular-nums">
                {format(start, "HH:mm")} – {format(end, "HH:mm")}
              </span>
              {showManiChip && !short && (
                <span
                  className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap truncate max-w-[72px] min-w-0"
                  style={{ backgroundColor: maniColor + "25", color: maniColor }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: maniColor }} />
                  {maniName}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Current time indicator (solo en cliente para evitar hydration mismatch) ───

function CurrentTimeLine({ gridStartHour, pxPerHour }: { gridStartHour: number; pxPerHour: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const now      = new Date();
  const topPixel = ((now.getHours() - gridStartHour) * 60 + now.getMinutes()) / 60 * pxPerHour;

  if (topPixel < 0 || topPixel > (GRID_HOURS * pxPerHour)) return null;

  return (
    <div
      className="absolute left-0 right-0 z-30 flex items-center pointer-events-none"
      style={{ top: `${topPixel}px` }}
    >
      <div className="w-16 text-right pr-2">
        <span className="text-[10px] font-bold text-primary-dark bg-[#FFFDF5] px-1">
          {format(now, "HH:mm")}
        </span>
      </div>
      <div className="flex-1 h-px bg-primary-dark relative">
        <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-primary-dark" />
      </div>
    </div>
  );
}

// Re-export GRID_HOURS for the indicator check
const GRID_HOURS_EXPORT = GRID_HOURS;
export { GRID_HOURS_EXPORT };
