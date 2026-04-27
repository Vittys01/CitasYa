import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDashboardStats, getManicuristProductivity } from "@/services/dashboard.service";
import { getAppointmentsByDate } from "@/services/appointment.service";
import { getAppSettings } from "@/services/settings.service";
import { serializeAppointmentPrice } from "@/lib/serialize";
import { canaryDayBounds, formatDate, now } from "@/lib/utils";
import { format } from "date-fns";
import StatsCards from "@/components/dashboard/StatsCards";
import ProductivityChart from "@/components/dashboard/ProductivityChart";
import TodayAppointments from "@/components/dashboard/TodayAppointments";

export default async function DashboardPage() {
  const session = await auth();
  const businessId = session?.user.businessId;
  if (!businessId) redirect("/login?noBusiness=1");
  const isManicurist = session?.user.role === "MANICURIST";
  const manicuristId = session?.user.manicuristId ?? undefined;

  const canaryNow = now();

  const todayStr = format(canaryNow, "yyyy-MM-dd");
  const monthStartStr = `${canaryNow.getFullYear()}-${String(canaryNow.getMonth() + 1).padStart(2, "0")}-01`;
  const { start: monthStart } = canaryDayBounds(monthStartStr);

  const [settings, stats, productivity, todayAppts] = await Promise.all([
    getAppSettings(businessId),
    getDashboardStats(monthStart, new Date(), { businessId, manicuristId: isManicurist ? manicuristId : undefined }),
    isManicurist
      ? Promise.resolve([])
      : getManicuristProductivity(monthStart, new Date()),
    getAppointmentsByDate(new Date(), { businessId, manicuristId: isManicurist ? manicuristId : undefined }),
  ]);

  const todayApptsForClient = todayAppts.map(serializeAppointmentPrice);

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{settings["nav.dashboard"] ?? "Dashboard"}</h1>
        <p className="text-gray-500 text-sm mt-1">
          {settings["dashboard.welcome"] ?? "Bienvenida"}, {session?.user.name} · {formatDate(canaryNow)}
        </p>
      </div>

      <StatsCards stats={stats} settings={settings} todayStr={todayStr} />

      <div className={`grid min-w-0 grid-cols-1 gap-6 ${!isManicurist ? "lg:grid-cols-3" : ""}`}>
        {!isManicurist && (
          <div className="min-w-0 lg:col-span-2">
            <ProductivityChart data={productivity} settings={settings} />
          </div>
        )}
        <div className="min-w-0">
          <TodayAppointments appointments={todayApptsForClient} settings={settings} />
        </div>
      </div>
    </div>
  );
}
