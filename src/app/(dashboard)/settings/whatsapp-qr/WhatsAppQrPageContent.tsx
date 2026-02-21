"use client";

import { useState } from "react";

export default function WhatsAppQrPageContent({
  evolutionManagerUrl,
}: {
  evolutionManagerUrl?: string;
}) {
  const [qrLoading, setQrLoading] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrImageError, setQrImageError] = useState(false);
  const [qrPairingCode, setQrPairingCode] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  async function handleShowQr() {
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

  return (
    <div className="rounded-xl border border-[#e6d5c3] bg-[#fbf6f1] p-6 space-y-4">
      <button
        type="button"
        onClick={handleShowQr}
        disabled={qrLoading}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#7f5539] text-white text-sm font-semibold hover:bg-[#6d4a32] disabled:opacity-60 transition-colors"
      >
        <span className="material-symbols-outlined text-[22px]">qr_code_2</span>
        {qrLoading ? "Cargando código…" : "Mostrar código QR"}
      </button>

      <div className="flex flex-col items-center gap-2 w-full">
        <p className="text-xs font-semibold text-[#5e4b3f] uppercase tracking-wider">Escaneá con WhatsApp</p>
        <div
          className="w-56 h-56 flex items-center justify-center border-2 border-[#e6d5c3] rounded-xl bg-white text-center"
          aria-busy={qrLoading}
        >
          {qrLoading && (
            <div className="flex flex-col items-center gap-2 text-[#9c8273]">
              <span className="material-symbols-outlined text-5xl animate-pulse">qr_code_2</span>
              <span className="text-sm">Cargando…</span>
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
            <p className="text-sm text-[#9c8273] px-4">Tocá el botón de arriba para cargar el código.</p>
          )}
        </div>
      </div>

      {qrPairingCode && !qrImage && !qrLoading && (
        <p className="text-xs text-[#7f6a5d] text-center">
          Ingresalo en WhatsApp: Ajustes → Dispositivos vinculados → Vincular con número de teléfono.
        </p>
      )}

      {evolutionManagerUrl && (
        <p className="text-center pt-2">
          <a
            href={evolutionManagerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-[#7f5539] hover:underline"
          >
            Abrir Manager de Evolution →
          </a>
        </p>
      )}
    </div>
  );
}
