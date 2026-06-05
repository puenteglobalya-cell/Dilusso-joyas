"use client";
import { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react";
import { formatUYU } from "@/lib/utils";

export interface Row {
  id: string;
  banco: string;
  cuenta: string | null;
  fecha: string;
  descripcion: string | null;
  debito: number | null;
  credito: number | null;
  saldo: number | null;       // from PDF (reference only)
  moneda: string;
  ok: boolean;
  diff: null;
  computedSaldo: number | null; // calculated running balance
}

type SortKey = "fecha" | "descripcion" | "debito" | "credito" | "computedSaldo";

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 opacity-30 ml-1 inline" />;
  return dir === "asc"
    ? <ArrowUp className="w-3 h-3 ml-1 inline text-brand" />
    : <ArrowDown className="w-3 h-3 ml-1 inline text-brand" />;
}

function toCSV(rows: Row[]): string {
  const headers = ["Fecha", "Descripción", "Débito", "Crédito", "Saldo calculado", "Moneda"];
  const lines = rows.map((r) => [
    r.fecha,
    `"${(r.descripcion ?? "").replace(/"/g, '""')}"`,
    r.debito ?? "",
    r.credito ?? "",
    r.computedSaldo?.toFixed(2) ?? "",
    r.moneda,
  ].join(","));
  return [headers.join(","), ...lines].join("\n");
}

export default function BankStatementTable({ rows }: { rows: Row[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("fecha");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filters, setFilters] = useState({ fecha: "", descripcion: "", debito: "", credito: "", moneda: "" });

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

  const cols: { key: SortKey; label: string; right: boolean }[] = [
    { key: "fecha", label: "Fecha", right: false },
    { key: "descripcion", label: "Descripción", right: false },
    { key: "debito", label: "Débito", right: true },
    { key: "credito", label: "Crédito", right: true },
    { key: "computedSaldo", label: "Saldo", right: true },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">
          {sorted.length} de {rows.length} movimientos
          {hasFilters && (
            <button
              onClick={() => setFilters({ fecha: "", descripcion: "", debito: "", credito: "", moneda: "" })}
              className="ml-2 text-brand underline text-xs"
            >
              Limpiar filtros
            </button>
          )}
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
              {cols.map(({ key, label, right }) => (
                <th key={key} className={`px-4 py-3 font-medium ${right ? "text-right" : ""}`}>
                  <button onClick={() => toggleSort(key)} className="hover:text-gray-800 transition-colors">
                    {label}
                    <SortIcon active={sortKey === key} dir={sortDir} />
                  </button>
                </th>
              ))}
              {monedas.length > 1 && <th className="px-4 py-3 font-medium">Moneda</th>}
            </tr>
            <tr className="border-b bg-white">
              {(["fecha", "descripcion", "debito", "credito"] as const).map((col, idx) => (
                <td key={col} className="px-3 py-1.5">
                  <input
                    placeholder="Filtrar…"
                    value={filters[col]}
                    onChange={(e) => setFilters((f) => ({ ...f, [col]: e.target.value }))}
                    className={`w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand ${idx >= 2 ? "text-right" : ""}`}
                  />
                </td>
              ))}
              <td className="px-3 py-1.5" /> {/* saldo — no filter */}
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
              <tr
                key={row.id ?? i}
                className={row.descripcion === "Saldo anterior" ? "bg-gray-50 font-medium" : "hover:bg-gray-50"}
              >
                <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap tabular-nums">{row.fecha}</td>
                <td className="px-4 py-2.5 text-gray-800 max-w-xs truncate">{row.descripcion ?? "—"}</td>
                <td className="px-4 py-2.5 text-right text-red-600 tabular-nums">
                  {row.debito != null ? formatUYU(row.debito) : ""}
                </td>
                <td className="px-4 py-2.5 text-right text-green-600 tabular-nums">
                  {row.credito != null ? formatUYU(row.credito) : ""}
                </td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                  {row.computedSaldo != null ? formatUYU(row.computedSaldo) : "—"}
                </td>
                {monedas.length > 1 && <td className="px-4 py-2.5 text-xs text-gray-400">{row.moneda}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
