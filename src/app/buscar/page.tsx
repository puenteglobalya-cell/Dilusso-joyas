"use client";
import { useState, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useDebounce } from "@/lib/use-debounce";

interface BSRow {
  id: string; banco: string; fecha: string; descripcion: string | null;
  debito: number | null; credito: number | null; moneda: string;
  tipo: string | null; categoria_negocio: string | null; categoria_personal: string | null;
  clasificado: string | null;
}

const BANCOS = ["BBVA", "Itaú", "OCA", "Scotiabank", "Itau-Card"];

export default function BuscarPage() {
  const [q, setQ] = useState("");
  const [banco, setBanco] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [tipo, setTipo] = useState("");
  const [rows, setRows] = useState<BSRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const debouncedQ = useDebounce(q, 350);

  const doSearch = useCallback(async (query: string) => {
    if (query.length < 2) { setRows([]); setSearched(false); return; }
    setLoading(true);
    const params = new URLSearchParams({ q: query });
    if (banco) params.set("banco", banco);
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    if (tipo) params.set("tipo", tipo);
    try {
      const res = await fetch(`/api/buscar?${params}`);
      const data = await res.json();
      setRows(data.rows ?? []);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, [banco, desde, hasta, tipo]);

  useEffect(() => { doSearch(debouncedQ); }, [debouncedQ, doSearch]);

  const fmtAmt = (r: BSRow) => {
    const esIngreso = (r.credito ?? 0) > 0;
    const amt = esIngreso ? (r.credito ?? 0) : (r.debito ?? 0);
    const prefix = esIngreso ? "+" : "-";
    const fmt = r.moneda === "USD" ? `U$ ${amt.toFixed(2)}` : `$ ${amt.toLocaleString("es-UY", { minimumFractionDigits: 0 })}`;
    return { label: `${prefix}${fmt}`, esIngreso };
  };

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold mb-1">Buscar movimientos</h1>
      <p className="text-sm text-muted mb-6">Búsqueda por descripción en todos los bancos.</p>

      {/* Search bar + filters */}
      <div className="bg-white rounded-xl border p-4 space-y-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-subtle" />
          <input
            autoFocus
            type="text"
            placeholder="Escribí parte de la descripción…"
            value={q}
            onChange={e => setQ(e.target.value)}
            className="w-full h-9 pl-9 pr-8 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand"
          />
          {q && (
            <button onClick={() => { setQ(""); setRows([]); setSearched(false); }} className="absolute right-2.5 top-2.5 text-subtle hover:text-ink">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={banco} onChange={e => setBanco(e.target.value)}
            className="h-8 pl-3 pr-7 border border-gray-200 rounded-lg text-xs bg-white appearance-none">
            <option value="">Todos los bancos</option>
            {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={tipo} onChange={e => setTipo(e.target.value)}
            className="h-8 pl-3 pr-7 border border-gray-200 rounded-lg text-xs bg-white appearance-none">
            <option value="">Todo tipo</option>
            <option value="negocio">Negocio</option>
            <option value="personal">Personal</option>
          </select>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            className="h-8 px-2 border border-gray-200 rounded-lg text-xs" placeholder="Desde" />
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            className="h-8 px-2 border border-gray-200 rounded-lg text-xs" placeholder="Hasta" />
        </div>
      </div>

      {/* Results */}
      {loading && <p className="text-sm text-subtle">Buscando…</p>}
      {!loading && searched && rows.length === 0 && (
        <p className="text-sm text-subtle">Sin resultados para <span className="font-medium">&quot;{q}&quot;</span>.</p>
      )}
      {!loading && rows.length > 0 && (
        <>
          <p className="text-xs text-subtle mb-2">{rows.length} resultado{rows.length !== 1 ? "s" : ""}{rows.length === 200 ? " (máx. 200)" : ""}</p>
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface border-b text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Fecha</th>
                  <th className="px-4 py-2 text-left font-medium">Banco</th>
                  <th className="px-4 py-2 text-left font-medium">Descripción</th>
                  <th className="px-4 py-2 text-right font-medium">Importe</th>
                  <th className="px-4 py-2 text-left font-medium">Tipo</th>
                  <th className="px-4 py-2 text-left font-medium">Categoría</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(r => {
                  const { label, esIngreso } = fmtAmt(r);
                  const cat = r.tipo === "negocio" ? r.categoria_negocio : r.categoria_personal;
                  return (
                    <tr key={r.id} className="hover:bg-surface">
                      <td className="px-4 py-2.5 text-muted whitespace-nowrap">{formatDate(r.fecha)}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-700">{r.banco}</td>
                      <td className="px-4 py-2.5 max-w-xs">
                        <span className="text-ink">
                          {q ? highlightMatch(r.descripcion ?? "", q) : (r.descripcion ?? "—")}
                        </span>
                      </td>
                      <td className={`px-4 py-2.5 text-right font-medium whitespace-nowrap ${esIngreso ? "text-olive" : "text-terracotta"}`}>
                        {label}
                      </td>
                      <td className="px-4 py-2.5">
                        {r.tipo ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.tipo === "negocio" ? "bg-brand-light text-brand-dark" : "bg-bronze/10 text-bronze"}`}>
                            {r.tipo}
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-muted text-xs">{cat ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function highlightMatch(text: string, query: string) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}
