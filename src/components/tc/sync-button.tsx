"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function SyncTCButton() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function sync() {
    setLoading(true); setMsg(null); setIsError(false);
    try {
      const res = await fetch("/api/admin/sync-tc", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      if (data.actualizados === 0) {
        setMsg(data.reason === "ya está al día" ? "Ya está al día" : `Sin novedades (${data.reason ?? ""})`);
      } else {
        setMsg(`✓ ${data.actualizados} cotización(es) · última: ${data.ultima} = ${data.ultimoValor}`);
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch (e) {
      setIsError(true);
      setMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={sync} disabled={loading} size="sm" variant="outline">
        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Actualizando…" : "Actualizar del BCU"}
      </Button>
      {msg && <p className={`text-xs ${isError ? "text-red-600" : "text-olive"}`}>{msg}</p>}
    </div>
  );
}
