import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import { getAppSettings } from "@/services/settings.service";
import { prisma } from "@/lib/db";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  // Try session businessId first; for OWNER whose JWT was issued before the
  // business was created, look it up fresh from the DB.
  let businessId = session.user.businessId ?? null;
  if (!businessId && session.user.role === "OWNER") {
    const biz = await prisma.business.findFirst({
      where: { ownerId: session.user.id },
      select: { id: true },
    });
    businessId = biz?.id ?? null;
  }

  // Redirect outside the dashboard layout to avoid infinite loops
  if (!businessId) redirect("/login?noBusiness=1");

  const settings = await getAppSettings(businessId);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar role={session.user.role} settings={settings} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar user={session.user} settings={settings} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
