"use client";
import { useState, useEffect, useMemo } from "react";
import { formatUYU, formatDate } from "@/lib/utils";
import Link from "next/link";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

interface BSRow {
  id: string;
  banco: string;
  fecha: string;
  descripcion: string | null;
  debito: number | null;
  credito: number | null;
  importe_uyu: number | null;
  moneda: string;
}

function rowImporteUYU(r: BSRow): number {
  if (r.moneda === "USD") return Math.abs(r.importe_uyu ?? 0);
  return (r.debito ?? 0) + (r.credito ?? 0);
}

function rowImporteOriginal(r: BSRow): { monto: number; moneda: string; esIngreso: boolean } {
  const esIngreso = (r.credito ?? 0) > 0;
  const monto = esIngreso ? (r.credito ?? 0) : (r.debito ?? 0);
  return { monto, moneda: r.moneda, esIngreso };
}

type SortKey = "fecha" | "banco" | "descripcion" | "monto";

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 opacity-30 ml-1 inline" />;
  return dir === "asc"
    ? <ArrowUp className="w-3 h-3 ml-1 inline text-brand" />
    : <ArrowDown className="w-3 h-3 ml-1 inline text-brand" />;
}

export default function SinConciliarPage() {
  const [rows, setRows] = useState<BSRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [sortKey, setSortKey] = useState<SortKey>("fecha");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterBanco, setFilterBanco] = useState("");
  const [filterDesc, setFilterDesc] = useState("");
  const [filterMoneda, setFilterMoneda] = useState("");

  useEffect(() => {
    fetch("/api/admin/sin-clasificar")
      .then(r => r.json())
      .then(d => { setRows(d.rows ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }, []);

  const bancos = useMemo(() => [...new Set(rows.map(r => r.banco))].sort(), [rows]);
  const monedas = useMemo(() => [...new Set(rows.map(r => r.moneda))].sort(), [rows]);

  const filtered = useMemo(() => rows.filter(r => {
    if (filterBanco && r.banco !== filterBanco) return false;
    if (filterMoneda && r.moneda !== filterMoneda) return false;
    if (filterDesc && !(r.descripcion ?? "").toLowerCase().includes(filterDesc.toLowerCase())) return false;
    return true;
  }), [rows, filterBanco, filterMoneda, filterDesc]);

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

  const hasFilters = filterBanco || filterDesc || filterMoneda;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Sin clasificar</h1>
          <p className="text-sm text-slate-500 mt-1">
            {loading ? "Cargando…" : `${sorted.length} de ${total} movimientos`}
            {hasFilters && (
              <button
                onClick={() => { setFilterBanco(""); setFilterDesc(""); setFilterMoneda(""); }}
                className="ml-2 text-brand underline text-xs"
              >
                Limpiar filtros
              </button>
            )}
          </p>
        </div>
        <Link href="/extractos" className="text-xs text-brand underline">
          Ir a extractos para clasificar →
        </Link>
      </div>

      {!loading && rows.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-2xl mb-2">✓</p>
          <p className="text-base font-medium text-slate-600">Todo clasificado</p>
          <p className="text-sm mt-1">No hay movimientos pendientes de clasificar</p>
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
                    Importe UYU <SortIcon active={sortKey === "monto"} dir={sortDir} />
                  </button>
                </th>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map(r => {
                const { monto, moneda, esIngreso } = rowImporteOriginal(r);
                const importeUYU = rowImporteUYU(r);
                const esUSD = moneda === "USD";
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(r.fecha)}</td>
                    <td className="px-4 py-3 font-medium">{r.banco}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{r.descripcion ?? "—"}</td>
                    <td className={`px-4 py-3 text-right font-medium whitespace-nowrap ${esIngreso ? "text-green-600" : "text-red-600"}`}>
                      {esIngreso ? "+" : "-"}
                      {esUSD ? `U$ ${monto.toFixed(2)}` : formatUYU(monto)}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium whitespace-nowrap ${esIngreso ? "text-green-600" : "text-red-600"}`}>
                      {esUSD ? (
                        <>{esIngreso ? "+" : "-"}{formatUYU(importeUYU)}</>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
              {!loading && sorted.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
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
