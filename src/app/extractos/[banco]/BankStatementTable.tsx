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
  numero: string | null;
  debito: number | null;
  credito: number | null;
  saldo: number | null;
  moneda: string;
  clasificado: string | null;
  tipo: string | null;
  categoria_negocio: string | null;
  categoria_personal: string | null;
  tc: number | null;
  importe_uyu: number | null;
  ok: boolean;
  diff: null;
  computedSaldo: number | null;
}

type SortKey = "fecha" | "descripcion" | "debito" | "credito" | "computedSaldo" | "tipo" | "categoria_negocio" | "categoria_personal";

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 opacity-30 ml-1 inline" />;
  return dir === "asc"
    ? <ArrowUp className="w-3 h-3 ml-1 inline text-brand" />
    : <ArrowDown className="w-3 h-3 ml-1 inline text-brand" />;
}

function toCSV(rows: Row[]): string {
  const hasNum = rows.some((r) => r.numero);
  const hasUsd = rows.some((r) => r.moneda === "USD");
  const headers = [
    "Fecha", "Descripción",
    ...(hasNum ? ["N° cheque"] : []),
    "Débito", "Crédito", "Saldo calculado", "Moneda",
    ...(hasUsd ? ["TC", "Importe UYU"] : []),
    "Clasificado", "Tipo", "Cat. Negocio", "Cat. Personal",
  ];
  const lines = rows.map((r) => [
    r.fecha,
    `"${(r.descripcion ?? "").replace(/"/g, '""')}"`,
    ...(hasNum ? [r.numero ?? ""] : []),
    r.debito ?? "",
    r.credito ?? "",
    r.computedSaldo?.toFixed(2) ?? "",
    r.moneda,
    ...(hasUsd ? [r.tc ?? "", r.importe_uyu?.toFixed(2) ?? ""] : []),
    r.clasificado ?? "",
    r.tipo ?? "",
    r.categoria_negocio ?? "",
    r.categoria_personal ?? "",
  ].join(","));
  return [headers.join(","), ...lines].join("\n");
}

const TIPO_BADGE: Record<string, string> = {
  negocio: "bg-blue-100 text-blue-700",
  personal: "bg-purple-100 text-purple-700",
};

