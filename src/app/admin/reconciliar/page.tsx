"use client";
import { useState, useRef } from "react";
import { formatUYU, formatDate } from "@/lib/utils";
import type { ReconcilRow } from "@/app/api/admin/reconciliar-excel/route";

interface Result {
  total_excel: number;
  total_matches: number;
  matches: ReconcilRow[];
}

export default function ReconciliarPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [applied, setApplied] = useState<{ updated: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setLoading(true); setError(null); setResult(null); setApplied(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/reconciliar-excel", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error"); return; }
      setResult(data);
      setSelected(new Set(data.matches.map((m: ReconcilRow) => m.id)));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    if (!result) return;
    const toApply = result.matches.filter(m => selected.has(m.id));
    if (!toApply.length) return;
    setApplying(true);
    try {
      const res = await fetch("/api/admin/reconciliar-excel/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matches: toApply }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error"); return; }
      setApplied({ updated: data.updated });
    } finally {
      setApplying(false);
    }
  }

  function toggleAll() {
    if (!result) return;
    if (selected.size === result.matches.length) setSelected(new Set());
    else setSelected(new Set(result.matches.map(m => m.id)));
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Reconciliación por Excel</h1>
      <p className="text-sm text-slate-500 mb-6">
        Subí tu Excel con movimientos clasificados. El sistema busca coincidencias por banco + fecha + importe
        entre los movimientos sin clasificar y aplica la categorización automáticamente.
      </p>

      <div className="bg-white rounded-xl border p-6 mb-6">
        <div className="flex items-center gap-4">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="text-sm text-slate-600" />
          <button
            onClick={handleUpload}
            disabled={loading}
            className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-brand/90 transition-colors"
          >
            {loading ? "Analizando…" : "Analizar Excel"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm mb-4">{error}</div>
      )}

      {applied && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700 text-sm mb-4 font-medium">
          ✓ {applied.updated} movimientos clasificados exitosamente.
        </div>
      )}

      {result && !applied && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-slate-500 mb-1">Filas clasificadas en Excel</p>
              <p className="text-2xl font-bold">{result.total_excel.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-slate-500 mb-1">Matches encontrados en sistema</p>
              <p className="text-2xl font-bold text-green-600">{result.total_matches.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-slate-500 mb-1">Seleccionados para aplicar</p>
              <p className="text-2xl font-bold text-brand">{selected.size.toLocaleString()}</p>
            </div>
          </div>

          {result.matches.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-slate-700">Vista previa de cambios</p>
                <div className="flex gap-3">
                  <button onClick={toggleAll} className="text-xs text-brand underline">
                    {selected.size === result.matches.length ? "Deseleccionar todos" : "Seleccionar todos"}
                  </button>
                  <button
                    onClick={handleApply}
                    disabled={applying || selected.size === 0}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-green-700 transition-colors"
                  >
                    {applying ? "Aplicando…" : `Aplicar ${selected.size} clasificaciones`}
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-3 py-3 w-8">
                        <input type="checkbox" checked={selected.size === result.matches.length} onChange={toggleAll} />
                      </th>
                      <th className="text-left px-3 py-3 font-medium text-slate-500">Fecha</th>
                      <th className="text-left px-3 py-3 font-medium text-slate-500">Banco</th>
                      <th className="text-left px-3 py-3 font-medium text-slate-500">Descripción</th>
                      <th className="text-right px-3 py-3 font-medium text-slate-500">Débito</th>
                      <th className="text-right px-3 py-3 font-medium text-slate-500">Crédito</th>
                      <th className="text-left px-3 py-3 font-medium text-slate-500">Tipo → Categoría</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.matches.map(m => (
                      <tr key={m.id} className={`hover:bg-slate-50 ${selected.has(m.id) ? "" : "opacity-40"}`}>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={selected.has(m.id)}
                            onChange={() => {
                              const s = new Set(selected);
                              if (s.has(m.id)) s.delete(m.id); else s.add(m.id);
                              setSelected(s);
                            }}
                          />
                        </td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{formatDate(m.fecha)}</td>
                        <td className="px-3 py-2 font-medium">{m.banco}</td>
                        <td className="px-3 py-2 text-slate-600 max-w-xs truncate">{m.descripcion ?? "—"}</td>
                        <td className="px-3 py-2 text-right text-red-600">{m.debito ? formatUYU(m.debito) : "—"}</td>
                        <td className="px-3 py-2 text-right text-green-600">{m.credito ? formatUYU(m.credito) : "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full mr-1 ${m.tipo_propuesto === "negocio" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                            {m.tipo_propuesto}
                          </span>
                          <span className="text-slate-600 text-xs">
                            {m.tipo_propuesto === "negocio" ? m.cat_negocio : m.cat_personal}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="bg-slate-50 rounded-xl border p-8 text-center text-slate-400">
              No se encontraron movimientos sin clasificar que coincidan con el Excel.
            </div>
          )}
        </>
      )}
    </div>
  );
}
