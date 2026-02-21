"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const PLACEHOLDERS = ["{clientName}", "{serviceName}", "{manicuristName}", "{date}", "{time}"] as const;

const PREVIEW_VALUES: Record<string, string> = {
  "{clientName}": "María",
  "{serviceName}": "Manicura clásica",
  "{manicuristName}": "Sofía",
  "{date}": "martes 24 de octubre",
  "{time}": "10:00",
};

function substitutePreview(text: string): string {
  let out = text;
  for (const [key, value] of Object.entries(PREVIEW_VALUES)) {
    out = out.split(key).join(value);
  }
  return out;
}

/** Renders template text with *bold* as <strong> for preview */
function formatPreviewHtml(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  while (remaining.length > 0) {
    const open = remaining.indexOf("*");
    if (open === -1) {
      parts.push(<span key={key}>{remaining}</span>);
      break;
    }
    const close = remaining.indexOf("*", open + 1);
    if (close === -1) {
      parts.push(<span key={key}>{remaining}</span>);
      break;
    }
    parts.push(<span key={key}>{remaining.slice(0, open)}</span>);
    parts.push(<strong key={key + 1} className="font-semibold text-gray-900">{remaining.slice(open + 1, close)}</strong>);
    key += 2;
    remaining = remaining.slice(close + 1);
  }
  return <>{parts}</>;
}