export default function BankStatementTable({ rows }: { rows: Row[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("fecha");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filters, setFilters] = useState({
    fecha: "", descripcion: "", moneda: "", tipo: "", categoria: "", clasificado: "",
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filters.fecha && !r.fecha.includes(filters.fecha)) return false;
      if (filters.descripcion && !(r.descripcion ?? "").toLowerCase().includes(filters.descripcion.toLowerCase())) return false;
      if (filters.moneda && r.moneda !== filters.moneda) return false;
      if (filters.tipo && (r.tipo ?? "") !== filters.tipo) return false;
      if (filters.categoria) {
        const cat = ((r.categoria_negocio ?? "") + " " + (r.categoria_personal ?? "")).toLowerCase();
        if (!cat.includes(filters.categoria.toLowerCase())) return false;
      }
      if (filters.clasificado && (r.clasificado ?? "") !== filters.clasificado) return false;
      return true;
    });
  }, [rows, filters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = a[sortKey] ?? (sortDir === "asc" ? "￿" : "");
      const vb = b[sortKey] ?? (sortDir === "asc" ? "￿" : "");
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
  const hasNumero = rows.some((r) => r.numero);
  const hasUsd = rows.some((r) => r.moneda === "USD");
  const tipos = [...new Set(rows.map((r) => r.tipo ?? "").filter(Boolean))].sort();

  const Th = ({ k, label, right = false }: { k: SortKey; label: string; right?: boolean }) => (
    <th className={`px-4 py-3 font-medium ${right ? "text-right" : ""}`}>
      <button onClick={() => toggleSort(k)} className="hover:text-gray-800 transition-colors whitespace-nowrap">
        {label}
        <SortIcon active={sortKey === k} dir={sortDir} />
      </button>
    </th>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">
          {sorted.length} de {rows.length} movimientos
          {hasFilters && (
            <button
              onClick={() => setFilters({ fecha: "", descripcion: "", moneda: "", tipo: "", categoria: "", clasificado: "" })}
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

      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
              <Th k="fecha" label="Fecha" />
              <Th k="descripcion" label="Descripción" />
              {hasNumero && <th className="px-4 py-3 font-medium text-right">N° cheque</th>}
              <Th k="debito" label="Débito" right />
              <Th k="credito" label="Crédito" right />
              <Th k="computedSaldo" label="Saldo" right />
              {monedas.length > 1 && <th className="px-4 py-3 font-medium">Mon.</th>}
              {hasUsd && <th className="px-4 py-3 font-medium text-right">Imp. UYU</th>}
              <Th k="tipo" label="Tipo" />
              <Th k="categoria_negocio" label="Cat. Negocio" />
              <Th k="categoria_personal" label="Cat. Personal" />
            </tr>
            {/* Filter row */}
            <tr className="border-b bg-white text-xs">
              <td className="px-3 py-1.5">
                <input placeholder="Fecha…" value={filters.fecha}
                  onChange={(e) => setFilters((f) => ({ ...f, fecha: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand" />
              </td>
              <td className="px-3 py-1.5">
                <input placeholder="Descripción…" value={filters.descripcion}
                  onChange={(e) => setFilters((f) => ({ ...f, descripcion: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand" />
              </td>
              {hasNumero && <td className="px-3 py-1.5" />}
              <td className="px-3 py-1.5" />
              <td className="px-3 py-1.5" />
              <td className="px-3 py-1.5" />
              {monedas.length > 1 && (
                <td className="px-3 py-1.5">
                  <select value={filters.moneda}
                    onChange={(e) => setFilters((f) => ({ ...f, moneda: e.target.value }))}
                    className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand">
                    <option value="">Todas</option>
                    {monedas.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </td>
              )}
              {hasUsd && <td className="px-3 py-1.5" />}
              <td className="px-3 py-1.5">
                <select value={filters.tipo}
                  onChange={(e) => setFilters((f) => ({ ...f, tipo: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand">
                  <option value="">Todos</option>
                  {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
                  <option value="">Sin tipo</option>
                </select>
              </td>
              <td className="px-3 py-1.5">
                <input placeholder="Categoría…" value={filters.categoria}
                  onChange={(e) => setFilters((f) => ({ ...f, categoria: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand" />
              </td>
              <td className="px-3 py-1.5">
                <select value={filters.clasificado}
                  onChange={(e) => setFilters((f) => ({ ...f, clasificado: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand">
                  <option value="">Todos</option>
                  <option value="Si">Clasificado</option>
                  <option value="No">Sin clasificar</option>
                </select>
              </td>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-sm text-gray-400">
                  Sin resultados para los filtros aplicados
                </td>
              </tr>
            ) : sorted.map((row, i) => {
              const isSaldoAnterior = row.descripcion === "Saldo anterior";
              return (
                <tr
                  key={row.id ?? i}
                  className={isSaldoAnterior ? "bg-gray-50 font-medium" : "hover:bg-gray-50"}
                >
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap tabular-nums text-xs">{row.fecha}</td>
                  <td className="px-4 py-2 text-gray-800 max-w-[220px] truncate" title={row.descripcion ?? ""}>
                    {row.descripcion ?? "—"}
                  </td>
                  {hasNumero && (
                    <td className="px-4 py-2 text-right tabular-nums text-gray-400 text-xs">{row.numero ?? ""}</td>
                  )}
                  <td className="px-4 py-2 text-right text-red-600 tabular-nums">
                    {row.debito != null ? formatUYU(row.debito) : ""}
                  </td>
                  <td className="px-4 py-2 text-right text-green-600 tabular-nums">
                    {row.credito != null ? formatUYU(row.credito) : ""}
                  </td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">
                    {row.computedSaldo != null ? formatUYU(row.computedSaldo) : "—"}
                  </td>
                  {monedas.length > 1 && (
                    <td className="px-4 py-2 text-xs text-gray-400">{row.moneda}</td>
                  )}
                  {hasUsd && (
                    <td className="px-4 py-2 text-right tabular-nums text-xs text-gray-500">
                      {row.importe_uyu != null ? formatUYU(Math.abs(row.importe_uyu)) : ""}
                    </td>
                  )}
                  <td className="px-4 py-2">
                    {row.tipo ? (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TIPO_BADGE[row.tipo] ?? "bg-gray-100 text-gray-600"}`}>
                        {row.tipo}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500 max-w-[140px] truncate" title={row.categoria_negocio ?? ""}>
                    {row.categoria_negocio || ""}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500 max-w-[140px] truncate" title={row.categoria_personal ?? ""}>
                    {row.categoria_personal || (row.clasificado === "No" ? <span className="text-orange-400">Sin clasificar</span> : "")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
