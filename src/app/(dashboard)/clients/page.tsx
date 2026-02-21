import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { searchClients } from "@/services/client.service";
import { getAppSettings } from "@/services/settings.service";
import ClientsTable from "@/components/clients/ClientsTable";
import NewClientButton from "@/components/clients/NewClientButton";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const session = await auth();
  if (session?.user.role === "MANICURIST") redirect("/appointments");

  const params = await searchParams;
  const [settings, { clients, meta }] = await Promise.all([
    getAppSettings(),
    searchClients(params.q ?? "", parseInt(params.page ?? "1"), 20),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{settings["page.clientsTitle"] ?? "Clientes"}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{meta.total} {settings["page.clientsSub"] ?? "clientes registrados"}</p>
        </div>
        <NewClientButton settings={settings} />
      </div>

      <ClientsTable clients={clients} meta={meta} query={params.q ?? ""} settings={settings} />
    </div>
  );
}
