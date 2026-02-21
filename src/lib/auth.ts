import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "./db";
import type { Role } from "@prisma/client";

// Extend the session to include role, id, and optional manicuristId
declare module "next-auth" {
  interface User {
    id: string;
    role: Role;
    manicuristId?: string | null;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
      manicuristId?: string | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    manicuristId?: string | null;
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
            isActive: true,
            manicurist: { select: { id: true } },
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

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          manicuristId: user.manicurist?.id ?? null,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.manicuristId = user.manicuristId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.manicuristId = token.manicuristId ?? null;
      return session;
    },
  },
});
