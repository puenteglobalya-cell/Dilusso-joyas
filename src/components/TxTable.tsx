"use client";
import { formatUYU, formatDate } from "@/lib/utils";

export interface TxRow {
  id: string;
  banco: string;
  fecha: string;
  descripcion: string | null;
  debito: number | null;
  credito: number | null;
  importe_uyu: number | null;
  moneda: string;
  categoria: string | null;
  nota: string | null;
}

const BANCO_COLORS: Record<string, string> = {
  BBVA:       "bg-blue-100 text-blue-700",
  "Itaú":     "bg-orange-100 text-orange-700",
  Scotiabank: "bg-emerald-100 text-emerald-700",
  OCA:        "bg-purple-100 text-purple-700",
  "Itau-Card":"bg-amber-100 text-amber-700",
};

function bancoBadge(banco: string) {
  const cls = BANCO_COLORS[banco] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-md whitespace-nowrap ${cls}`}>
      {banco}
    </span>
  );
}

function importeUYU(r: TxRow) {
  if (r.moneda === "USD") return Math.abs(r.importe_uyu ?? 0);
  return (r.debito ?? 0) + (r.credito ?? 0);
}

interface Props {
  rows: TxRow[];
  emptyMessage?: string;
  emptyLink?: { href: string; label: string };
}

export function TxTable({ rows, emptyMessage, emptyLink }: Props) {
  if (!rows.length) {
    return (
      <div className="bg-white rounded-xl border p-12 text-center">
        <p className="text-slate-400 text-sm mb-2">{emptyMessage ?? "Sin movimientos para este período"}</p>
        {emptyLink && (
          <a href={emptyLink.href} className="text-xs text-brand underline">{emptyLink.label}</a>
        )}
      </div>
    );
  }

  // Group by date
  const groups = new Map<string, TxRow[]>();
  for (const r of rows) {
    if (!groups.has(r.fecha)) groups.set(r.fecha, []);
    groups.get(r.fecha)!.push(r);
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      {/* Sticky header */}
      <div className="grid grid-cols-[1fr_3fr_1.5fr_auto] gap-0 bg-slate-50 border-b px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide sticky top-0">
        <span>Banco</span>
        <span>Descripción</span>
        <span>Categoría</span>
        <span className="text-right pr-1">Importe</span>
      </div>

      {Array.from(groups.entries()).map(([fecha, dayRows]) => {
        const dayEgresos = dayRows.filter(r => (r.debito ?? 0) > 0).reduce((s, r) => s + importeUYU(r), 0);
        const dayIngresos = dayRows.filter(r => (r.credito ?? 0) > 0).reduce((s, r) => s + importeUYU(r), 0);

        return (
          <div key={fecha}>
            {/* Date separator */}
            <div className="flex items-center justify-between px-4 py-1.5 bg-slate-50/70 border-b border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-500">{formatDate(fecha)}</span>
              <div className="flex gap-3 text-[11px]">
                {dayIngresos > 0 && <span className="text-green-600 font-medium">+{formatUYU(dayIngresos)}</span>}
                {dayEgresos > 0 && <span className="text-red-500 font-medium">-{formatUYU(dayEgresos)}</span>}
              </div>
            </div>

            {dayRows.map(r => {
              const esIngreso = (r.credito ?? 0) > 0;
              const amt = importeUYU(r);
              return (
                <div key={r.id}
                  className={`grid grid-cols-[1fr_3fr_1.5fr_auto] gap-0 items-center px-4 py-2.5 border-b border-slate-50 hover:bg-slate-50 transition-colors group`}
                  style={{ borderLeft: `3px solid ${esIngreso ? "#16a34a" : "#dc2626"}` }}
                >
                  <div className="pl-1">
                    {bancoBadge(r.banco)}
                    {r.moneda === "USD" && (
                      <span className="ml-1 text-[10px] text-slate-400">USD</span>
                    )}
                  </div>
                  <div className="pr-3 min-w-0">
                    <p className="text-sm text-slate-700 truncate leading-tight">{r.descripcion ?? "—"}</p>
                    {r.nota && <span className="text-[10px] text-amber-600 italic truncate">{r.nota}</span>}
                  </div>
                  <div>
                    {r.categoria ? (
                      <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 truncate max-w-[160px]">
                        {r.categoria}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-300 italic">sin categoría</span>
                    )}
                  </div>
                  <div className={`text-right text-sm font-semibold tabular-nums whitespace-nowrap ${esIngreso ? "text-green-600" : "text-red-600"}`}>
                    {esIngreso ? "+" : "−"}{formatUYU(amt)}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
