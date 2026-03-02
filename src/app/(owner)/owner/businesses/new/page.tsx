import Link from "next/link";
import BusinessForm from "@/components/owner/BusinessForm";

export default function NewBusinessPage() {
  return (
    <div className="max-w-lg">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[#9c8273] mb-6">
        <Link href="/owner" className="hover:text-[#4a3b32] transition-colors">
          Empresas
        </Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-[#4a3b32] font-medium">Nueva empresa</span>
      </nav>

      <div className="bg-white rounded-2xl border border-[#e6d5c3] shadow-sm p-6">
        <h1 className="text-xl font-bold text-[#4a3b32] mb-1">Nueva empresa</h1>
        <p className="text-sm text-[#9c8273] mb-6">
          Completa los datos para registrar una nueva empresa.
        </p>
        <BusinessForm />
      </div>
    </div>
  );
}
