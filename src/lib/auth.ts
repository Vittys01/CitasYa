import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "./db";
import type { Role } from "@prisma/client";

// Extend the session to include role, id, businessId (active business), and optional manicuristId
declare module "next-auth" {
  interface User {
    id: string;
    role: Role;
    businessId?: string | null;
    manicuristId?: string | null;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
      businessId?: string | null;
      manicuristId?: string | null;
    };
  }
}


const loginSchema = z.object({
  email: z.string().email().transform((s) => s.trim().toLowerCase()),
  password: z.string().min(1).transform((s) => s.trim()),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (process.env.NODE_ENV === "development" && credentials) {
          const keys = Object.keys(credentials).filter((k) => k !== "password" && k !== "Password");
          console.warn("[auth] authorize received keys:", keys.join(", "), "hasPassword:", "password" in credentials || "Password" in credentials);
        }
        // Normalize: body can be form-urlencoded so keys are lowercase; accept both
        const raw = credentials as Record<string, unknown> | null | undefined;
        if (!raw || typeof raw !== "object") return null;
        const email = [raw.email, (raw as Record<string, unknown>).Email].find(
          (v) => typeof v === "string" && v.length > 0
        ) as string | undefined;
        const password = [raw.password, (raw as Record<string, unknown>).Password].find(
          (v) => typeof v === "string" && v.length > 0
        ) as string | undefined;
        const parsed = loginSchema.safeParse({ email, password });
        if (!parsed.success) {
          if (process.env.NODE_ENV === "development") {
            console.warn("[auth] Parse failed:", parsed.error.flatten().fieldErrors);
          }
          return null;
        }

        if (process.env.NODE_ENV === "development") {
          console.warn("[auth] Looking up user, password length:", parsed.data.password.length);
        }

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            role: true,
            businessId: true,
            isActive: true,
            manicurist: { select: { id: true, businessId: true } },
          },
        });

        if (!user) {
          if (process.env.NODE_ENV === "development") {
            console.warn("[auth] User not found:", parsed.data.email);
          }
          return null;
        }
        if (!user.isActive) {
          if (process.env.NODE_ENV === "development") {
            console.warn("[auth] User inactive:", parsed.data.email);
          }
          return null;
        }

        const valid = await bcrypt.compare(parsed.data.password, user.password);
        if (process.env.NODE_ENV === "development") {
          console.warn("[auth] bcrypt.compare result:", valid, "hash prefix:", user.password.slice(0, 7));
        }
        if (!valid) {
          if (process.env.NODE_ENV === "development") {
            console.warn("[auth] Password mismatch for", parsed.data.email);
          }
          return null;
        }

        let businessId: string | null =
          user.role === "MANICURIST"
            ? user.manicurist?.businessId ?? null
            : user.businessId ?? null;
        if (user.role === "OWNER" && !businessId) {
          const first = await prisma.business.findFirst({
            where: { ownerId: user.id },
            select: { id: true },
          });
          businessId = first?.id ?? null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          businessId,
          manicuristId: user.manicurist?.id ?? null,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        // JWT extends Record<string, unknown> so these are safe assignments
        (token as Record<string, unknown>).id = user.id;
        (token as Record<string, unknown>).role = user.role;
        (token as Record<string, unknown>).businessId = user.businessId ?? null;
        (token as Record<string, unknown>).manicuristId = user.manicuristId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      const t = token as Record<string, unknown>;
      session.user.id = t.id as string;
      session.user.role = t.role as Role;
      session.user.businessId = (t.businessId as string | null | undefined) ?? null;
      session.user.manicuristId = (t.manicuristId as string | null | undefined) ?? null;
      return session;
    },
  },
});
