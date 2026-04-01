import type { NextConfig } from "next";

/** En Heroku suele definirse solo AUTH_URL; next-auth/react compila con NEXTAUTH_URL. Sin esto, el bundle puede asumir localhost y fallar en móvil/producción. */
const authPublicUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  ...(authPublicUrl
    ? {
        env: {
          NEXTAUTH_URL: authPublicUrl,
        },
      }
    : {}),
};

export default nextConfig;
