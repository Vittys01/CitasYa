import { redirect } from "next/navigation";

/**
 * Con Meta Cloud API no se usa QR. Redirigir a la página de WhatsApp.
 */
export default function WhatsAppQrPage() {
  redirect("/whatsapp");
}
