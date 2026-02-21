"use client";

import { useState } from "react";
import AppointmentsCalendar, { type EmptySlotPayload } from "@/components/appointments/AppointmentsCalendar";
import NewAppointmentButton from "@/components/appointments/NewAppointmentButton";
import type { Manicurist, Client, Schedule } from "@prisma/client";
import type { ServiceForClient, AppointmentForClient } from "@/lib/serialize";

type ManicuristWithDetails = Manicurist & {
  user: { id: string; name: string };
  schedules: Schedule[];
};

interface AppointmentsViewProps {
  initialAppointments: AppointmentForClient[];
  /** YYYY-MM-DD of the Monday of the week that initialAppointments belongs to */
  initialWeekStartKey: string;
  manicurists: ManicuristWithDetails[];
  services: ServiceForClient[];
  clients: Client[];
  settings: Record<string, string>;
  lockedManicuristId?: string;
}

const g = (s: Record<string, string>, k: string, fb: string) => s[k] ?? fb;

export default function AppointmentsView({
  initialAppointments,
  initialWeekStartKey,
  manicurists,
  services,
  clients,
  settings,
  lockedManicuristId,
}: AppointmentsViewProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [prefill, setPrefill] = useState<EmptySlotPayload | null>(null);

  const handleOpenNew = () => {
    setPrefill(null);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setPrefill(null);
  };

  const handleEmptySlotClick = (slot: EmptySlotPayload) => {
    setPrefill(slot);
    setDrawerOpen(true);
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#4a3b32] tracking-tight">
            {settings["page.appointmentsTitle"] ?? "Turnos"}
          </h1>
          <p className="text-[#9c8273] text-sm mt-1">
            {settings["page.appointmentsSub"] ?? "Vista semanal. Filtrá por profesional y estado. Hacé clic en un hueco para agendar."}
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenNew}
          className="flex items-center gap-2 bg-primary-dark hover:bg-primary-hover text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-warm-sm transition-all active:scale-[0.98] w-fit"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          {g(settings, "action.newAppointment", "Nuevo turno")}
        </button>
      </div>

      <AppointmentsCalendar
        initialAppointments={initialAppointments}
        initialWeekStartKey={initialWeekStartKey}
        manicurists={manicurists}
        services={services}
        clients={clients}
        settings={settings}
        lockedManicuristId={lockedManicuristId}
        onEmptySlotClick={handleEmptySlotClick}
      />

      <NewAppointmentButton
        manicurists={manicurists}
        services={services}
        clients={clients}
        settings={settings}
        lockedManicuristId={lockedManicuristId}
        open={drawerOpen}
        onClose={handleCloseDrawer}
        initialPrefill={prefill}
        renderTrigger={false}
      />
    </div>
  );
}
