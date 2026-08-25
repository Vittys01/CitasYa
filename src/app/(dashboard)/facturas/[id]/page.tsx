import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { resolveBusinessIdFromSession } from "@/lib/resolve-business-session";
import { getInvoice } from "@/services/invoice.service";
import { serializeInvoice } from "@/lib/serialize";
import InvoiceDetailView from "@/components/invoices/InvoiceDetailView";
import Link from "next/link";

const INVOICE_ROLES = ["OWNER", "ADMIN", "MANICURIST"];

export default async function FacturaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session || !INVOICE_ROLES.includes(session.user.role)) redirect("/dashboard");

  const businessId = await resolveBusinessIdFromSession(session);
  if (!businessId) redirect("/dashboard");

  const isManicurist = session.user.role === "MANICURIST";
  const invoice = await getInvoice(
    id,
    businessId,
    isManicurist ? session.user.manicuristId ?? undefined : undefined
  );
  if (!invoice) notFound();

  const serialized = serializeInvoice(invoice);

  return (
    <div className="space-y-6">
      <Link
        href="/facturas"
        className="inline-flex items-center gap-1.5 text-sm text-[#7f5539] hover:underline"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Volver a facturas
      </Link>

      <InvoiceDetailView invoice={serialized} />
    </div>
  );
}
