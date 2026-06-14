"use client";
import { useState } from "react";
import { formatUYU } from "@/lib/utils";
import { ArrowUpDown } from "lucide-react";

interface Props {
  cats: string[];
  months: string[];
  data: Record<string, Record<string, number>>;
  onCellClick?: (cat: string, mes?: string) => void;
}

const MES: Record<string, string> = {
  "01":"ene","02":"feb","03":"mar","04":"abr","05":"may","06":"jun",
  "07":"jul","08":"ago","09":"sep","10":"oct","11":"nov","12":"dic",
};
function fmtYM(ym: string) { return `${MES[ym.slice(5)] ?? ym.slice(5)}-${ym.slice(2,4)}`; }

function heatColor(intensity: number): { bg: string; text: string } {
  if (intensity <= 0)   return { bg: "#f5f0eb", text: "#c4b5a0" };
  if (intensity < 0.15) return { bg: "#fef9ec", text: "#92400e" };
  if (intensity < 0.30) return { bg: "#fef3c7", text: "#78350f" };
  if (intensity < 0.50) return { bg: "#fde68a", text: "#451a03" };
  if (intensity < 0.70) return { bg: "#fbbf24", text: "#1c0a00" };
  if (intensity < 0.85) return { bg: "#f59e0b", text: "#fff" };
  return { bg: "#d97706", text: "#fff" };
}

export function NegocioHeatmap({ cats, months, data, onCellClick }: Props) {
  const [sortByTotal, setSortByTotal] = useState(true);

  const withTotals = cats.map(cat => ({
    cat,
    total: months.reduce((s, m) => s + (data[cat]?.[m] ?? 0), 0),
  }));
  const sorted = sortByTotal
    ? [...withTotals].sort((a, b) => b.total - a.total)
    : withTotals;

  const catMax: Record<string, number> = {};
  for (const cat of cats) {
    catMax[cat] = Math.max(...months.map(m => data[cat]?.[m] ?? 0), 1);
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full">
        <thead>
          <tr>
            <th className="text-left pr-3 pb-2 font-medium whitespace-nowrap min-w-[140px]" style={{ color: "#9c8a7e" }}>Categoría</th>
            {months.map(m => (
              <th key={m} className="px-1 pb-2 font-normal whitespace-nowrap text-center" style={{ color: "#c4b5a0" }}>{fmtYM(m)}</th>
            ))}
            <th
              className="px-2 pb-2 font-medium text-right whitespace-nowrap cursor-pointer select-none"
              style={{ color: "#7a6a60" }}
              onClick={() => setSortByTotal(s => !s)}
              title="Ordenar por total"
            >
              Total <ArrowUpDown className="inline w-3 h-3 mb-0.5 opacity-60" />
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ cat, total }, idx) => (
            <tr key={cat} style={{ borderTop: idx > 0 ? "1px solid #f5f0eb" : undefined }}>
              <td
                className={`pr-3 py-1.5 font-medium truncate max-w-[140px] ${onCellClick ? "cursor-pointer hover:underline underline-offset-2" : ""}`}
                style={{ color: "#5c4d45" }}
                title={cat}
                onClick={() => onCellClick?.(cat, months[months.length - 1])}
              >{cat.replace(/^\d+\.\s*/, "")}</td>
              {months.map(m => {
                const val = data[cat]?.[m] ?? 0;
                const { bg, text } = heatColor(val / catMax[cat]);
                return (
                  <td key={m} className="px-1 py-1 text-center">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium transition-opacity ${onCellClick && val > 0 ? "cursor-pointer hover:opacity-75" : ""}`}
                      style={{ background: bg, color: text }}
                      title={val > 0 ? formatUYU(val) : undefined}
                      onClick={() => val > 0 && onCellClick?.(cat, m)}
                    >
                      {val > 0 ? `$${(val / 1000).toFixed(0)}k` : "—"}
                    </span>
                  </td>
                );
              })}
              <td
                className={`px-2 py-1.5 text-right font-semibold whitespace-nowrap ${onCellClick ? "cursor-pointer hover:underline underline-offset-2" : ""}`}
                style={{ color: "#d97706" }}
                onClick={() => onCellClick?.(cat)}
              >
                {formatUYU(total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
