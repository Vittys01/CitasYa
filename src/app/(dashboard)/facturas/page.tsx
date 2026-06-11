import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { resolveBusinessIdFromSession } from "@/lib/resolve-business-session";
import { getInvoices } from "@/services/invoice.service";
import { serializeInvoice } from "@/lib/serialize";
import { getAppSettings } from "@/services/settings.service";
import InvoicesTable from "@/components/invoices/InvoicesTable";
import InvoicesFilters from "@/components/invoices/InvoicesFilters";

const INVOICE_ROLES = ["OWNER", "ADMIN"];

export default async function FacturasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session || !INVOICE_ROLES.includes(session.user.role)) redirect("/dashboard");

  const businessId = await resolveBusinessIdFromSession(session);
  if (!businessId) redirect("/dashboard");

  const params = await searchParams;
  const [settings, result] = await Promise.all([
    getAppSettings(businessId),
    getInvoices(businessId, {
      dateFrom: typeof params.dateFrom === "string" ? params.dateFrom : undefined,
      dateTo: typeof params.dateTo === "string" ? params.dateTo : undefined,
      clientId: typeof params.clientId === "string" ? params.clientId : undefined,
      status: typeof params.status === "string" ? (params.status as "DRAFT" | "ISSUED" | "CANCELLED") : undefined,
      q: typeof params.q === "string" ? params.q : undefined,
      page: typeof params.page === "string" ? parseInt(params.page) : 1,
      limit: 20,
    }),
  ]);

  const invoices = result.invoices.map(serializeInvoice);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#4a3b32]">
          {settings["page.invoicesTitle"] ?? "Facturas"}
        </h1>
        <p className="text-[#9c8273] text-sm mt-0.5">
          {settings["page.invoicesSub"] ?? "Gestion y descarga de facturas para la Agencia Tributaria"}
        </p>
      </div>

      <InvoicesFilters />
      <InvoicesTable invoices={invoices} meta={result.meta} />
    </div>
  );
}
