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
  BBVA:        "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  "Itaú":      "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  Scotiabank:  "bg-teal-50 text-teal-700 ring-1 ring-teal-200",
  OCA:         "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  "Itau-Card": "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
};

function bancoBadge(banco: string) {
  const cls = BANCO_COLORS[banco] ?? "bg-slate-100 text-slate-500 ring-1 ring-slate-200";
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
    <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #ede9e4" }}>
      {/* Column header */}
      <div className="grid grid-cols-[1fr_3fr_1.5fr_auto] border-b px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider sticky top-0 bg-white" style={{ borderColor: "#ede9e4", color: "#b5a49a" }}>
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
            <div className="flex items-center justify-between px-4 py-1.5 border-b border-t" style={{ background: "#faf8f5", borderColor: "#ede9e4" }}>
              <span className="text-[11px] font-semibold tracking-wide" style={{ color: "#7a6a60" }}>{formatDate(fecha)}</span>
              <div className="flex gap-4 text-[11px]">
                {dayIngresos > 0 && (
                  <span className="text-sky-600 font-medium">+{formatUYU(dayIngresos)}</span>
                )}
                {dayEgresos > 0 && (
                  <span className="text-rose-500 font-medium">−{formatUYU(dayEgresos)}</span>
                )}
              </div>
            </div>

            {dayRows.map(r => {
              const esIngreso = (r.credito ?? 0) > 0;
              const amt = importeUYU(r);
              return (
                <div
                  key={r.id}
                  className="grid grid-cols-[1fr_3fr_1.5fr_auto] items-center px-4 py-2.5 border-b transition-colors"
                  style={{ borderColor: "#f5f0eb", borderLeft: `3px solid ${esIngreso ? "#7dd3fc" : "#fda4af"}` }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#faf8f5"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ""}
                >
                  <div className="pl-1 flex items-center gap-1.5">
                    {bancoBadge(r.banco)}
                    {r.moneda === "USD" && (
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ color: "#b5a49a", background: "#f5f0eb" }}>USD</span>
                    )}
                  </div>
                  <div className="pr-3 min-w-0">
                    <p className="text-[13px] truncate leading-snug" style={{ color: "#2a1f1a" }}>{r.descripcion ?? "—"}</p>
                    {r.nota && (
                      <p className="text-[11px] italic truncate mt-0.5" style={{ color: "#d97706" }}>{r.nota}</p>
                    )}
                  </div>
                  <div>
                    {r.categoria ? (
                      <span className="inline-block text-[11px] px-2 py-0.5 rounded-full font-medium truncate max-w-[160px]" style={{ background: "#f5f0eb", color: "#7a6a60" }}>
                        {r.categoria}
                      </span>
                    ) : (
                      <span className="text-[11px]" style={{ color: "#c4b5ad" }}>sin categoría</span>
                    )}
                  </div>
                  <div className={`text-right text-[13px] font-semibold tabular-nums whitespace-nowrap ${esIngreso ? "text-sky-700" : "text-rose-600"}`}>
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
