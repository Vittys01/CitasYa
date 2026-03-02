import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import AddMemberForm from "@/components/owner/AddMemberForm";

export const dynamic = "force-dynamic";

export default async function NewMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const ownerId = session!.user.id;

  const business = await prisma.business.findFirst({
    where: { id, ownerId },
    select: { id: true, name: true },
  });

  if (!business) notFound();

  return (
    <div className="max-w-xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[#9c8273] mb-6 flex-wrap">
        <Link href="/owner" className="hover:text-[#4a3b32] transition-colors">
          Empresas
        </Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <Link
          href={`/owner/businesses/${id}`}
          className="hover:text-[#4a3b32] transition-colors truncate max-w-[120px]"
        >
          {business.name}
        </Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-[#4a3b32] font-medium">Nuevo miembro</span>
      </nav>

      <div className="bg-white rounded-2xl border border-[#e6d5c3] shadow-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary-dark text-[20px]">person_add</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#4a3b32]">Agregar miembro</h1>
            <p className="text-sm text-[#9c8273]">
              Empresa: <strong className="text-[#4a3b32]">{business.name}</strong>
            </p>
          </div>
        </div>

        <AddMemberForm businessId={business.id} businessName={business.name} />
      </div>
    </div>
  );
}
