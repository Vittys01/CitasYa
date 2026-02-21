import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import { getAppSettings } from "@/services/settings.service";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const settings = await getAppSettings();

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
