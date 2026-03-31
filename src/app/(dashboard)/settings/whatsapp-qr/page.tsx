import { redirect } from "next/navigation";

/** Ruta antigua: las plantillas WhatsApp se configuran en Twilio y en variables de entorno. */
export default function WhatsAppQrPage() {
  redirect("/settings");
}
