"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

export function AddTCEntry() {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [rate, setRate] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!date || !rate) return;
    setLoading(true);
    await fetch("/api/exchange-rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, rate: parseFloat(rate), source: "Manual" }),
    });
    setOpen(false);
    setRate("");
    setLoading(false);
    window.location.reload();
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        <Plus className="w-4 h-4 mr-2" /> Agregar TC
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setOpen(false)}>
      <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Nuevo tipo de cambio</h2>
          <button onClick={() => setOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Fecha</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full text-sm border rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">TC (USD/UYU)</label>
            <input type="number" step="0.001" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="ej: 42.150" className="w-full text-sm border rounded-md px-3 py-2" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <Button onClick={handleSave} disabled={!date || !rate || loading} className="flex-1">
            {loading ? "Guardando..." : "Guardar"}
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
        </div>
      </div>
    </div>
  );
}
