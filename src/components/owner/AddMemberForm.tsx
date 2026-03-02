"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const COLORS = [
  "#ec4899", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ef4444",
];

interface AddMemberFormProps {
  businessId: string;
  businessName: string;
}

export default function AddMemberForm({ businessId, businessName }: AddMemberFormProps) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"ADMIN" | "MANICURIST" | "RECEPTIONIST">("ADMIN");
  const [color, setColor] = useState("#ec4899");
  const [bio, setBio] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch(`/api/owner/businesses/${businessId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role, color, bio: bio || undefined }),
    });

    setLoading(false);
    const json = await res.json();

    if (!res.ok) {
      setError(json?.error?.message ?? "Error al crear el usuario");
      return;
    }

    router.push(`/owner/businesses/${businessId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
          <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0">error</span>
          {error}
        </div>
      )}

      {/* ── Datos del usuario ── */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-[#4a3b32] uppercase tracking-wide">Datos del usuario</h3>

        <div>
          <label className="block text-sm font-semibold text-[#4a3b32] mb-1.5">
            Nombre completo <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="María López"
            required
            className="w-full px-4 py-2.5 rounded-xl border border-[#e6d5c3] bg-white text-[#4a3b32] placeholder:text-[#c4a882] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#4a3b32] mb-1.5">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="maria@empresa.com"
            required
            className="w-full px-4 py-2.5 rounded-xl border border-[#e6d5c3] bg-white text-[#4a3b32] placeholder:text-[#c4a882] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#4a3b32] mb-1.5">
            Contraseña <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              required
              minLength={8}
              className="w-full px-4 py-2.5 rounded-xl border border-[#e6d5c3] bg-white text-[#4a3b32] placeholder:text-[#c4a882] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition text-sm pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9c8273] hover:text-[#4a3b32] transition-colors"
              tabIndex={-1}
            >
              <span className="material-symbols-outlined text-[18px]">
                {showPassword ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Rol ── */}
      <div className="space-y-3 pt-2 border-t border-[#f0e7de]">
        <h3 className="text-sm font-bold text-[#4a3b32] uppercase tracking-wide">Rol en la empresa</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(["ADMIN", "MANICURIST", "RECEPTIONIST"] as const).map((r) => {
            const meta = {
              ADMIN: {
                icon: "manage_accounts",
                label: "Admin",
                desc: "Gestiona turnos, clientes y equipo",
              },
              MANICURIST: {
                icon: "brush",
                label: "Manicurista",
                desc: "Atiende turnos y tiene agenda propia",
              },
              RECEPTIONIST: {
                icon: "support_agent",
                label: "Recepcionista",
                desc: "Agenda turnos, sin acceso admin",
              },
            }[r];

            return (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`text-left p-3 rounded-xl border-2 transition-all ${
                  role === r
                    ? "border-primary bg-primary/5"
                    : "border-[#e6d5c3] hover:border-[#c4a882] bg-white"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`material-symbols-outlined text-[18px] ${
                      role === r ? "text-primary" : "text-[#9c8273]"
                    }`}
                  >
                    {meta.icon}
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      role === r ? "text-[#4a3b32]" : "text-[#7a5c44]"
                    }`}
                  >
                    {meta.label}
                  </span>
                </div>
                <p className="text-xs text-[#9c8273]">{meta.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Opciones de manicurista ── */}
      {role === "MANICURIST" && (
        <div className="space-y-4 pt-2 border-t border-[#f0e7de]">
          <h3 className="text-sm font-bold text-[#4a3b32] uppercase tracking-wide">Perfil de manicurista</h3>

          <div>
            <label className="block text-sm font-semibold text-[#4a3b32] mb-2">Color en el calendario</label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                    color === c ? "ring-2 ring-offset-2 ring-[#4a3b32] scale-110" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                title="Color personalizado"
                className="w-8 h-8 rounded-full cursor-pointer border border-[#e6d5c3] p-0.5"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#4a3b32] mb-1.5">
              Bio / descripción
              <span className="ml-1 text-xs text-[#9c8273] font-normal">(opcional)</span>
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Especialista en nail art y extensiones..."
              rows={3}
              maxLength={300}
              className="w-full px-4 py-2.5 rounded-xl border border-[#e6d5c3] bg-white text-[#4a3b32] placeholder:text-[#c4a882] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition text-sm resize-none"
            />
            <p className="text-xs text-[#9c8273] mt-1">{bio.length}/300 caracteres</p>
          </div>

          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <span className="material-symbols-outlined text-blue-500 text-[16px] mt-0.5 shrink-0">info</span>
            <p className="text-xs text-blue-700">
              Se creará con horario por defecto lunes a viernes de 09:00 a 18:00.
              Podés modificarlo después desde <strong>Equipo</strong>.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark disabled:opacity-60 transition-colors shadow-sm"
        >
          {loading ? "Creando..." : `Crear usuario en ${businessName}`}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2.5 text-sm text-[#9c8273] hover:text-[#4a3b32] transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
