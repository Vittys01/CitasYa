import { formatTime } from "@/lib/utils";
import { formatPrice } from "@/lib/format-price";
import type { AppointmentForClient } from "@/lib/serialize";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, { icon: string; cls: string }> = {
  PENDING:   { icon: "pending",      cls: "bg-[#FFF8E1] text-amber-700 border-amber-200" },
  CONFIRMED: { icon: "check_circle", cls: "bg-[#E8F5E9] text-emerald-700 border-emerald-200" },
  COMPLETED: { icon: "task_alt",     cls: "bg-[#EFEBE9] text-earth-light border-[#D7CCC8]" },
  CANCELLED: { icon: "cancel",       cls: "bg-stone-50 text-stone-400 border-stone-200" },
};

const get = (s: Record<string, string> | undefined, k: string, fallback: string) => (s && s[k]) ?? fallback;

interface TodayAppointmentsProps {
  appointments: AppointmentForClient[];
  settings?: Record<string, string>;
}

export default function TodayAppointments({ appointments, settings }: TodayAppointmentsProps) {
  const active = appointments.filter((a) => a.status !== "CANCELLED");
  const title = get(settings, "dashboard.todayTitle", "Turnos de hoy");
  const sub = get(settings, "dashboard.todaySub", "activos");
  const statusLabel = (status: string) => get(settings, `status.${status}`, status);

  return (
    <div className="bg-[#FFFDF5] rounded-xl border border-[#e6d5c3] p-5 shadow-warm-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-earth">{title}</h2>
          <p className="text-xs text-earth-muted mt-0.5">{active.length} {sub}</p>
        </div>
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary-dark text-[18px]">today</span>
        </div>
      </div>

      {active.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-[#bda696] py-8">
          <span className="material-symbols-outlined text-4xl mb-2">event_available</span>
          <p className="text-sm">{settings ? (settings["dashboard.noAppts"] ?? "Sin turnos para hoy") : "Sin turnos para hoy"}</p>
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto flex-1 no-scrollbar">
          {active.map((appt) => {
            const s = statusStyles[appt.status];
            const label = statusLabel(appt.status);
            return (
              <div
                key={appt.id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-cream-dark transition group cursor-pointer"
              >
                {/* Time */}
                <div className="flex-shrink-0 text-center w-12">
                  <p className="text-xs font-bold text-earth">{formatTime(new Date(appt.startAt))}</p>
                  <p className="text-[10px] text-[#bda696]">{formatTime(new Date(appt.endAt))}</p>
                </div>

                {/* Divider */}
                <div className="w-px self-stretch bg-[#e6d5c3] mx-1" />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-earth truncate">{appt.client.name}</p>
                  <p className="text-xs text-earth-muted truncate">{appt.service.name}</p>
                  <p className="text-xs text-[#bda696]">{appt.manicurist.user.name}</p>
                </div>

                {/* Status + price */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={cn("inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold", s?.cls ?? "")}>
                    <span className="material-symbols-outlined text-[11px]">{s?.icon ?? "help"}</span>
                    {label}
                  </span>
                  <span className="text-xs text-earth-muted">{formatPrice(Number(appt.price), settings)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
