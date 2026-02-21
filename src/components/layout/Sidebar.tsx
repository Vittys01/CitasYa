"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";
import { getNavItems } from "./navConfig";

export default function Sidebar({ role, settings }: { role: Role; settings: Record<string, string> }) {
  const pathname = usePathname();
  const get = (k: string, fallback: string) => settings[k] ?? fallback;
  const items = getNavItems(role);

  return (
    <aside className="hidden xl:flex w-64 h-screen flex-col border-r border-[#e6d5c3] bg-[#fbf6f1] shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-[#e6d5c3]">
        <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary-dark text-[20px]">spa</span>
        </div>
        <div>
          <h1 className="text-sm font-bold text-earth leading-none">{get("app.name", "Dates")}</h1>
          <p className="text-xs text-earth-muted mt-0.5">{get("app.tagline", "Gestión de turnos")}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
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
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors group",
                active
                  ? "bg-primary/10 text-primary-dark font-semibold"
                  : "text-earth-light hover:bg-[#efe6dd] hover:text-earth font-medium"
              )}
            >
              <span
                className={cn(
                  "material-symbols-outlined text-[20px] transition-colors",
                  active
                    ? "text-primary-dark"
                    : "text-[#bda696] group-hover:text-primary-dark"
                )}
              >
                {icon}
              </span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[#e6d5c3]">
        <p className="text-xs text-[#bda696] text-center">{get("app.name", "Dates")} {get("app.version", "v1.0")}</p>
      </div>
    </aside>
  );
}
