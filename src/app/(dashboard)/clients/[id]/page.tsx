import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getClientById } from "@/services/client.service";
import { getAppSettings } from "@/services/settings.service";
import { serializeAppointmentPrice } from "@/lib/serialize";
import ClientDetailView from "./ClientDetailView";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function ClientDetailPage({ params }: Params) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const [settings, client] = await Promise.all([
    getAppSettings(session.user.businessId!),
    getClientById(id),
  ]);

  if (!client) redirect("/clients");

  const appointmentsForClient = client.appointments.map(serializeAppointmentPrice);

  return (
    <ClientDetailView
      client={client}
      appointments={appointmentsForClient}
      settings={settings}
    />
  );
}
