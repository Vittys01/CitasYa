import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import WhatsAppChatClientWrapper from "./WhatsAppChatClientWrapper";

export default async function WhatsAppPage() {
  const session = await auth();
  const businessId = session?.user.businessId;
  if (!businessId) redirect("/login?noBusiness=1");

  const twilioConfig = {
    contentSidConfirmation: process.env.TWILIO_CONTENT_SID_CONFIRMATION || "",
    contentSidReminder: process.env.TWILIO_CONTENT_SID_REMINDER || "",
    contentSidCancellation: process.env.TWILIO_CONTENT_SID_CANCELLATION || "",
    twilioWhatsAppNumber: process.env.TWILIO_WHATSAPP_NUMBER || "",
  };

  return <WhatsAppChatClientWrapper businessId={businessId} twilioConfig={twilioConfig} />;
}
