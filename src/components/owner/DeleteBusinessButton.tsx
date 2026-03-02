"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteBusinessButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const res = await fetch(`/api/owner/businesses/${id}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      alert("Error al eliminar la empresa");
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-600 font-medium">¿Eliminar &quot;{name}&quot;?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs px-2 py-1 bg-red-500 text-white rounded font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
        >
          {loading ? "Eliminando..." : "Sí, eliminar"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs px-2 py-1 text-[#9c8273] hover:text-[#4a3b32] transition-colors"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
    >
      <span className="material-symbols-outlined text-[14px]">delete</span>
      Eliminar
    </button>
  );
}
