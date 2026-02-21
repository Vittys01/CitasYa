"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const schema = z.object({
  email:    z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const [error, setError] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setError(null);
    const res = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (res?.error) {
      setError("Email o contraseña incorrectos.");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#F5F1EF] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute -top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-[#D7CCC8]/30 blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] -left-[10%] w-[40%] h-[40%] rounded-full bg-[#EFEBE9]/50 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-5xl bg-white shadow-xl shadow-[#5d4037]/10 rounded-2xl overflow-hidden flex min-h-[600px] relative z-10 border border-[#E6D5C3]">

        {/* ── Left panel (image) ───────────────────────────────────────────── */}
        <div className="hidden md:flex md:w-1/2 relative flex-col justify-between p-10 overflow-hidden group">
          {/* Background photo */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&q=80')" }}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#3e2723]/85 via-[#3e2723]/30 to-transparent" />

          {/* Brand */}
          <div className="relative z-10 flex items-center gap-3 text-white">
            <div className="w-10 h-10 rounded-lg bg-[#8d6e63]/90 backdrop-blur-sm flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">spa</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#efebe9]">Dates</h1>
          </div>

          {/* Bottom copy */}
          <div className="relative z-10 space-y-4">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/10 text-xs font-medium text-white">
              <span className="material-symbols-outlined text-sm">verified</span>
              Gestión profesional de turnos
            </span>
            <h2 className="text-3xl font-bold leading-tight text-white">
              Organiza tu salón, deleita a tus clientes.
            </h2>
            <p className="text-[#d7ccc8] text-sm max-w-xs">
              Turnos, manicuristas, recordatorios por WhatsApp y más — todo en un lugar.
            </p>
          </div>
        </div>

        {/* ── Right panel (form) ───────────────────────────────────────────── */}
        <div className="w-full md:w-1/2 flex flex-col justify-center px-8 py-12 lg:px-14 bg-white relative">

          {/* Mobile brand */}
          <div className="flex md:hidden items-center gap-2 mb-8 justify-center">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary-dark">spa</span>
            </div>
            <span className="font-bold text-earth text-lg">Dates</span>
          </div>

          <div className="max-w-sm w-full mx-auto space-y-7">
            <div className="space-y-1.5 text-center md:text-left">
              <h3 className="text-3xl font-black tracking-tight text-earth">Bienvenida</h3>
              <p className="text-earth-muted text-sm">Ingresá tus datos para continuar.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-earth">Email</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-earth-muted pointer-events-none">
                    mail
                  </span>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="admin@dates.app"
                    {...register("email")}
                    className="w-full h-12 pl-10 pr-4 rounded-lg border border-[#D7CCC8] bg-[#FAFAFA] text-earth placeholder-[#BCAAA4] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition text-sm"
                  />
                </div>
                {errors.email && (
                  <p className="text-red-500 text-xs">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-earth">Contraseña</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-earth-muted pointer-events-none">
                    lock
                  </span>
                  <input
                    type={showPwd ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    {...register("password")}
                    className="w-full h-12 pl-10 pr-10 rounded-lg border border-[#D7CCC8] bg-[#FAFAFA] text-earth placeholder-[#BCAAA4] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-earth-muted hover:text-earth transition"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPwd ? "visibility" : "visibility_off"}
                    </span>
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-xs">{errors.password.message}</p>
                )}
              </div>

              {/* Error banner */}
              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-100 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 flex items-center justify-center gap-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-bold shadow-lg shadow-primary/25 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {isSubmitting ? "Ingresando..." : "Ingresar"}
                {!isSubmitting && (
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                )}
              </button>
            </form>

            {/* Footer links */}
            <div className="flex justify-center gap-6 text-xs text-[#BCAAA4]">
              <a href="#" className="hover:text-earth-light transition-colors">Privacidad</a>
              <a href="#" className="hover:text-earth-light transition-colors">Términos</a>
              <a href="#" className="hover:text-earth-light transition-colors">Soporte</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
