import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import WhatsAppQrPageContent from "./WhatsAppQrPageContent";

export default async function WhatsAppQrPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const evolutionManagerUrl = process.env.EVOLUTION_API_URL
    ? `${process.env.EVOLUTION_API_URL.replace(/\/$/, "")}/manager`
    : undefined;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="p-2 rounded-lg hover:bg-[#efe6dd] text-[#7f6a5d] hover:text-[#4a3b32] transition-colors"
          title="Volver a Configuración"
        >
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[#4a3b32]">Código QR de WhatsApp</h1>
          <p className="text-sm text-[#9c8273]">Escaneá con tu celular para vincular el número</p>
        </div>
      </div>

      <WhatsAppQrPageContent evolutionManagerUrl={evolutionManagerUrl} />

      <p className="text-center">
        <Link href="/settings" className="text-sm font-medium text-[#7f5539] hover:underline">
          ← Volver a Configuración
        </Link>
      </p>
    </div>
  );
}
