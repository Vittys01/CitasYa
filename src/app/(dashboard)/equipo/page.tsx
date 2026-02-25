import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import UsersSettings from "@/components/settings/UsersSettings";
import { getAppSettings } from "@/services/settings.service";

export default async function EquipoPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "OWNER") redirect("/dashboard");
  const businessId = session.user.businessId!;

  const [settings, users] = await Promise.all([
    getAppSettings(businessId),
    prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { businessId },
          { manicurist: { businessId } },
        ],
      },
      orderBy: { name: "asc" },
      include: { manicurist: { include: { schedules: true } } },
    }),
  ]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex items-center gap-2 text-sm text-[#9c8273]">
        <span className="font-medium text-[#4a3b32]">Equipo</span>
      </div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#4a3b32] tracking-tight">
          Gestión del equipo
        </h1>
        <p className="text-[#9c8273] mt-1">
          Administrá a tus manicuristas, editá nombres, horarios y eliminá miembros del equipo.
        </p>
      </div>
      <UsersSettings users={users} settings={settings} />
    </div>
  );
}
