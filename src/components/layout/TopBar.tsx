"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { getNavItems } from "./navConfig";

interface TopBarProps {
  user: { name: string; email: string; role: string };
  settings: Record<string, string>;
}

export default function TopBar({ user, settings }: TopBarProps) {
  const pathname = usePathname();
  const roleLabel = settings[`role.${user.role}`] ?? user.role;
  const get = (k: string, fallback: string) => settings[k] ?? fallback;
  const items = getNavItems(user.role as "ADMIN" | "MANICURIST" | "RECEPTIONIST");

  return (
    <header className="h-14 bg-white border-b border-[#e6d5c3] flex items-center justify-between px-4 sm:px-6 shrink-0 z-10 gap-2">
      {/* Left: nav links (solo cuando no hay sidebar = no desktop) */}
      <nav className="flex xl:hidden items-center gap-0.5 overflow-x-auto no-scrollbar min-w-0">
        {items.map(({ href, key, icon, labelEs }) => {
          const label = get(key, labelEs);
          const active =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors",
                active
                  ? "bg-primary/10 text-primary-dark font-semibold"
                  : "text-earth-light hover:bg-[#efe6dd] hover:text-earth font-medium"
              )}
            >
              <span className="material-symbols-outlined text-[18px]">{icon}</span>
              <span className="hidden sm:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Right: user + sign out */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary-dark text-[18px]">person</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-earth leading-tight">{user.name}</p>
            <p className="text-xs text-earth-muted">{roleLabel}</p>
          </div>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title={settings["action.signOut"] ?? "Cerrar sesión"}
          className="p-2 text-[#bda696] hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
        </button>
      </div>
    </header>
  );
}
