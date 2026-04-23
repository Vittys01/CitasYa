import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dates — Gestión de Turnos",
  description: "Sistema SAAS de gestión para citas para manicuristas",
};

/** Fuerza ancho de viewport real en móvil (Safari/iOS); sin esto la página puede verse “de escritorio”. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.className} min-h-dvh w-full overflow-x-hidden antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
