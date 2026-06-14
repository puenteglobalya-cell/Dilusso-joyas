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

// Warm desaturated bank badges (no pure blue/red)
const BANCO_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  BBVA:        { bg: "#EEF1F8", color: "#4A5A8A", border: "#C5CCE0" },
  "Itaú":      { bg: "#F5F0E8", color: "#7A5A20", border: "#D4B87A" },
  Scotiabank:  { bg: "#EBF2EE", color: "#3A6A50", border: "#A8C8B0" },
  OCA:         { bg: "#F0EBF5", color: "#5A3A7A", border: "#C0A8D8" },
  "Itau-Card": { bg: "#F5EDE8", color: "#7A4A30", border: "#D4A888" },
};

function bancoBadge(banco: string) {
  const s = BANCO_STYLES[banco] ?? { bg: "#F5F0E8", color: "#8C857B", border: "#E6E1DA" };
  return (
    <span
      className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-md whitespace-nowrap"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
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
      <div className="bg-white rounded-xl p-12 text-center" style={{ border: "1px solid #E6E1DA" }}>
        <p className="text-sm mb-2" style={{ color: "#8C857B" }}>{emptyMessage ?? "Sin movimientos para este período"}</p>
        {emptyLink && (
          <a href={emptyLink.href} className="text-xs underline" style={{ color: "#C5A059" }}>{emptyLink.label}</a>
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
    <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E6E1DA" }}>
      {/* Column header */}
      <div
        className="grid grid-cols-[1fr_3fr_1.5fr_auto] border-b px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider sticky top-0 bg-white"
        style={{ borderColor: "#E6E1DA", color: "#8C857B" }}
      >
        <span>Banco</span>
        <span>Descripción</span>
        <span>Categoría</span>
        <span className="text-right pr-1">Importe</span>
      </div>

      {Array.from(groups.entries()).map(([fecha, dayRows], groupIdx) => {
        const dayEgresos  = dayRows.filter(r => (r.debito  ?? 0) > 0).reduce((s, r) => s + importeUYU(r), 0);
        const dayIngresos = dayRows.filter(r => (r.credito ?? 0) > 0).reduce((s, r) => s + importeUYU(r), 0);

        return (
          <div key={fecha}>
            {/* Date separator */}
            <div
              className="flex items-center justify-between px-4 py-1.5 border-b"
              style={{
                background: groupIdx % 2 === 0 ? "#FCFBFA" : "#F8F5F0",
                borderTop: "1px solid #E6E1DA",
                borderBottom: "1px solid #E6E1DA",
              }}
            >
              <span className="text-[11px] font-semibold tracking-wide" style={{ color: "#2E2B2A" }}>{formatDate(fecha)}</span>
              <div className="flex gap-4 text-[11px]">
                {dayIngresos > 0 && (
                  <span className="font-medium" style={{ color: "#586E50" }}>+{formatUYU(dayIngresos)}</span>
                )}
                {dayEgresos > 0 && (
                  <span className="font-medium" style={{ color: "#946E61" }}>−{formatUYU(dayEgresos)}</span>
                )}
              </div>
            </div>

            {dayRows.map((r, rowIdx) => {
              const esIngreso = (r.credito ?? 0) > 0;
              const amt = importeUYU(r);
              const zebraBase = rowIdx % 2 === 0 ? "#fff" : "#FCFBFA";
              return (
                <div
                  key={r.id}
                  className="grid grid-cols-[1fr_3fr_1.5fr_auto] items-center px-4 py-2.5 border-b transition-colors"
                  style={{
                    background: zebraBase,
                    borderColor: "#E6E1DA",
                    borderLeft: `3px solid ${esIngreso ? "#586E50" : "#946E61"}`,
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#F5F0E8"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = zebraBase}
                >
                  <div className="pl-1 flex items-center gap-1.5">
                    {bancoBadge(r.banco)}
                    {r.moneda === "USD" && (
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ color: "#A3907A", background: "#F5F0E8" }}>USD</span>
                    )}
                  </div>
                  <div className="pr-3 min-w-0">
                    <p className="text-[13px] truncate leading-snug" style={{ color: "#2E2B2A" }}>{r.descripcion ?? "—"}</p>
                    {r.nota && (
                      <p className="text-[11px] italic truncate mt-0.5" style={{ color: "#C5A059" }}>{r.nota}</p>
                    )}
                  </div>
                  <div>
                    {r.categoria ? (
                      <span
                        className="inline-block text-[11px] px-2 py-0.5 rounded-full font-medium truncate max-w-[160px]"
                        style={{ background: "#F5F0E8", color: "#8C857B" }}
                      >
                        {r.categoria}
                      </span>
                    ) : (
                      <span className="text-[11px]" style={{ color: "#A3907A" }}>sin categoría</span>
                    )}
                  </div>
                  <div
                    className="text-right text-[13px] font-semibold tabular-nums whitespace-nowrap"
                    style={{ color: esIngreso ? "#586E50" : "#946E61" }}
                  >
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
