"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";

type FilaSegmento = {
  mes: string;
  segmento: "Lado A" | "Lado B";
  ingresos: number;
  egresos: number;
  neto: number;
  pct_ingresos_del_mes: number | null;
  pct_egresos_del_mes: number | null;
};

type CashEntry = {
  id: string;
  fecha: string;
  descripcion: string;
  monto: number;
  movimiento: "salida" | "ingreso";
  tipo: "negocio" | "personal";
  categoria_negocio: string | null;
  categoria_personal: string | null;
  notas: string | null;
};

function money(n: number) {
  return n.toLocaleString("es-UY", { style: "currency", currency: "UYU", maximumFractionDigits: 0 });
}

function mesLabel(mes: string) {
  const d = new Date(mes + "T00:00:00");
  return d.toLocaleDateString("es-UY", { month: "short", year: "2-digit" });
}

function NuevoLadoBForm({ onSaved }: { onSaved: () => void }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [movimiento, setMovimiento] = useState<"salida" | "ingreso">("salida");
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoria, setCategoria] = useState("");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/categorias-list").then(r => r.json()).then(d => setCategorias(d.negocio ?? []));
  }, []);

  async function submit() {
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/admin/cash-entries", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha, descripcion, monto: parseFloat(monto), movimiento, tipo: "negocio", categoria_negocio: categoria, notas: notas || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setDescripcion(""); setMonto(""); setNotas("");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border p-5">
      <h3 className="text-sm font-semibold mb-3">Cargar movimiento de Lado B (efectivo, sin boleta)</h3>
      <div className="grid grid-cols-6 gap-2">
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="h-9 px-2 border border-gray-200 rounded text-sm col-span-1" />
        <input type="text" placeholder="Descripción (ej: Taller Pepe - Agosto 2026)" value={descripcion} onChange={e => setDescripcion(e.target.value)} className="h-9 px-2 border border-gray-200 rounded text-sm col-span-2" />
        <input type="number" placeholder="Monto" value={monto} onChange={e => setMonto(e.target.value)} className="h-9 px-2 border border-gray-200 rounded text-sm col-span-1" />
        <select value={movimiento} onChange={e => setMovimiento(e.target.value as "salida" | "ingreso")} className="h-9 px-2 border border-gray-200 rounded text-sm col-span-1">
          <option value="salida">Egreso</option>
          <option value="ingreso">Ingreso</option>
        </select>
        <select value={categoria} onChange={e => setCategoria(e.target.value)} className="h-9 px-2 border border-gray-200 rounded text-sm col-span-1">
          <option value="">— Categoría —</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="text" placeholder="Notas (opcional)" value={notas} onChange={e => setNotas(e.target.value)} className="h-9 px-2 border border-gray-200 rounded text-sm col-span-5" />
        <button
          onClick={submit}
          disabled={saving || !descripcion || !monto}
          className="h-9 flex items-center justify-center gap-1 bg-brand hover:bg-brand-dark text-white text-sm font-semibold rounded-lg disabled:opacity-50 col-span-1"
        >
          <Plus className="w-4 h-4" /> Cargar
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}

export function SegmentosPanel() {
  const [filas, setFilas] = useState<FilaSegmento[]>([]);
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [segRes, entRes] = await Promise.all([
        fetch("/api/admin/segmentos").then(r => r.json()),
        fetch("/api/admin/cash-entries").then(r => r.json()),
      ]);
      setFilas(segRes.filas ?? []);
      setEntries(entRes.entries ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este movimiento de Lado B?")) return;
    await fetch(`/api/admin/cash-entries?id=${id}`, { method: "DELETE" });
    load();
  }

  const meses = Array.from(new Set(filas.map(f => f.mes))).sort().reverse().slice(0, 12);
  const porMes = new Map<string, { A?: FilaSegmento; B?: FilaSegmento }>();
  for (const f of filas) {
    if (!porMes.has(f.mes)) porMes.set(f.mes, {});
    const entry = porMes.get(f.mes)!;
    if (f.segmento === "Lado A") entry.A = f; else entry.B = f;
  }

  return (
    <div className="space-y-6">
      <NuevoLadoBForm onSaved={load} />

      <div className="bg-white rounded-xl border p-5 overflow-x-auto">
        <h3 className="text-sm font-semibold mb-3">Lado A (bancarizado) vs Lado B (efectivo) — últimos 12 meses</h3>
        {loading && filas.length === 0 && <p className="text-sm text-muted">Cargando…</p>}
        {!loading && filas.length === 0 && <p className="text-sm text-muted">Sin datos todavía.</p>}
        {meses.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-subtle border-b">
                <th className="pb-2 font-medium">Mes</th>
                <th className="pb-2 font-medium text-right">Lado A — egresos</th>
                <th className="pb-2 font-medium text-right">Lado B — egresos</th>
                <th className="pb-2 font-medium text-right">% Lado B del total</th>
                <th className="pb-2 font-medium text-right">Neto consolidado</th>
              </tr>
            </thead>
            <tbody>
              {meses.map(mes => {
                const { A, B } = porMes.get(mes) ?? {};
                const egresosA = A?.egresos ?? 0;
                const egresosB = B?.egresos ?? 0;
                const totalEgresos = egresosA + egresosB;
                const pctB = totalEgresos > 0 ? Math.round((egresosB / totalEgresos) * 1000) / 10 : null;
                const neto = (A?.neto ?? 0) + (B?.neto ?? 0);
                return (
                  <tr key={mes} className="border-b border-gray-50">
                    <td className="py-1.5 capitalize">{mesLabel(mes)}</td>
                    <td className="py-1.5 text-right">{money(egresosA)}</td>
                    <td className="py-1.5 text-right">{money(egresosB)}</td>
                    <td className="py-1.5 text-right">{pctB != null ? `${pctB}%` : "—"}</td>
                    <td className={`py-1.5 text-right font-medium ${neto >= 0 ? "text-green-700" : "text-red-600"}`}>{money(neto)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white rounded-xl border p-5 overflow-x-auto">
        <h3 className="text-sm font-semibold mb-3">Movimientos de Lado B cargados ({entries.length})</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-subtle border-b">
              <th className="pb-2 font-medium">Fecha</th>
              <th className="pb-2 font-medium">Descripción</th>
              <th className="pb-2 font-medium">Categoría</th>
              <th className="pb-2 font-medium text-right">Monto</th>
              <th className="pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} className="border-b border-gray-50">
                <td className="py-1.5">{e.fecha}</td>
                <td className="py-1.5">{e.descripcion}</td>
                <td className="py-1.5 text-subtle">{e.categoria_negocio || e.categoria_personal || "—"}</td>
                <td className={`py-1.5 text-right ${e.movimiento === "ingreso" ? "text-green-700" : ""}`}>
                  {e.movimiento === "ingreso" ? "+" : "-"}{money(e.monto)}
                </td>
                <td className="py-1.5 text-right">
                  <button onClick={() => eliminar(e.id)} className="text-subtle hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
