import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAppSettings } from "@/services/settings.service";
import WhatsAppPageContent from "./WhatsAppPageContent";

export default async function WhatsAppPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const settings = await getAppSettings();
  const evolutionManagerUrl =
    process.env.EVOLUTION_API_URL &&
    process.env.WHATSAPP_PROVIDER === "evolution"
      ? `${process.env.EVOLUTION_API_URL.replace(/\/$/, "")}/manager`
      : undefined;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex items-center gap-2 text-sm text-[#9c8273]">
        <a href="/settings" className="hover:text-[#7f5539] transition-colors">
          Configuración
        </a>
        <span>/</span>
        <span className="font-medium text-[#4a3b32]">WhatsApp</span>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#4a3b32] tracking-tight">
          Automatización por WhatsApp
        </h1>
        <p className="text-[#9c8273] mt-1">
          Configurá recordatorios y notificaciones automáticas por WhatsApp para reducir inasistencias.
        </p>
      </div>

      <WhatsAppPageContent
        settings={settings}
        evolutionManagerUrl={evolutionManagerUrl}
      />
    </div>
  );
}
