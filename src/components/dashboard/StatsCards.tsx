"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/format-price";
import type { DashboardStats } from "@/types";
import { cn } from "@/lib/utils";

interface StatsCardsProps {
  stats: DashboardStats;
  settings?: Record<string, string>;
  todayStr?: string;
}

const get = (s: Record<string, string> | undefined, k: string, fallback: string) => (s && s[k]) ?? fallback;

interface CardDef {
  key: string;
  label: string;
  value: string;
  sub: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  detail?: (stats: DashboardStats, s: Record<string, string> | undefined) => React.ReactNode;
}

function buildCards(stats: DashboardStats, settings: Record<string, string> | undefined): CardDef[] {
  const completionRate =
    stats.todayAppointments > 0
      ? Math.round((stats.completedToday / stats.todayAppointments) * 100)
      : 0;

  return [
    {
      key: "today",
      label: get(settings, "stats.todayLabel", "Turnos hoy"),
      value: stats.todayAppointments.toString(),
      sub: `${stats.pendingToday} ${get(settings, "stats.pendingSub", "pendientes")} · ${stats.completedToday} ${get(settings, "stats.completedSub", "completados")}`,
      icon: "calendar_today",
      iconBg: "bg-[#F3F0FF]",
      iconColor: "text-[#7C5CBF]",
      detail: (st) => (
        <div className="space-y-3">
          <div className="flex justify-between text-xs">
            <span className="text-earth-muted">Total del dia</span>
            <span className="font-semibold text-earth">{st.todayAppointments} turnos</span>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-earth-muted">Completados</span>
              <span className="font-medium text-emerald-600">{st.completedToday}</span>
            </div>
            <div className="w-full h-2 bg-cream-dark rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <p className="text-[10px] text-earth-muted mt-1 text-right">{completionRate}% completado</p>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-earth-muted">Pendientes / Confirmados</span>
            <span className="font-medium text-amber-600">{st.pendingToday}</span>
          </div>
        </div>
      ),
    },
    {
      key: "completed",
      label: get(settings, "stats.completedLabel", "Completados hoy"),
      value: stats.completedToday.toString(),
      sub: get(settings, "stats.finishedSub", "servicios finalizados"),
      icon: "task_alt",
      iconBg: "bg-[#F0FDF4]",
      iconColor: "text-emerald-600",
      detail: (st, s) => {
        const avg = st.completedToday > 0 ? Math.round(st.revenueToday / st.completedToday) : 0;
        return (
          <div className="space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-earth-muted">Servicios completados</span>
              <span className="font-semibold text-earth">{st.completedToday}</span>
            </div>
            {st.completedToday > 0 && (
              <>
                <div className="flex justify-between text-xs">
                  <span className="text-earth-muted">Ingresos generados</span>
                  <span className="font-medium text-emerald-600">{formatPrice(st.revenueToday, s)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-earth-muted">Ticket promedio</span>
                  <span className="font-medium text-earth">{formatPrice(avg, s)}</span>
                </div>
              </>
            )}
            {st.completedToday === 0 && (
              <p className="text-xs text-earth-muted text-center py-1">Sin servicios completados aun</p>
            )}
          </div>
        );
      },
    },
    {
      key: "revenue-day",
      label: get(settings, "stats.revenueDayLabel", "Ingresos del dia"),
      value: formatPrice(stats.revenueToday, settings),
      sub: get(settings, "stats.fromCompletedSub", "de turnos completados"),
      icon: "payments",
      iconBg: "bg-primary/10",
      iconColor: "text-primary-dark",
      detail: (st, s) => {
        const avg = st.completedToday > 0 ? Math.round(st.revenueToday / st.completedToday) : 0;
        return (
          <div className="space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-earth-muted">Total facturado hoy</span>
              <span className="font-semibold text-earth">{formatPrice(st.revenueToday, s)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-earth-muted">Turnos que generaron ingreso</span>
              <span className="font-medium text-earth">{st.completedToday}</span>
            </div>
            {st.completedToday > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-earth-muted">Ticket promedio</span>
                <span className="font-medium text-earth">{formatPrice(avg, s)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-earth-muted">Turnos pendientes (sin cobrar)</span>
              <span className="font-medium text-amber-600">{st.pendingToday}</span>
            </div>
          </div>
        );
      },
    },
    {
      key: "revenue-month",
      label: get(settings, "stats.revenueMonthLabel", "Ingresos del mes"),
      value: formatPrice(stats.revenueRange, settings),
      sub: `${stats.appointmentsRange} ${get(settings, "stats.appointmentsInPeriod", "turnos en el periodo")}`,
      icon: "trending_up",
      iconBg: "bg-[#FFF8E1]",
      iconColor: "text-amber-600",
      detail: (st, s) => {
        const avgDay = stats.appointmentsRange > 0 ? Math.round(stats.revenueRange / 30) : 0;
        return (
          <div className="space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-earth-muted">Total del mes</span>
              <span className="font-semibold text-earth">{formatPrice(st.revenueRange, s)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-earth-muted">Turnos totales</span>
              <span className="font-medium text-earth">{st.appointmentsRange}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-earth-muted">Promedio diario</span>
              <span className="font-medium text-earth">{formatPrice(avgDay, s)}</span>
            </div>
          </div>
        );
      },
    },
  ];
}

export default function StatsCards({ stats, settings }: StatsCardsProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const cards = buildCards(stats, settings ?? undefined);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      {cards.map((card) => {
        const isOpen = expanded === card.key;
        return (
          <div
            key={card.key}
            className={cn(
              "bg-[#FFFDF5] rounded-xl border p-4 lg:p-5 shadow-warm-sm transition-all",
              isOpen ? "border-primary/40 shadow-warm-md" : "border-[#e6d5c3] hover:border-primary/20"
            )}
          >
            <button
              type="button"
              onClick={() => setExpanded((prev) => (prev === card.key ? null : card.key))}
              className="w-full flex flex-col gap-3 text-left cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", card.iconBg)}>
                  <span className={cn("material-symbols-outlined text-[20px]", card.iconColor)}>
                    {card.icon}
                  </span>
                </div>
                <span
                  className={cn(
                    "material-symbols-outlined text-[#bda696] text-lg transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                >
                  expand_more
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-earth-muted text-xs font-medium truncate">{card.label}</p>
                <h3 className="text-xl lg:text-2xl font-bold text-earth truncate">{card.value}</h3>
                <p className="text-[11px] text-[#bda696] mt-0.5 truncate">{card.sub}</p>
              </div>
            </button>

            {isOpen && card.detail && (
              <div className="mt-1 pt-3 border-t border-[#f0ede8] animate-in fade-in slide-in-from-top-1 duration-200">
                {card.detail(stats, settings)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
