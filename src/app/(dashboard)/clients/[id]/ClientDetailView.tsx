"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatTime, toCanaryTimezone, cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format-price";
import type { ClientWithHistory } from "@/types";
import type { AppointmentForClient } from "@/lib/serialize";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const statusStyles: Record<string, { icon: string; cls: string }> = {
  PENDING:   { icon: "pending",      cls: "bg-[#FFF8E1] text-amber-700 border-amber-200" },
  CONFIRMED: { icon: "check_circle", cls: "bg-[#E8F5E9] text-green-700 border-green-200" },
  COMPLETED: { icon: "task_alt",     cls: "bg-[#EFEBE9] text-earth-light border-[#D7CCC8]" },
  CANCELLED: { icon: "cancel",       cls: "bg-stone-100 text-stone-500 border-stone-300" },
};

const statusLabels: Record<string, string> = {
  PENDING:   "Pendiente",
  CONFIRMED: "Confirmado",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

const get = (s: Record<string, string> | undefined, k: string, fallback: string) => (s && s[k]) ?? fallback;

interface ClientDetailViewProps {
  client: ClientWithHistory;
  appointments: AppointmentForClient[];
  settings?: Record<string, string>;
}

export default function ClientDetailView({ client, appointments, settings }: ClientDetailViewProps) {
  const router = useRouter();

  const upcoming = appointments.filter((a) => a.status === "PENDING" || a.status === "CONFIRMED");
  const past = appointments.filter((a) => a.status === "COMPLETED" || a.status === "CANCELLED");

  return (
    <div className="space-y-6">
      {/* Back button + Header */}
      <div>
        <button
          onClick={() => router.push("/clients")}
          className="inline-flex items-center gap-1.5 text-sm text-earth-muted hover:text-earth transition mb-3"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Volver a clientes
        </button>

        <div className="bg-[#FFFDF5] rounded-xl border border-[#e6d5c3] p-5 shadow-warm-sm">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center text-primary-dark font-bold text-xl flex-shrink-0">
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-earth">{client.name}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-earth-light">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#bda696]">phone</span>
                  {client.phone}
                </span>
                {client.email && (
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-[#bda696]">mail</span>
                    {client.email}
                  </span>
                )}
              </div>
              {client.notes && (
                <p className="text-xs text-[#bda696] mt-2">{client.notes}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-primary/10 text-primary-dark px-2.5 py-1 rounded-full border border-primary/20">
                <span className="material-symbols-outlined text-[13px]">calendar_month</span>
                {appointments.length} turnos
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Appointments */}
      {upcoming.length > 0 && (
        <div>
          <h2 className="text-base font-bold text-earth mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary-dark">event</span>
            Proximas citas ({upcoming.length})
          </h2>
          <div className="space-y-2">
            {upcoming.map((appt) => (
              <AppointmentRow key={appt.id} appt={appt} settings={settings} />
            ))}
          </div>
        </div>
      )}

      {/* Past Appointments */}
      {past.length > 0 && (
        <div>
          <h2 className="text-base font-bold text-earth mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-earth-muted">history</span>
            Historial ({past.length})
          </h2>
          <div className="space-y-2">
            {past.map((appt) => (
              <AppointmentRow key={appt.id} appt={appt} settings={settings} />
            ))}
          </div>
        </div>
      )}

      {appointments.length === 0 && (
        <div className="bg-[#FFFDF5] rounded-xl border border-[#e6d5c3] p-10 shadow-warm-sm text-center">
          <span className="material-symbols-outlined text-4xl text-[#bda696] mb-2 block">event_available</span>
          <p className="text-sm text-[#bda696]">Esta clienta no tiene turnos registrados</p>
        </div>
      )}
    </div>
  );
}

function AppointmentRow({ appt, settings }: { appt: AppointmentForClient; settings?: Record<string, string> }) {
  const startCanary = toCanaryTimezone(new Date(appt.startAt));
  const endCanary = toCanaryTimezone(new Date(appt.endAt));
  const dayStr = format(startCanary, "EEEE d 'de' MMMM", { locale: es });
  const timeStr = `${formatTime(startCanary)} - ${formatTime(endCanary)}`;

  const s = statusStyles[appt.status];
  const label = statusLabels[appt.status] ?? appt.status;

  return (
    <div className="bg-[#FFFDF5] rounded-xl border border-[#e6d5c3] p-4 shadow-warm-sm hover:bg-cream-dark transition">
      <div className="flex items-start gap-4">
        {/* Date block */}
        <div className="flex-shrink-0 w-16 text-center">
          <p className="text-lg font-bold text-earth capitalize">{format(startCanary, "d", { locale: es })}</p>
          <p className="text-[10px] font-semibold text-primary-dark uppercase">{format(startCanary, "MMM", { locale: es })}</p>
        </div>

        {/* Divider */}
        <div className="w-px self-stretch bg-[#e6d5c3]" />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-earth capitalize">{dayStr}</span>
            <span className={cn(
              "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold",
              s?.cls ?? ""
            )}>
              <span className="material-symbols-outlined text-[11px]">{s?.icon ?? "help"}</span>
              {label}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-earth-light">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-[#bda696]">schedule</span>
              {timeStr}
            </span>
            <span className="text-[#bda696]">|</span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]" style={{ color: appt.manicurist.color }}>
                palette
              </span>
              {appt.manicurist.user.name}
            </span>
          </div>

          <p className="text-sm text-earth-muted mt-1">{appt.service.name} ({appt.service.duration} min)</p>
        </div>

        {/* Price */}
        <div className="flex-shrink-0 text-right">
          <span className="text-sm font-semibold text-earth">{formatPrice(Number(appt.price), settings)}</span>
        </div>
      </div>
    </div>
  );
}
