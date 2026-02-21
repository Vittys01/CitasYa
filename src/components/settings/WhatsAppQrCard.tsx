"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const PLACEHOLDERS = ["{clientName}", "{serviceName}", "{manicuristName}", "{date}", "{time}"];

export default function WhatsAppQrCard({
  settings = {},
  evolutionManagerUrl,
}: {
  settings?: Record<string, string>;
  evolutionManagerUrl?: string;
}) {
  const [recreating, setRecreating] = useState(false);
  const [recreateMessage, setRecreateMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrImageError, setQrImageError] = useState(false);
  const [qrPairingCode, setQrPairingCode] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  const [templateConfirmation, setTemplateConfirmation] = useState(settings["whatsapp.template.confirmation"] ?? "");
  const [templateReminder, setTemplateReminder] = useState(settings["whatsapp.template.reminder"] ?? "");
  const [templateCancellation, setTemplateCancellation] = useState(settings["whatsapp.template.cancellation"] ?? "");
  const [templatesSaving, setTemplatesSaving] = useState(false);
  const [templatesMessage, setTemplatesMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    setTemplateConfirmation(settings["whatsapp.template.confirmation"] ?? "");
    setTemplateReminder(settings["whatsapp.template.reminder"] ?? "");
    setTemplateCancellation(settings["whatsapp.template.cancellation"] ?? "");
  }, [settings["whatsapp.template.confirmation"], settings["whatsapp.template.reminder"], settings["whatsapp.template.cancellation"]]);

  async function handleShowQrHere() {
    setQrError(null);
    setQrImage(null);
    setQrImageError(false);
    setQrPairingCode(null);
    setQrLoading(true);
    try {
      const res = await fetch("/api/whatsapp/qr");
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.base64) setQrImage(data.base64);
        if (data.pairingCode) setQrPairingCode(data.pairingCode);
        if (!data.base64 && !data.pairingCode) setQrError("No se recibió QR ni código.");
      } else {
        setQrError(data?.error ?? `Error ${res.status}`);
      }
    } catch (e) {
      setQrError(String(e));
    } finally {
      setQrLoading(false);
    }
  }

  async function handleRecreateInstance() {
    setRecreateMessage(null);
    setRecreating(true);
    try {
      const res = await fetch("/api/whatsapp/recreate-instance", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setRecreateMessage({ type: "ok", text: data.message ?? "Listo. Abrí el Manager y tocá «Obtener código QR»." });
      } else {
        setRecreateMessage({ type: "error", text: data?.error ?? `Error ${res.status}` });
      }
    } catch (e) {
      setRecreateMessage({ type: "error", text: String(e) });
    } finally {
      setRecreating(false);
    }
  }

  async function handleSaveTemplates() {
    setTemplatesMessage(null);
    setTemplatesSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "whatsapp.template.confirmation": templateConfirmation,
          "whatsapp.template.reminder": templateReminder,
          "whatsapp.template.cancellation": templateCancellation,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTemplatesMessage({ type: "ok", text: "Plantillas guardadas. Los próximos mensajes usarán estos textos." });
      } else {
        setTemplatesMessage({ type: "error", text: data?.error?.message ?? `Error ${res.status}` });
      }
    } catch (e) {
      setTemplatesMessage({ type: "error", text: String(e) });
    } finally {
      setTemplatesSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-[#e6d5c3] bg-[#FFFDF5] shadow-sm overflow-hidden">
      {/* Encabezado de sección */}
      <div className="px-6 py-5 border-b border-[#e6d5c3] bg-[#fbf6f1]">
        <h2 className="text-xl font-bold text-[#4a3b32] flex items-center gap-2">
          <span className="material-symbols-outlined text-[#7f5539] text-[22px]">smartphone</span>
          Automatización por WhatsApp
        </h2>
        <p className="text-sm text-[#9c8273] mt-1">
          Configurá recordatorios y notificaciones automáticas por WhatsApp para reducir inasistencias.
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Estado de integración */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#e6d5c3] bg-[#FFFAF0] p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-700 border border-green-100">
              <span className="material-symbols-outlined text-2xl">chat</span>
            </div>
            <div>
              <h3 className="font-semibold text-[#4a3b32]">Estado de la integración</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600" />
                </span>
                <span className="text-sm text-green-700 font-medium">Evolution API · Vincular número para enviar mensajes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Plantillas de mensajes */}
        <div className="rounded-xl border border-[#e6d5c3] bg-[#fbf6f1] p-5 space-y-4">
          <h3 className="text-base font-bold text-[#4a3b32] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#7f5539] text-[20px]">edit_note</span>
            Plantillas de mensajes
          </h3>
          <p className="text-sm text-[#7f6a5d]">
            Personalizá el texto que se envía por WhatsApp. Dejá en blanco para usar el mensaje por defecto. Podés usar:{" "}
            {PLACEHOLDERS.map((p) => (
              <code key={p} className="mx-0.5 px-1.5 py-0.5 bg-white rounded border border-[#e6d5c3] text-xs">{p}</code>
            ))}. En WhatsApp, *texto* se ve en negrita.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#5e4b3f] mb-1">Confirmación (al agendar el turno)</label>
              <textarea
                value={templateConfirmation}
                onChange={(e) => setTemplateConfirmation(e.target.value)}
                placeholder="Ej: ✅ Turno confirmado. Hola {clientName}! Tu turno: {date} a las {time}. Servicio: {serviceName}. Profesional: {manicuristName}."
                rows={4}
                className="w-full px-3 py-2 text-sm border border-[#D7CCC8] rounded-lg bg-white text-[#4a3b32] placeholder-[#bda696] focus:outline-none focus:ring-2 focus:ring-[#7f5539]/30 focus:border-[#7f5539] resize-y"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5e4b3f] mb-1">Recordatorio (24 h o 1 h antes)</label>
              <textarea
                value={templateReminder}
                onChange={(e) => setTemplateReminder(e.target.value)}
                placeholder="Ej: ⏰ Recordatorio: Hola {clientName}! Tu turno es el {date} a las {time}. Servicio: {serviceName}. ¡Te esperamos!"
                rows={4}
                className="w-full px-3 py-2 text-sm border border-[#D7CCC8] rounded-lg bg-white text-[#4a3b32] placeholder-[#bda696] focus:outline-none focus:ring-2 focus:ring-[#7f5539]/30 focus:border-[#7f5539] resize-y"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5e4b3f] mb-1">Cancelación</label>
              <textarea
                value={templateCancellation}
                onChange={(e) => setTemplateCancellation(e.target.value)}
                placeholder="Ej: ❌ Turno cancelado. Hola {clientName}, tu turno del {date} a las {time} para {serviceName} fue cancelado."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-[#D7CCC8] rounded-lg bg-white text-[#4a3b32] placeholder-[#bda696] focus:outline-none focus:ring-2 focus:ring-[#7f5539]/30 focus:border-[#7f5539] resize-y"
              />
            </div>
          </div>
          {templatesMessage && (
            <p className={`text-sm ${templatesMessage.type === "ok" ? "text-green-700" : "text-red-700"}`}>
              {templatesMessage.text}
            </p>
          )}
          <button
            type="button"
            onClick={handleSaveTemplates}
            disabled={templatesSaving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#7f5539] text-white text-sm font-semibold hover:bg-[#6d4a32] disabled:opacity-60 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">save</span>
            {templatesSaving ? "Guardando…" : "Guardar plantillas"}
          </button>
        </div>

        {/* Bloque: problema con QR en el Manager */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
          <p className="text-sm font-medium text-amber-900">Si «Obtener código QR» no muestra nada o se queda cargando</p>
          <p className="text-xs text-amber-800 mt-1">
            La instancia se creó con <strong>Número</strong> lleno. En ese modo no se muestra QR: el código de 8 dígitos aparece en <strong>tu WhatsApp en el celular</strong>. Para ver un QR en pantalla, la instancia debe estar <strong>sin número</strong>.
          </p>
          <p className="text-xs text-amber-800 mt-2 font-medium">Solución rápida</p>
          <p className="text-xs text-amber-800 mt-0.5">
            Tocá el botón para recrear la instancia <strong>sin número</strong>. Luego abrí el Manager y tocá <strong>Obtener código QR</strong>.
          </p>
          <button
            type="button"
            onClick={handleRecreateInstance}
            disabled={recreating}
            className="mt-3 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-60 transition-colors"
          >
            {recreating ? "Recreando…" : "Recrear instancia para ver QR"}
          </button>
          {recreateMessage && (
            <p className={`mt-2 text-sm ${recreateMessage.type === "ok" ? "text-green-800" : "text-red-800"}`}>
              {recreateMessage.text}
            </p>
          )}
          <p className="text-xs text-amber-700 mt-2 font-medium">O manualmente</p>
          <ol className="text-xs text-amber-800 list-decimal list-inside mt-0.5 space-y-0.5">
            <li>En el Manager, eliminá la instancia actual.</li>
            <li>Creá una nueva: nombre = <strong>dates-instance</strong>, canal = <strong>Baileys</strong>, <strong>Número = vacío</strong>.</li>
            <li>Entrá a la instancia y tocá <strong>Obtener código QR</strong>.</li>
          </ol>
        </div>

        {/* Ver QR en esta página */}
        <div className="rounded-xl border border-[#e6d5c3] bg-[#fbf6f1] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-[#4a3b32] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#7f5539] text-[20px]">qr_code_2</span>
              Ver código QR
            </h3>
            <Link
              href="/settings/whatsapp-qr"
              className="text-sm font-medium text-[#7f5539] hover:text-[#6d4a32] flex items-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
              Ver código QR en una página aparte
            </Link>
          </div>
          <p className="text-sm text-[#7f6a5d]">
            Si en el Manager no se ve el QR, pedí el código acá y mostralo debajo. También podés abrirlo en otra pestaña o en otro dispositivo.
          </p>
          <button
            type="button"
            onClick={handleShowQrHere}
            disabled={qrLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#7f5539] text-white text-sm font-semibold hover:bg-[#6d4a32] disabled:opacity-60 transition-colors shadow-md shadow-[#7f5539]/20"
          >
            <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
            {qrLoading ? "Cargando código…" : "Ver QR aquí"}
          </button>

          <div className="flex flex-col items-center gap-2 w-full pt-2">
            <p className="text-xs font-semibold text-[#5e4b3f] uppercase tracking-wider">Escaneá con WhatsApp</p>
            <div
              className="w-52 h-52 flex items-center justify-center border-2 border-[#e6d5c3] rounded-xl bg-white text-center shadow-inner"
              aria-busy={qrLoading}
            >
              {qrLoading && (
                <div className="flex flex-col items-center gap-2 text-[#9c8273]">
                  <span className="material-symbols-outlined text-5xl animate-pulse">qr_code_2</span>
                  <span className="text-sm">Cargando código…</span>
                </div>
              )}
              {!qrLoading && qrError && (
                <p className="text-sm text-red-700 px-4">{qrError}</p>
              )}
              {!qrLoading && !qrError && qrPairingCode && !qrImage && !qrImageError && (
                <p className="text-sm text-[#4a3b32] px-4">
                  Código: <strong className="font-mono text-base">{qrPairingCode}</strong>
                </p>
              )}
              {!qrLoading && !qrError && qrImage && !qrImageError && (
                <img
                  src={qrImage.startsWith("data:") ? qrImage : `data:image/png;base64,${qrImage}`}
                  alt="QR para vincular WhatsApp"
                  className="w-full h-full object-contain rounded-lg"
                  onError={() => setQrImageError(true)}
                />
              )}
              {!qrLoading && !qrError && qrImageError && (
                <p className="text-sm text-amber-700 px-4">No se pudo mostrar la imagen. Probá de nuevo.</p>
              )}
              {!qrLoading && !qrError && !qrImage && !qrPairingCode && !qrImageError && (
                <p className="text-sm text-[#9c8273] px-4">Tocá «Ver QR aquí» para cargar el código.</p>
              )}
            </div>
          </div>
          {qrPairingCode && !qrImage && !qrLoading && (
            <p className="text-xs text-[#7f6a5d]">
              Ingresalo en WhatsApp: Ajustes → Dispositivos vinculados → Vincular con número de teléfono.
            </p>
          )}
        </div>

        {/* Pasos normales */}
        <div className="rounded-xl border border-[#e6d5c3] bg-[#fbf6f1] p-5">
          <h3 className="text-sm font-bold text-[#4a3b32] mb-2">Pasos habituales (instancia sin número)</h3>
          <ol className="text-sm text-[#7f6a5d] space-y-2 list-decimal list-inside">
            <li>Abrí el <strong className="text-[#4a3b32]">Manager de Evolution</strong> (enlace de abajo).</li>
            <li>Entrá a la instancia <strong className="text-[#4a3b32]">dates-instance</strong>.</li>
            <li>Hacé clic en <strong className="text-[#4a3b32]">Reiniciar</strong> si está desconectada.</li>
            <li>Hacé clic en <strong className="text-[#4a3b32]">Obtener código QR</strong>.</li>
            <li>Escaneá el QR con WhatsApp: Ajustes → Dispositivos vinculados → Vincular un dispositivo.</li>
          </ol>
        </div>

        {evolutionManagerUrl ? (
          <a
            href={evolutionManagerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7f5539] text-white text-sm font-semibold hover:bg-[#6d4a32] transition-colors shadow-md shadow-[#7f5539]/20"
          >
            <span className="material-symbols-outlined text-[20px]">open_in_new</span>
            Abrir Manager de Evolution
          </a>
        ) : (
          <p className="text-sm text-[#9c8273]">
            Configurá <code className="bg-white px-1.5 py-0.5 rounded border border-[#e6d5c3] text-xs">EVOLUTION_API_URL</code> en el servidor para mostrar el enlace al Manager (ej. <code className="bg-white px-1.5 py-0.5 rounded border border-[#e6d5c3] text-xs">http://localhost:8080</code>).
          </p>
        )}
      </div>
    </section>
  );
}
