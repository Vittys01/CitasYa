import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import BusinessForm from "@/components/owner/BusinessForm";
import { getAppSettings } from "@/services/settings.service";

export const dynamic = "force-dynamic";

export default async function EditBusinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const ownerId = session!.user.id;

  const [business, settings] = await Promise.all([
    prisma.business.findFirst({
      where: { id, ownerId },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        whatsappProvider: true,
        whatsappInstanceName: true,
        metaPhoneNumberId: true,
        metaAccessToken: true,
      },
    }),
    getAppSettings(id),
  ]);

  if (!business) notFound();

  return (
    <div className="max-w-lg">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[#9c8273] mb-6">
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
        <span className="text-[#4a3b32] font-medium">Editar</span>
      </nav>

      <div className="bg-white rounded-2xl border border-[#e6d5c3] shadow-sm p-6">
        <h1 className="text-xl font-bold text-[#4a3b32] mb-1">Editar empresa</h1>
        <p className="text-sm text-[#9c8273] mb-6">
          Modifica los datos de <strong className="text-[#4a3b32]">{business.name}</strong>.
        </p>
        <BusinessForm
          businessId={business.id}
          initialValues={{
            name: business.name,
            slug: business.slug,
            isActive: business.isActive,
            whatsappProvider: business.whatsappProvider,
            whatsappInstanceName: business.whatsappInstanceName,
            metaPhoneNumberId: business.metaPhoneNumberId,
            metaAccessToken: business.metaAccessToken,
            currency: settings["app.currency"] ?? "ARS",
          }}
        />
      </div>
    </div>
  );
}
