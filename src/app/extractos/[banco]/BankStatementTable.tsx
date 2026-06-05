"use client";
import { useState, useMemo } from "react";
import { AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, Download, X } from "lucide-react";
import { formatUYU } from "@/lib/utils";

export interface Row {
  id: string;
  banco: string;
  cuenta: string | null;
  fecha: string;
  descripcion: string | null;
  debito: number | null;
  credito: number | null;
  saldo: number | null;
  moneda: string;
  ok: boolean;
  diff: number | null;
}

type SortKey = "fecha" | "descripcion" | "debito" | "credito" | "saldo";
type SortDir = "asc" | "desc";

function SortIcon({ col, active, dir }: { col: string; active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 opacity-30 ml-1 inline" />;
  return dir === "asc"
    ? <ArrowUp className="w-3 h-3 ml-1 inline text-brand" />
    : <ArrowDown className="w-3 h-3 ml-1 inline text-brand" />;
}

function toCSV(rows: Row[]): string {
  const headers = ["Fecha", "Descripción", "Débito", "Crédito", "Saldo", "Moneda"];
  const lines = rows.map((r) => [
    r.fecha,
    `"${(r.descripcion ?? "").replace(/"/g, '""')}"`,
    r.debito ?? "",
    r.credito ?? "",
    r.saldo ?? "",
    r.moneda,
  ].join(","));
  return [headers.join(","), ...lines].join("\n");
}

export default function BankStatementTable({ rows }: { rows: Row[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("fecha");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filters, setFilters] = useState({
    fecha: "",
    descripcion: "",
    debito: "",
    credito: "",
    saldo: "",
    moneda: "",
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filters.fecha && !r.fecha.includes(filters.fecha)) return false;
      if (filters.descripcion && !(r.descripcion ?? "").toLowerCase().includes(filters.descripcion.toLowerCase())) return false;
      if (filters.debito && !(r.debito?.toString() ?? "").includes(filters.debito)) return false;
      if (filters.credito && !(r.credito?.toString() ?? "").includes(filters.credito)) return false;
      if (filters.saldo && !(r.saldo?.toString() ?? "").includes(filters.saldo)) return false;
      if (filters.moneda && r.moneda !== filters.moneda) return false;
      return true;
    });
  }, [rows, filters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: string | number | null = a[sortKey];
      let vb: string | number | null = b[sortKey];
      if (va === null) va = sortDir === "asc" ? Infinity : -Infinity;
      if (vb === null) vb = sortDir === "asc" ? Infinity : -Infinity;
      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [filtered, sortKey, sortDir]);

  function downloadCSV() {
    const csv = toCSV(sorted);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extracto-${sorted[0]?.banco ?? "banco"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasFilters = Object.values(filters).some(Boolean);
  const monedas = [...new Set(rows.map((r) => r.moneda))].sort();

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">
          {sorted.length} de {rows.length} movimientos
          {hasFilters && <button onClick={() => setFilters({ fecha: "", descripcion: "", debito: "", credito: "", saldo: "", moneda: "" })} className="ml-2 text-brand underline text-xs">Limpiar filtros</button>}
        </p>
        <button
          onClick={downloadCSV}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
              {(["fecha", "descripcion", "debito", "credito", "saldo"] as SortKey[]).map((col) => {
                const labels: Record<SortKey, string> = { fecha: "Fecha", descripcion: "Descripción", debito: "Débito", credito: "Crédito", saldo: "Saldo" };
                const isRight = col !== "fecha" && col !== "descripcion";
                return (
                  <th key={col} className={`px-4 py-3 font-medium ${isRight ? "text-right" : ""}`}>
                    <button
                      onClick={() => toggleSort(col)}
                      className="hover:text-gray-800 transition-colors"
                    >
                      {labels[col]}
                      <SortIcon col={col} active={sortKey === col} dir={sortDir} />
                    </button>
                  </th>
                );
              })}
              {monedas.length > 1 && <th className="px-4 py-3 font-medium">Moneda</th>}
              <th className="px-4 py-3 w-8"></th>
            </tr>
            {/* Filter row */}
            <tr className="border-b bg-white">
              <td className="px-3 py-1.5">
                <input
                  placeholder="Filtrar…"
                  value={filters.fecha}
                  onChange={(e) => setFilters((f) => ({ ...f, fecha: e.target.value }))}
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand"
                />
              </td>
              <td className="px-3 py-1.5">
                <input
                  placeholder="Filtrar…"
                  value={filters.descripcion}
                  onChange={(e) => setFilters((f) => ({ ...f, descripcion: e.target.value }))}
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand"
                />
              </td>
              {(["debito", "credito", "saldo"] as const).map((col) => (
                <td key={col} className="px-3 py-1.5">
                  <input
                    placeholder="Filtrar…"
                    value={filters[col]}
                    onChange={(e) => setFilters((f) => ({ ...f, [col]: e.target.value }))}
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand text-right"
                  />
                </td>
              ))}
              {monedas.length > 1 && (
                <td className="px-3 py-1.5">
                  <select
                    value={filters.moneda}
                    onChange={(e) => setFilters((f) => ({ ...f, moneda: e.target.value }))}
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand"
                  >
                    <option value="">Todas</option>
                    {monedas.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </td>
              )}
              <td></td>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                  Sin resultados para los filtros aplicados
                </td>
              </tr>
            ) : sorted.map((row, i) => (
              <tr key={row.id ?? i} className={row.ok ? "hover:bg-gray-50" : "bg-orange-50 hover:bg-orange-100"}>
                <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap tabular-nums">{row.fecha}</td>
                <td className="px-4 py-2.5 text-gray-800 max-w-xs truncate">{row.descripcion ?? "—"}</td>
                <td className="px-4 py-2.5 text-right text-red-600 tabular-nums">
                  {row.debito != null ? formatUYU(row.debito) : ""}
                </td>
                <td className="px-4 py-2.5 text-right text-green-600 tabular-nums">
                  {row.credito != null ? formatUYU(row.credito) : ""}
                </td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                  {row.saldo != null ? formatUYU(row.saldo) : "—"}
                </td>
                {monedas.length > 1 && <td className="px-4 py-2.5 text-xs text-gray-400">{row.moneda}</td>}
                <td className="px-4 py-2.5 text-center">
                  {!row.ok && (
                    <span title={`Diferencia: ${row.diff?.toFixed(2)}`}>
                      <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