export default function WhatsAppPageContent({
  settings = {},
  evolutionManagerUrl,
}: {
  settings?: Record<string, string>;
  evolutionManagerUrl?: string;
}) {
  const [templateConfirmation, setTemplateConfirmation] = useState(settings["whatsapp.template.confirmation"] ?? "");
  const [templateReminder, setTemplateReminder] = useState(settings["whatsapp.template.reminder"] ?? "");
  const [templateCancellation, setTemplateCancellation] = useState(settings["whatsapp.template.cancellation"] ?? "");
  const [templatesSaving, setTemplatesSaving] = useState(false);
  const [templatesMessage, setTemplatesMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const [qrLoading, setQrLoading] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrImageError, setQrImageError] = useState(false);
  const [qrPairingCode, setQrPairingCode] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

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
        setTemplatesMessage({ type: "ok", text: "Plantillas guardadas." });
      } else {
        setTemplatesMessage({ type: "error", text: data?.error?.message ?? `Error ${res.status}` });
      }
    } catch (e) {
      setTemplatesMessage({ type: "error", text: String(e) });
    } finally {
      setTemplatesSaving(false);
    }
  }

  const previewReminderText = substitutePreview(templateReminder || "⏰ Recordatorio: Hola {clientName}, tu turno es el {date} a las {time}. Servicio: {serviceName}. Profesional: {manicuristName}. ¡Te esperamos!");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Columna izquierda */}
      <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
        {/* Estado de integración */}
        <div className="rounded-xl border border-[#e6d5c3] bg-[#FFFAF0] p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
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
                <span className="text-sm text-green-700 font-medium">
                  Evolution API · Vincular número para enviar mensajes
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Configuración de tiempos */}
        <div className="rounded-xl border border-[#e6d5c3] bg-[#FFFAF0] p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[#4a3b32] flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[#7f5539]">schedule</span>
            Cuándo se envían los recordatorios
          </h2>
          <p className="text-sm text-[#7f6a5d] mb-3">
            Se envía un recordatorio <strong>24 horas antes</strong> del turno. Si el turno es en menos de 24 h, se envía <strong>1 hora antes</strong>. Podés personalizar el mensaje más abajo.
          </p>
        </div>

        {/* Plantillas de mensaje */}
        <div className="rounded-xl border border-[#e6d5c3] bg-[#FFFAF0] p-5 shadow-sm flex flex-col gap-4">
          <h2 className="text-lg font-bold text-[#4a3b32] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#7f5539]">edit_note</span>
            Plantilla de mensaje
          </h2>
          <p className="text-sm text-[#7f6a5d] -mt-2">
            Personalizá el texto. Dejá en blanco para usar el mensaje por defecto. En WhatsApp, *texto* se ve en negrita.
          </p>
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#9c8273] py-1">Variables:</span>
            {PLACEHOLDERS.map((p) => (
              <code key={p} className="px-2 py-1 bg-[#7f5539]/10 text-[#7f5539] rounded text-xs font-medium border border-[#7f5539]/20">
                {p}
              </code>
            ))}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#5e4b3f] mb-1">Confirmación (al agendar)</label>
            <textarea
              value={templateConfirmation}
              onChange={(e) => setTemplateConfirmation(e.target.value)}
              placeholder="Ej: ✅ Turno confirmado. Hola {clientName}! Tu turno: {date} a las {time}. Servicio: {serviceName}. Profesional: {manicuristName}."
              rows={3}
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
          {templatesMessage && (
            <p className={`text-sm ${templatesMessage.type === "ok" ? "text-green-700" : "text-red-700"}`}>
              {templatesMessage.text}
            </p>
          )}
        </div>

        {/* Ver código QR */}
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
            Mostrá el código acá o abrilo en otra pestaña para escanear con WhatsApp.
          </p>
          <button
            type="button"
            onClick={handleShowQrHere}
            disabled={qrLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#7f5539] text-white text-sm font-semibold hover:bg-[#6d4a32] disabled:opacity-60 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
            {qrLoading ? "Cargando…" : "Ver QR aquí"}
          </button>
          <div className="flex flex-col items-center gap-2 w-full pt-2">
            <div className="w-44 h-44 flex items-center justify-center border-2 border-[#e6d5c3] rounded-xl bg-white text-center">
              {qrLoading && (
                <div className="flex flex-col items-center gap-2 text-[#9c8273]">
                  <span className="material-symbols-outlined text-4xl animate-pulse">qr_code_2</span>
                  <span className="text-sm">Cargando…</span>
                </div>
              )}
              {!qrLoading && qrError && <p className="text-sm text-red-700 px-4">{qrError}</p>}
              {!qrLoading && !qrError && qrPairingCode && !qrImage && !qrImageError && (
                <p className="text-sm text-[#4a3b32] px-2 font-mono text-base">{qrPairingCode}</p>
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
                <p className="text-sm text-amber-700 px-4">No se pudo mostrar la imagen.</p>
              )}
              {!qrLoading && !qrError && !qrImage && !qrPairingCode && !qrImageError && (
                <p className="text-sm text-[#9c8273] px-4">Tocá «Ver QR aquí» para cargar.</p>
              )}
            </div>
          </div>
        </div>

        {evolutionManagerUrl && (
          <a
            href={evolutionManagerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7f5539] text-white text-sm font-semibold hover:bg-[#6d4a32] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">open_in_new</span>
            Abrir Manager de Evolution
          </a>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 pb-8">
          <Link
            href="/settings"
            className="px-6 py-2.5 rounded-lg border border-[#D7CCC8] text-[#4a3b32] font-medium hover:bg-[#fbf6f1] transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="button"
            onClick={handleSaveTemplates}
            disabled={templatesSaving}
            className="px-6 py-2.5 rounded-lg bg-[#7f5539] hover:bg-[#6d4a32] text-white font-medium shadow-sm flex items-center gap-2 disabled:opacity-60 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">save</span>
            {templatesSaving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>

      {/* Columna derecha: vista previa */}
      <div className="lg:col-span-5 xl:col-span-4 hidden lg:block">
        <div className="sticky top-6">
          <h3 className="text-lg font-bold text-[#4a3b32] mb-4">Vista previa</h3>
          <div className="relative mx-auto border-[#3e2723] bg-[#3e2723] border-[14px] rounded-[2.5rem] h-[580px] w-[280px] xl:w-[300px] shadow-xl overflow-hidden">
            <div className="rounded-[2rem] overflow-hidden w-full h-full bg-[#E5DDD5] flex flex-col">
              <div className="bg-[#075E54] h-7 w-full flex justify-between items-center px-4 pt-1.5 shrink-0">
                <span className="text-[10px] font-bold text-white">9:41</span>
                <div className="flex gap-0.5">
                  <span className="material-symbols-outlined text-[10px] text-white">signal_cellular_alt</span>
                  <span className="material-symbols-outlined text-[10px] text-white">wifi</span>
                  <span className="material-symbols-outlined text-[10px] text-white">battery_full</span>
                </div>
              </div>
              <div className="bg-[#075E54] px-3 py-2 flex items-center gap-2 shadow-md shrink-0">
                <span className="material-symbols-outlined text-white text-xl cursor-pointer">arrow_back</span>
                <div className="w-8 h-8 rounded-full bg-white flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">Salón</p>
                  <p className="text-white/70 text-[10px] truncate">Cuenta de negocio</p>
                </div>
                <div className="flex gap-2 text-white">
                  <span className="material-symbols-outlined text-lg">videocam</span>
                  <span className="material-symbols-outlined text-lg">call</span>
                  <span className="material-symbols-outlined text-lg">more_vert</span>
                </div>
              </div>
              <div
                className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 bg-[url('https://i.pinimg.com/originals/97/c0/07/97c00759d90d786d9b6096d274ad3e07.png')] bg-repeat"
                style={{ backgroundSize: "auto" }}
              >
                <div className="bg-[#DCF8C6] self-end rounded-lg rounded-tr-none p-2.5 max-w-[90%] shadow-sm">
                  <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {formatPreviewHtml(previewReminderText)}
                  </p>
                  <div className="flex justify-end items-center gap-1 mt-1">
                    <span className="text-[9px] text-gray-500">10:00</span>
                    <span className="material-symbols-outlined text-[10px] text-blue-500">done_all</span>
                  </div>
                </div>
              </div>
              <div className="bg-white p-2 flex items-center gap-2 shrink-0">
                <span className="material-symbols-outlined text-gray-500 text-xl">add</span>
                <div className="flex-1 bg-gray-100 rounded-full h-8 px-3 flex items-center">
                  <span className="text-gray-400 text-xs">Mensaje</span>
                </div>
                <span className="material-symbols-outlined text-gray-500 text-xl">camera_alt</span>
                <span className="material-symbols-outlined text-gray-500 text-xl">mic</span>
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-[#9c8273] mt-4">
            Así se verá el recordatorio en el dispositivo del cliente
          </p>
        </div>
      </div>
    </div>
  );
}
