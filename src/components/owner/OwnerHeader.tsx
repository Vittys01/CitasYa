"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

interface OwnerHeaderProps {
  user: { name: string; email: string };
}

export default function OwnerHeader({ user }: OwnerHeaderProps) {
  return (
    <header className="bg-white border-b border-[#e6d5c3] sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/owner" className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary-dark text-[18px]">corporate_fare</span>
          </div>
          <span className="font-bold text-[#4a3b32] text-sm">Panel Owner</span>
        </Link>

        {/* Right */}
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="hidden sm:flex items-center gap-1.5 text-sm text-[#9c8273] hover:text-[#4a3b32] transition-colors px-3 py-1.5 rounded-lg hover:bg-[#efe6dd]"
          >
            <span className="material-symbols-outlined text-[18px]">dashboard</span>
            Dashboard
          </Link>

          <div className="flex items-center gap-2 pl-2 border-l border-[#e6d5c3]">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary-dark text-[16px]">person</span>
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold text-[#4a3b32] leading-tight">{user.name}</p>
              <p className="text-[10px] text-[#9c8273]">Owner</p>
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: `${window.location.origin}/login` })}
            title="Cerrar sesión"
            className="p-1.5 text-[#bda696] hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
