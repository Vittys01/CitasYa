import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { resolveBusinessIdFromSession } from "@/lib/resolve-business-session";
import { getInvoices } from "@/services/invoice.service";
import { serializeInvoice } from "@/lib/serialize";
import { getAppSettings } from "@/services/settings.service";
import { prisma } from "@/lib/db";
import InvoicesTable from "@/components/invoices/InvoicesTable";
import InvoicesFilters from "@/components/invoices/InvoicesFilters";

const INVOICE_ROLES = ["OWNER", "ADMIN", "MANICURIST"];

export default async function FacturasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session || !INVOICE_ROLES.includes(session.user.role)) redirect("/dashboard");

  const businessId = await resolveBusinessIdFromSession(session);
  if (!businessId) redirect("/dashboard");

  const isManicurist = session.user.role === "MANICURIST";
  const forcedManicuristId = isManicurist ? session.user.manicuristId ?? null : null;

  const params = await searchParams;
  const requestedManicuristId =
    typeof params.manicuristId === "string" ? params.manicuristId : undefined;
  // MANICURIST users always see only their own — ignore any incoming filter
  const manicuristFilter = isManicurist ? forcedManicuristId ?? undefined : requestedManicuristId;

  const [settings, result, manicurists] = await Promise.all([
    getAppSettings(businessId),
    getInvoices(businessId, {
      dateFrom: typeof params.dateFrom === "string" ? params.dateFrom : undefined,
      dateTo: typeof params.dateTo === "string" ? params.dateTo : undefined,
      clientId: typeof params.clientId === "string" ? params.clientId : undefined,
      status: typeof params.status === "string" ? (params.status as "DRAFT" | "ISSUED" | "CANCELLED") : undefined,
      q: typeof params.q === "string" ? params.q : undefined,
      paymentMethod: typeof params.paymentMethod === "string" ? (params.paymentMethod as "EFECTIVO" | "BIZUM" | "DATAFONO") : undefined,
      manicuristId: manicuristFilter,
      page: typeof params.page === "string" ? parseInt(params.page) : 1,
      limit: 20,
    }),
    isManicurist
      ? Promise.resolve([])
      : prisma.manicurist.findMany({
          where: { businessId, isActive: true },
          select: { id: true, user: { select: { name: true } } },
          orderBy: { user: { name: "asc" } },
        }),
  ]);

  const invoices = result.invoices.map(serializeInvoice);
  const manicuristOptions = manicurists.map((m) => ({ id: m.id, name: m.user.name }));

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

      <InvoicesFilters manicurists={manicuristOptions} canFilterByTeam={!isManicurist} />
      <InvoicesTable
        invoices={invoices}
        meta={result.meta}
        showTeamColumn={!isManicurist}
        canEdit={!isManicurist}
      />
    </div>
  );
}
