import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import OwnerHeader from "@/components/owner/OwnerHeader";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "OWNER") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#faf7f4]">
      <OwnerHeader user={session.user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
