import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import CurrencySettings from "@/components/settings/CurrencySettings";
import { getAppSettings } from "@/services/settings.service";

export default async function SettingsPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const settings = await getAppSettings();

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-[#4a3b32]">{settings["page.settingsTitle"] ?? "Configuración"}</h1>
        <p className="text-[#9c8273] text-sm mt-0.5">{settings["page.settingsSub"] ?? "Moneda y enlaces"}</p>
      </div>

      <CurrencySettings settings={settings} />

      <div className="rounded-xl border border-[#e6d5c3] bg-[#fbf6f1] p-5">
        <p className="text-sm text-[#7f6a5d]">
          Administrá los servicios que ofrecés (precios, duración, nombre) en la página dedicada.
        </p>
        <Link
          href="/servicios"
          className="inline-flex items-center gap-2 mt-3 px-4 py-2.5 rounded-lg bg-[#7f5539] text-white text-sm font-semibold hover:bg-[#6d4a32] transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">spa</span>
          Ir a servicios
        </Link>
      </div>

      {process.env.WHATSAPP_PROVIDER === "evolution" && (
        <div className="rounded-xl border border-[#e6d5c3] bg-[#fbf6f1] p-5">
          <p className="text-sm text-[#7f6a5d]">
            Para configurar recordatorios y mensajes por WhatsApp, vinculá tu número y personalizá las plantillas en la página dedicada.
          </p>
          <Link
            href="/whatsapp"
            className="inline-flex items-center gap-2 mt-3 px-4 py-2.5 rounded-lg bg-[#7f5539] text-white text-sm font-semibold hover:bg-[#6d4a32] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">smartphone</span>
            Configurar WhatsApp
          </Link>
        </div>
      )}

      <div className="rounded-xl border border-[#e6d5c3] bg-[#fbf6f1] p-5">
        <p className="text-sm text-[#7f6a5d]">
          Para agregar o editar miembros del equipo, horarios y eliminar usuarios, usá la página dedicada.
        </p>
        <Link
          href="/equipo"
          className="inline-flex items-center gap-2 mt-3 px-4 py-2.5 rounded-lg bg-[#7f5539] text-white text-sm font-semibold hover:bg-[#6d4a32] transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">badge</span>
          Ir al equipo
        </Link>
      </div>
    </div>
  );
}
