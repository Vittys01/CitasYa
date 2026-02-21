"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";

const g = (s: Record<string, string> | undefined, k: string, fb: string) => (s && s[k]) ?? fb;

interface Props { settings?: Record<string, string> }

type FormData = { name: string; phone: string; email?: string; notes?: string };

const labelCls = "block text-xs font-semibold text-earth uppercase tracking-wider mb-1.5";
const inputCls =
  "w-full px-3.5 py-2.5 text-sm border border-[#D7CCC8] rounded-lg bg-[#FFFDF5] text-earth placeholder-[#BCAAA4] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition";

function buildSchema(s: Record<string, string> | undefined) {
  return z.object({
    name:  z.string().min(2, g(s, "validation.minLength", "Mínimo 2 caracteres")),
    phone: z
      .string()
      .min(1, g(s, "validation.phoneRequired", "Ingresá el teléfono"))
      .refine(
        (v) => (v.replace(/\D/g, "").length >= 8 && v.replace(/\D/g, "").length <= 15),
        g(s, "validation.invalidPhone", "Teléfono inválido (código país + número, 8-15 dígitos)")
      ),
    email: z.string().email(g(s, "validation.invalidEmail", "Email inválido")).optional().or(z.literal("")),
    notes: z.string().optional(),
  });
}

export default function NewClientButton({ settings }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(buildSchema(settings)) });

  async function onSubmit(data: FormData) {
    setError(null);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error?.message ?? g(settings, "error.createClient", "Error al crear el cliente")); return; }
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-primary-dark hover:bg-primary-hover text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-warm-sm transition-all active:scale-[0.98]"
      >
        <span className="material-symbols-outlined text-[18px]">person_add</span>
        {g(settings, "action.newClient", "Nuevo cliente")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-stone-900/25 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-[#FFFDF5] rounded-2xl shadow-warm-lg w-full max-w-md mx-4 overflow-hidden z-10 border border-[#e6d5c3]">
            <div className="px-6 py-5 border-b border-[#e6d5c3] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-earth">{g(settings, "form.title.newClient", "Nuevo cliente")}</h2>
                <p className="text-xs text-earth-muted mt-0.5">{g(settings, "form.subtitle.newClient", "Registrá un nuevo cliente")}</p>
              </div>
              <button onClick={() => setOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-cream-dark text-[#bda696] hover:text-earth transition">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
              <div>
                <label className={labelCls}>{g(settings, "form.field.fullName", "Nombre completo")}</label>
                <input type="text" {...register("name")} placeholder={g(settings, "form.placeholder.name", "María García")} className={inputCls} />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className={labelCls}>{g(settings, "form.field.phone", "WhatsApp / Teléfono")}</label>
                <input
                  type="tel"
                  {...register("phone")}
                  placeholder={g(settings, "form.placeholder.phone", "+54 9 11 1234-5678, +57 300 1234567, +34 612 345 678")}
                  className={inputCls}
                />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
              </div>
              <div>
                <label className={labelCls}>{g(settings, "form.field.emailOptional", "Email (opcional)")}</label>
                <input type="email" {...register("email")} placeholder={g(settings, "form.placeholder.email", "cliente@email.com")} className={inputCls} />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <label className={labelCls}>{g(settings, "form.field.internalNotes", "Notas internas")}</label>
                <textarea {...register("notes")} rows={2} placeholder={g(settings, "form.placeholder.clientNotes", "Alergias, preferencias...")} className={`${inputCls} resize-none`} />
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 text-xs px-3.5 py-2.5 rounded-lg border border-red-100 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px]">error</span>
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 px-4 py-2.5 text-sm border border-[#D7CCC8] rounded-lg text-earth hover:bg-cream-dark bg-white transition">
                  {g(settings, "common.cancel", "Cancelar")}
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2.5 text-sm font-bold bg-primary-dark hover:bg-primary-hover text-white rounded-lg shadow-warm-sm transition disabled:opacity-50">
                  {isSubmitting ? g(settings, "common.saving", "Guardando...") : g(settings, "action.createClient", "Crear cliente")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
