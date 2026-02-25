import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { serializeServices } from "@/lib/serialize";
import ServicesSettings from "@/components/settings/ServicesSettings";
import { getAppSettings } from "@/services/settings.service";

export default async function ServiciosPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "OWNER") redirect("/dashboard");
  const businessId = session.user.businessId!;

  const [settings, services] = await Promise.all([
    getAppSettings(businessId),
    prisma.service.findMany({ where: { businessId }, orderBy: { name: "asc" } }),
  ]);

  const servicesForClient = serializeServices(services);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex items-center gap-2 text-sm text-[#9c8273]">
        <span className="font-medium text-[#4a3b32]">Servicios</span>
      </div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#4a3b32] tracking-tight">
          Servicios
        </h1>
        <p className="text-[#9c8273] mt-1">
          Administrá los servicios que ofrecés: precios, duración y nombre.
        </p>
      </div>
      <ServicesSettings services={servicesForClient} settings={settings} />
    </div>
  );
}
