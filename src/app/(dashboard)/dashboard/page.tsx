import { auth } from "@/lib/auth";
import { getDashboardStats, getManicuristProductivity } from "@/services/dashboard.service";
import { getAppointmentsByDate } from "@/services/appointment.service";
import { getAppSettings } from "@/services/settings.service";
import { serializeAppointmentPrice } from "@/lib/serialize";
import StatsCards from "@/components/dashboard/StatsCards";
import ProductivityChart from "@/components/dashboard/ProductivityChart";
import TodayAppointments from "@/components/dashboard/TodayAppointments";

export default async function DashboardPage() {
  const session = await auth();
  const businessId = session?.user.businessId!;
  const isManicurist = session?.user.role === "MANICURIST";
  const manicuristId = session?.user.manicuristId ?? undefined;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [settings, stats, productivity, todayAppts] = await Promise.all([
    getAppSettings(businessId),
    getDashboardStats(monthStart, now, { businessId, manicuristId: isManicurist ? manicuristId : undefined }),
    isManicurist
      ? Promise.resolve([])
      : getManicuristProductivity(monthStart, now),
    getAppointmentsByDate(now, { businessId, manicuristId: isManicurist ? manicuristId : undefined }),
  ]);

  const todayApptsForClient = todayAppts.map(serializeAppointmentPrice);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{settings["nav.dashboard"] ?? "Dashboard"}</h1>
        <p className="text-gray-500 text-sm mt-1">
          {settings["dashboard.welcome"] ?? "Bienvenida"}, {session?.user.name} · {now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      <StatsCards stats={stats} settings={settings} />

      <div className={`grid grid-cols-1 gap-6 ${!isManicurist ? "lg:grid-cols-3" : ""}`}>
        {!isManicurist && (
          <div className="lg:col-span-2">
            <ProductivityChart data={productivity} settings={settings} />
          </div>
        )}
        <div className={isManicurist ? "max-w-lg" : ""}>
          <TodayAppointments appointments={todayApptsForClient} settings={settings} />
        </div>
      </div>
    </div>
  );
}
