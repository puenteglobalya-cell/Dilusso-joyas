"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export function DeleteDictionaryEntry({ keyword }: { keyword: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm(`¿Eliminar la regla "${keyword}"?`)) return;
    setLoading(true);
    await fetch("/api/dictionary", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword }),
    });
    window.location.reload();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-50"
      title="Eliminar regla"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
