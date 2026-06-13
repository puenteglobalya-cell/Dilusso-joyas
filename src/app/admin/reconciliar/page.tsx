"use client";
import { useState, useRef, useMemo } from "react";
import { formatUYU, formatDate } from "@/lib/utils";
import type { ReconcilRow } from "@/app/api/admin/reconciliar-excel/route";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

interface Result {
  total_excel: number;
  total_matches: number;
  matches: ReconcilRow[];
}

type SortCol = "fecha" | "banco" | "descripcion" | "importe" | "tipo" | "categoria";
type SortDir = "asc" | "desc";

export default function ReconciliarPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [applied, setApplied] = useState<{ updated: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Filters
  const [filterTipo, setFilterTipo] = useState<"" | "negocio" | "personal">("");
  const [filterCat, setFilterCat] = useState("");
  const [filterBanco, setFilterBanco] = useState("");

  // Sort
  const [sortCol, setSortCol] = useState<SortCol>("fecha");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setLoading(true); setError(null); setResult(null); setApplied(null);
    setFilterTipo(""); setFilterCat(""); setFilterBanco("");
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

  function catOf(m: ReconcilRow) {
    return (m.tipo_propuesto === "negocio" ? m.cat_negocio : m.cat_personal) ?? "";
  }

  // Derived option lists
  const bancos = useMemo(() => {
    if (!result) return [];
    return [...new Set(result.matches.map(m => m.banco))].sort();
  }, [result]);

  const categorias = useMemo(() => {
    if (!result) return [];
    const filtered = filterTipo ? result.matches.filter(m => m.tipo_propuesto === filterTipo) : result.matches;
    return [...new Set(filtered.map(catOf))].filter(Boolean).sort();
  }, [result, filterTipo]);

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  const visible = useMemo(() => {
    if (!result) return [];
    let rows = result.matches;
    if (filterTipo) rows = rows.filter(m => m.tipo_propuesto === filterTipo);
    if (filterBanco) rows = rows.filter(m => m.banco === filterBanco);
    if (filterCat) rows = rows.filter(m => catOf(m) === filterCat);

    return [...rows].sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";
      if (sortCol === "fecha") { va = a.fecha; vb = b.fecha; }
      else if (sortCol === "banco") { va = a.banco; vb = b.banco; }
      else if (sortCol === "descripcion") { va = a.descripcion ?? ""; vb = b.descripcion ?? ""; }
      else if (sortCol === "importe") { va = Math.abs(a.debito ?? a.credito ?? 0); vb = Math.abs(b.debito ?? b.credito ?? 0); }
      else if (sortCol === "tipo") { va = a.tipo_propuesto; vb = b.tipo_propuesto; }
      else if (sortCol === "categoria") { va = catOf(a); vb = catOf(b); }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [result, filterTipo, filterBanco, filterCat, sortCol, sortDir]);

  function toggleAll() {
    if (!result) return;
    const visibleIds = new Set(visible.map(m => m.id));
    const allVisibleSelected = visible.every(m => selected.has(m.id));
    const s = new Set(selected);
    if (allVisibleSelected) visibleIds.forEach(id => s.delete(id));
    else visibleIds.forEach(id => s.add(id));
    setSelected(s);
  }

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return <ChevronsUpDown className="w-3 h-3 inline ml-1 opacity-30" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 inline ml-1" />
      : <ChevronDown className="w-3 h-3 inline ml-1" />;
  }

  const allVisibleSelected = visible.length > 0 && visible.every(m => selected.has(m.id));

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
              {/* Filters */}
              <div className="flex flex-wrap gap-2 mb-3">
                <select
                  value={filterTipo}
                  onChange={e => { setFilterTipo(e.target.value as "" | "negocio" | "personal"); setFilterCat(""); }}
                  className="border rounded-lg px-3 py-1.5 text-sm text-slate-700"
                >
                  <option value="">Todos los tipos</option>
                  <option value="negocio">Negocio</option>
                  <option value="personal">Personal</option>
                </select>

                <select
                  value={filterBanco}
                  onChange={e => setFilterBanco(e.target.value)}
                  className="border rounded-lg px-3 py-1.5 text-sm text-slate-700"
                >
                  <option value="">Todos los bancos</option>
                  {bancos.map(b => <option key={b} value={b}>{b}</option>)}
                </select>

                <select
                  value={filterCat}
                  onChange={e => setFilterCat(e.target.value)}
                  className="border rounded-lg px-3 py-1.5 text-sm text-slate-700 max-w-xs"
                >
                  <option value="">Todas las categorías</option>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                {(filterTipo || filterBanco || filterCat) && (
                  <button
                    onClick={() => { setFilterTipo(""); setFilterBanco(""); setFilterCat(""); }}
                    className="text-xs text-slate-500 underline px-1"
                  >
                    Limpiar filtros
                  </button>
                )}

                <span className="ml-auto text-xs text-slate-400 self-center">
                  {visible.length} de {result.matches.length} filas
                </span>
              </div>

              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-slate-700">Vista previa de cambios</p>
                <div className="flex gap-3">
                  <button onClick={toggleAll} className="text-xs text-brand underline">
                    {allVisibleSelected ? "Deseleccionar visibles" : "Seleccionar visibles"}
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
                        <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} />
                      </th>
                      <th className="text-left px-3 py-3 font-medium text-slate-500 cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort("fecha")}>
                        Fecha <SortIcon col="fecha" />
                      </th>
                      <th className="text-left px-3 py-3 font-medium text-slate-500 cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort("banco")}>
                        Banco <SortIcon col="banco" />
                      </th>
                      <th className="text-left px-3 py-3 font-medium text-slate-500 cursor-pointer select-none" onClick={() => toggleSort("descripcion")}>
                        Descripción <SortIcon col="descripcion" />
                      </th>
                      <th className="text-right px-3 py-3 font-medium text-slate-500 cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort("importe")}>
                        Importe <SortIcon col="importe" />
                      </th>
                      <th className="text-left px-3 py-3 font-medium text-slate-500 cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort("tipo")}>
                        Tipo <SortIcon col="tipo" />
                      </th>
                      <th className="text-left px-3 py-3 font-medium text-slate-500 cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort("categoria")}>
                        Categoría <SortIcon col="categoria" />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visible.map(m => (
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
                        <td className={`px-3 py-2 text-right ${m.debito ? "text-red-600" : "text-green-600"}`}>
                          {m.debito ? `-${formatUYU(m.debito)}` : m.credito ? `+${formatUYU(m.credito)}` : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${m.tipo_propuesto === "negocio" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                            {m.tipo_propuesto}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-600 text-xs">{catOf(m) || "—"}</td>
                      </tr>
                    ))}
                    {visible.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Sin resultados para los filtros aplicados</td></tr>
                    )}
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
