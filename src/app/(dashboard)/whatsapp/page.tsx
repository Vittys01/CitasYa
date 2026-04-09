import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import WhatsAppChatClientWrapper from "./WhatsAppChatClientWrapper";

export default async function WhatsAppPage() {
  const session = await auth();
  const businessId = session?.user.businessId;
  if (!businessId) redirect("/login?noBusiness=1");

  return <WhatsAppChatClientWrapper businessId={businessId} />;
}
