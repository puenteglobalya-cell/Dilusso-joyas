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

function heatColor(intensity: number): string {
  if (intensity <= 0) return "bg-gray-50 text-gray-300";
  if (intensity < 0.2) return "bg-red-100 text-red-700";
  if (intensity < 0.4) return "bg-red-200 text-red-800";
  if (intensity < 0.6) return "bg-red-300 text-red-900";
  if (intensity < 0.8) return "bg-red-400 text-white";
  return "bg-red-500 text-white";
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
            <th className="text-left pr-3 pb-2 font-medium text-slate-500 whitespace-nowrap min-w-[140px]">Categoría</th>
            {months.map(m => (
              <th key={m} className="px-1 pb-2 font-normal text-slate-400 whitespace-nowrap text-center">{fmtYM(m)}</th>
            ))}
            <th
              className="px-2 pb-2 font-medium text-slate-500 text-right whitespace-nowrap cursor-pointer select-none hover:text-brand"
              onClick={() => setSortByTotal(s => !s)}
              title="Ordenar por total"
            >
              Total <ArrowUpDown className="inline w-3 h-3 mb-0.5 opacity-60" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map(({ cat, total }) => (
            <tr key={cat} className="hover:bg-slate-50">
              <td
                className={`pr-3 py-1 text-slate-700 font-medium truncate max-w-[140px] ${onCellClick ? "cursor-pointer hover:text-brand underline-offset-2 hover:underline" : ""}`}
                title={cat}
                onClick={() => onCellClick?.(cat, months[months.length - 1])}
              >{cat}</td>
              {months.map(m => {
                const val = data[cat]?.[m] ?? 0;
                const intensity = val / catMax[cat];
                return (
                  <td key={m} className="px-1 py-1 text-center rounded">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${heatColor(intensity)} ${onCellClick && val > 0 ? "cursor-pointer hover:opacity-80" : ""}`}
                      title={val > 0 ? formatUYU(val) : undefined}
                      onClick={() => val > 0 && onCellClick?.(cat, m)}
                    >
                      {val > 0 ? `$${(val / 1000).toFixed(0)}k` : "—"}
                    </span>
                  </td>
                );
              })}
              <td
                className={`px-2 py-1 text-right font-semibold text-red-700 whitespace-nowrap ${onCellClick ? "cursor-pointer hover:text-brand hover:underline underline-offset-2" : ""}`}
                onClick={() => onCellClick?.(cat)}
                title={onCellClick ? `Ver todos los movimientos de ${cat}` : undefined}
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
