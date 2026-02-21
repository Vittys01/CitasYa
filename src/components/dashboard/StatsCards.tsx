import { formatPrice } from "@/lib/format-price";
import type { DashboardStats } from "@/types";

interface StatsCardsProps {
  stats: DashboardStats;
  settings?: Record<string, string>;
}

const get = (s: Record<string, string> | undefined, k: string, fallback: string) => (s && s[k]) ?? fallback;

function buildCards(stats: DashboardStats, settings: Record<string, string> | undefined) {
  return [
    {
      label:    get(settings, "stats.todayLabel", "Turnos hoy"),
      value:    stats.todayAppointments.toString(),
      sub:      `${stats.confirmedToday} ${get(settings, "stats.confirmedSub", "confirmados")} · ${stats.pendingToday} ${get(settings, "stats.pendingSub", "pendientes")}`,
      icon:     "calendar_today",
      iconBg:   "bg-[#F3F0FF]",
      iconColor:"text-[#7C5CBF]",
      badge:    null,
    },
    {
      label:    get(settings, "stats.completedLabel", "Completados hoy"),
      value:    stats.completedToday.toString(),
      sub:      get(settings, "stats.finishedSub", "servicios finalizados"),
      icon:     "task_alt",
      iconBg:   "bg-[#F0FDF4]",
      iconColor:"text-emerald-600",
      badge:    null,
    },
    {
      label:    get(settings, "stats.revenueDayLabel", "Ingresos del día"),
      value:    formatPrice(stats.revenueToday, settings),
      sub:      get(settings, "stats.fromCompletedSub", "de turnos completados"),
      icon:     "payments",
      iconBg:   "bg-primary/10",
      iconColor:"text-primary-dark",
      badge:    { label: "+15%", color: "text-emerald-700 bg-emerald-50 border-emerald-100" },
    },
    {
      label:    get(settings, "stats.revenueMonthLabel", "Ingresos del mes"),
      value:    formatPrice(stats.revenueRange, settings),
      sub:      `${stats.appointmentsRange} ${get(settings, "stats.appointmentsInPeriod", "turnos en el período")}`,
      icon:     "trending_up",
      iconBg:   "bg-[#FFF8E1]",
      iconColor:"text-amber-600",
      badge:    null,
    },
  ];
}

export default function StatsCards({ stats, settings }: StatsCardsProps) {
  const cards = buildCards(stats, settings);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-[#FFFDF5] rounded-xl border border-[#e6d5c3] p-5 shadow-warm-sm flex flex-col justify-between hover:border-primary/30 transition-colors cursor-default"
        >
          <div className="flex justify-between items-start mb-4">
            <div className={`w-11 h-11 rounded-lg ${card.iconBg} flex items-center justify-center`}>
              <span className={`material-symbols-outlined ${card.iconColor}`}>{card.icon}</span>
            </div>
            {card.badge && (
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border ${card.badge.color}`}>
                <span className="material-symbols-outlined text-[13px]">trending_up</span>
                {card.badge.label}
              </span>
            )}
          </div>
          <div>
            <p className="text-earth-muted text-sm font-medium mb-1">{card.label}</p>
            <h3 className="text-2xl font-bold text-earth">{card.value}</h3>
            <p className="text-xs text-[#bda696] mt-1">{card.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
