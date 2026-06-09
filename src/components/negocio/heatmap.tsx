"use client";
import { formatUYU } from "@/lib/utils";

interface Props {
  cats: string[];
  months: string[];
  data: Record<string, Record<string, number>>;
}

const MES: Record<string, string> = {
  "01":"ene","02":"feb","03":"mar","04":"abr","05":"may","06":"jun",
  "07":"jul","08":"ago","09":"sep","10":"oct","11":"nov","12":"dic",
};
function fmtYM(ym: string) { return `${MES[ym.slice(5)] ?? ym.slice(5)}-${ym.slice(2,4)}`; }

// Returns a tailwind bg class based on intensity 0-1
function heatColor(intensity: number): string {
  if (intensity <= 0) return "bg-gray-50 text-gray-300";
  if (intensity < 0.2) return "bg-red-100 text-red-700";
  if (intensity < 0.4) return "bg-red-200 text-red-800";
  if (intensity < 0.6) return "bg-red-300 text-red-900";
  if (intensity < 0.8) return "bg-red-400 text-white";
  return "bg-red-500 text-white";
}

export function NegocioHeatmap({ cats, months, data }: Props) {
  // Per-category max for normalization
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
            <th className="px-2 pb-2 font-medium text-slate-500 text-right whitespace-nowrap">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {cats.map(cat => {
            const rowTotal = months.reduce((s, m) => s + (data[cat]?.[m] ?? 0), 0);
            return (
              <tr key={cat} className="hover:bg-slate-50">
                <td className="pr-3 py-1 text-slate-700 font-medium truncate max-w-[140px]" title={cat}>{cat}</td>
                {months.map(m => {
                  const val = data[cat]?.[m] ?? 0;
                  const intensity = val / catMax[cat];
                  return (
                    <td key={m} className={`px-1 py-1 text-center rounded`}>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${heatColor(intensity)}`}
                        title={val > 0 ? formatUYU(val) : undefined}>
                        {val > 0 ? `$${(val / 1000).toFixed(0)}k` : "—"}
                      </span>
                    </td>
                  );
                })}
                <td className="px-2 py-1 text-right font-semibold text-red-700 whitespace-nowrap">
                  {formatUYU(rowTotal)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
