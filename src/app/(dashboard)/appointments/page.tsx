import { auth } from "@/lib/auth";
import { getAppointmentsByWeek } from "@/services/appointment.service";
import { prisma } from "@/lib/db";
import { getAppSettings } from "@/services/settings.service";
import { serializeServices, serializeAppointmentPrice } from "@/lib/serialize";
import AppointmentsView from "./AppointmentsView";
import { startOfWeek } from "date-fns";

export default async function AppointmentsPage() {
  const session = await auth();
  const isManicurist = session?.user.role === "MANICURIST";
  const manicuristId = session?.user.manicuristId ?? undefined;

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const initialWeekStartKey = weekStart.toISOString().slice(0, 10); // YYYY-MM-DD

  const [settings, appointments, allManicurists, services, clients] = await Promise.all([
    getAppSettings(),
    getAppointmentsByWeek(weekStart, isManicurist ? manicuristId : undefined),
    prisma.manicurist.findMany({
      where: { isActive: true },
      include: { user: { select: { id: true, name: true } }, schedules: true },
    }),
    prisma.service.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.client.findMany({ orderBy: { name: "asc" }, take: 200 }),
  ]);

  const servicesForClient    = serializeServices(services);
  const appointmentsForClient = appointments.map(serializeAppointmentPrice);

  const calendarManicurists = isManicurist
    ? allManicurists.filter((m) => m.id === manicuristId)
    : allManicurists;

  return (
    <AppointmentsView
      initialAppointments={appointmentsForClient}
      initialWeekStartKey={initialWeekStartKey}
      manicurists={calendarManicurists}
      services={servicesForClient}
      clients={clients}
      settings={settings}
      lockedManicuristId={isManicurist ? manicuristId : undefined}
    />
  );
}
