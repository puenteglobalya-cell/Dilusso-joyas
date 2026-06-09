"use client";
import { useState, useEffect, useMemo } from "react";
import { formatUYU, formatDate } from "@/lib/utils";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { ClassifyPopover } from "@/components/bank/ClassifyPopover";

interface BSRow {
  id: string;
  banco: string;
  fecha: string;
  descripcion: string | null;
  debito: number | null;
  credito: number | null;
  importe_uyu: number | null;
  moneda: string;
  tipo: string | null;
  categoria_negocio: string | null;
  categoria_personal: string | null;
  clasificado: string | null;
}

function rowImporteUYU(r: BSRow): number {
  if (r.moneda === "USD") return Math.abs(r.importe_uyu ?? 0);
  return (r.debito ?? 0) + (r.credito ?? 0);
}

type SortKey = "fecha" | "banco" | "descripcion" | "monto";

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 opacity-30 ml-1 inline" />;
  return dir === "asc"
    ? <ArrowUp className="w-3 h-3 ml-1 inline text-brand" />
    : <ArrowDown className="w-3 h-3 ml-1 inline text-brand" />;
}

interface EditState { row: BSRow; anchor: { top: number; left: number } }

export default function SinConciliarPage() {
  const [rows, setRows] = useState<BSRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [catsNegocio, setCatsNegocio] = useState<string[]>([]);
  const [catsPersonal, setCatsPersonal] = useState<string[]>([]);
  const [editState, setEditState] = useState<EditState | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("fecha");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterBanco, setFilterBanco] = useState("");
  const [filterDesc, setFilterDesc] = useState("");
  const [filterMoneda, setFilterMoneda] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterCat, setFilterCat] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/sin-clasificar").then(r => r.json()),
      fetch("/api/admin/categorias-list").then(r => r.json()),
    ]).then(([d, cats]) => {
      setRows(d.rows ?? []);
      setCatsNegocio(cats.negocio ?? []);
      setCatsPersonal(cats.personal ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const bancos = useMemo(() => [...new Set(rows.map(r => r.banco))].sort(), [rows]);
  const monedas = useMemo(() => [...new Set(rows.map(r => r.moneda))].sort(), [rows]);

  // Category options depend on tipo filter
  const catOptions = useMemo(() => {
    if (filterTipo === "negocio") return catsNegocio;
    if (filterTipo === "personal") return catsPersonal;
    return [];
  }, [filterTipo, catsNegocio, catsPersonal]);

  const filtered = useMemo(() => rows.filter(r => {
    if (r.clasificado === "Si") return false;
    if (filterBanco && r.banco !== filterBanco) return false;
    if (filterMoneda && r.moneda !== filterMoneda) return false;
    if (filterDesc && !(r.descripcion ?? "").toLowerCase().includes(filterDesc.toLowerCase())) return false;
    if (filterTipo && (r.tipo ?? "") !== filterTipo) return false;
    if (filterCat) {
      const cat = filterTipo === "negocio" ? (r.categoria_negocio ?? "") : (r.categoria_personal ?? "");
      if (!cat.toLowerCase().includes(filterCat.toLowerCase())) return false;
    }
    return true;
  }), [rows, filterBanco, filterMoneda, filterDesc, filterTipo, filterCat]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "fecha") cmp = a.fecha.localeCompare(b.fecha);
    else if (sortKey === "banco") cmp = a.banco.localeCompare(b.banco);
    else if (sortKey === "descripcion") cmp = (a.descripcion ?? "").localeCompare(b.descripcion ?? "");
    else if (sortKey === "monto") cmp = rowImporteUYU(a) - rowImporteUYU(b);
    return sortDir === "asc" ? cmp : -cmp;
  }), [filtered, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  }

  function openEdit(row: BSRow, e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setEditState({ row, anchor: { top: rect.bottom + 4, left: rect.left } });
  }

  function handleSaved(id: string, updated: Partial<BSRow & { clasificado: string }>) {
    // Remove from list once classified
    if (updated.clasificado === "Si") {
      setRows(prev => prev.filter(r => r.id !== id));
    } else {
      setRows(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r));
    }
  }

  const hasFilters = filterBanco || filterDesc || filterMoneda || filterTipo || filterCat;
  const total = rows.filter(r => r.clasificado !== "Si").length;

  return (
    <div className="p-8">
      {editState && (
        <ClassifyPopover
          row={editState.row}
          anchor={editState.anchor}
          catsNegocio={catsNegocio}
          catsPersonal={catsPersonal}
          onCategoryCreated={(name, type) => {
            if (type === "negocio") setCatsNegocio(p => [...new Set([...p, name])].sort());
            else setCatsPersonal(p => [...new Set([...p, name])].sort());
          }}
          onClose={() => setEditState(null)}
          onSaved={(updated) => { handleSaved(editState.row.id, updated); }}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Sin clasificar</h1>
          <p className="text-sm text-slate-500 mt-1">
            {loading ? "Cargando…" : `${sorted.length} de ${total} movimientos`}
            {hasFilters && (
              <button onClick={() => { setFilterBanco(""); setFilterDesc(""); setFilterMoneda(""); setFilterTipo(""); setFilterCat(""); }}
                className="ml-2 text-brand underline text-xs">
                Limpiar filtros
              </button>
            )}
          </p>
        </div>
      </div>

      {!loading && total === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-2xl mb-2">✓</p>
          <p className="text-base font-medium text-slate-600">Todo clasificado</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">
                  <button onClick={() => toggleSort("fecha")} className="hover:text-gray-800 whitespace-nowrap">
                    Fecha <SortIcon active={sortKey === "fecha"} dir={sortDir} />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">
                  <button onClick={() => toggleSort("banco")} className="hover:text-gray-800 whitespace-nowrap">
                    Banco <SortIcon active={sortKey === "banco"} dir={sortDir} />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">
                  <button onClick={() => toggleSort("descripcion")} className="hover:text-gray-800 whitespace-nowrap">
                    Descripción <SortIcon active={sortKey === "descripcion"} dir={sortDir} />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium text-right whitespace-nowrap">Importe original</th>
                <th className="px-4 py-3 font-medium text-right whitespace-nowrap">
                  <button onClick={() => toggleSort("monto")} className="hover:text-gray-800">
                    Imp. UYU <SortIcon active={sortKey === "monto"} dir={sortDir} />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Categoría</th>
              </tr>
              {/* Filter row */}
              <tr className="border-b bg-white text-xs">
                <td className="px-3 py-1.5" />
                <td className="px-3 py-1.5">
                  <select value={filterBanco} onChange={e => setFilterBanco(e.target.value)}
                    className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand">
                    <option value="">Todos</option>
                    {bancos.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  <input placeholder="Buscar…" value={filterDesc} onChange={e => setFilterDesc(e.target.value)}
                    className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand" />
                </td>
                <td className="px-3 py-1.5">
                  <select value={filterMoneda} onChange={e => setFilterMoneda(e.target.value)}
                    className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand">
                    <option value="">Todas</option>
                    {monedas.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </td>
                <td className="px-3 py-1.5" />
                <td className="px-3 py-1.5">
                  <select value={filterTipo} onChange={e => { setFilterTipo(e.target.value); setFilterCat(""); }}
                    className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand">
                    <option value="">Todos</option>
                    <option value="negocio">Negocio</option>
                    <option value="personal">Personal</option>
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  {catOptions.length > 0 ? (
                    <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                      className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand">
                      <option value="">Todas</option>
                      {catOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <span className="text-gray-300 text-xs px-2">— elegí tipo —</span>
                  )}
                </td>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map(r => {
                const esIngreso = (r.credito ?? 0) > 0;
                const montoOrig = esIngreso ? (r.credito ?? 0) : (r.debito ?? 0);
                const importeUYU = rowImporteUYU(r);
                const esUSD = r.moneda === "USD";
                const cat = r.tipo === "negocio" ? r.categoria_negocio : r.categoria_personal;
                return (
                  <tr key={r.id} className="hover:bg-blue-50 cursor-pointer" onClick={e => openEdit(r, e)}>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(r.fecha)}</td>
                    <td className="px-4 py-3 font-medium">{r.banco}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{r.descripcion ?? "—"}</td>
                    <td className={`px-4 py-3 text-right font-medium whitespace-nowrap ${esIngreso ? "text-green-600" : "text-red-600"}`}>
                      {esIngreso ? "+" : "-"}
                      {esUSD ? `U$ ${montoOrig.toFixed(2)}` : formatUYU(montoOrig)}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium whitespace-nowrap ${esIngreso ? "text-green-600" : "text-red-600"}`}>
                      {esUSD ? <>{esIngreso ? "+" : "-"}{formatUYU(importeUYU)}</> : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.tipo ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.tipo === "negocio" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                          {r.tipo}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{cat ?? "—"}</td>
                  </tr>
                );
              })}
              {!loading && sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                    Sin resultados para los filtros aplicados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
