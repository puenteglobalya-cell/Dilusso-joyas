"use client";
import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";

const MES_LABELS: Record<string, string> = {
  "01": "ene","02": "feb","03": "mar","04": "abr","05": "may","06": "jun",
  "07": "jul","08": "ago","09": "sep","10": "oct","11": "nov","12": "dic",
};
function fmtYM(ym: string) { return `${MES_LABELS[ym.slice(5)] ?? ym.slice(5)}-${ym.slice(2, 4)}`; }

interface GapInfo { fecha: string; diff: number }
interface ContResult { label: string; gaps: GapInfo[] }

export function CoveragePanel() {
  const [data, setData] = useState<{ months: string[]; bancos: { label: string; months: { ym: string; loaded: boolean }[] }[] } | null>(null);
  const [continuity, setContinuity] = useState<Map<string, GapInfo[]>>(new Map());

  useEffect(() => {
    fetch("/api/admin/coverage").then(r => r.json()).then(setData);
    fetch("/api/admin/continuity").then(r => r.json()).then((d: { results: ContResult[] }) => {
      const m = new Map<string, GapInfo[]>();
      for (const r of d.results ?? []) m.set(r.label, r.gaps);
      setContinuity(m);
    });
  }, []);

  if (!data || data.months.length === 0) return (
    <div className="bg-white rounded-xl border p-6 text-sm text-gray-400">Cargando cobertura…</div>
  );

  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const missing = data.bancos
    .map(b => ({ banco: b.label, meses: b.months.filter(({ ym, loaded }) => !loaded && ym < currentYM).map(({ ym }) => fmtYM(ym)) }))
    .filter(b => b.meses.length > 0);

  // Build lookup: bancoLabel -> set of YYYY-MM with gap
  const gapMonths = new Map<string, Set<string>>();
  for (const [label, gaps] of continuity.entries()) {
    const s = new Set(gaps.map(g => g.fecha.slice(0, 7)));
    gapMonths.set(label, s);
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border p-5">
        <h2 className="text-base font-semibold mb-3">Cobertura de extractos</h2>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr>
                <th className="text-left pr-3 pb-1 font-medium text-gray-500 whitespace-nowrap">Banco</th>
                {data.months.map(m => (
                  <th key={m} className={`px-0.5 pb-1 font-normal whitespace-nowrap ${m > currentYM ? "text-gray-200" : "text-gray-400"}`}>
                    {fmtYM(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.bancos.map(b => {
                const bankGaps = gapMonths.get(b.label) ?? new Set();
                return (
                  <tr key={b.label}>
                    <td className="pr-3 py-1 font-medium text-gray-700 whitespace-nowrap">{b.label}</td>
                    {b.months.map(({ ym, loaded }) => {
                      const hasGap = loaded && bankGaps.has(ym);
                      return (
                        <td key={ym} className="px-0.5 py-1 text-center">
                          {ym > currentYM
                            ? <span className="inline-block w-5 h-5 rounded bg-gray-100 text-gray-300 text-[10px] leading-5">–</span>
                            : hasGap
                            ? <span className="inline-block w-5 h-5 rounded bg-orange-400 text-white text-[10px] leading-5 font-bold" title="Corte de continuidad">⚠</span>
                            : <span className={`inline-block w-5 h-5 rounded text-white text-[10px] leading-5 font-bold ${loaded ? "bg-green-400" : "bg-red-300"}`}>{loaded ? "✓" : "✗"}</span>
                          }
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-gray-400 mt-2">
          <span className="inline-block w-3 h-3 rounded bg-green-400 mr-1 align-middle" />cargado
          <span className="inline-block w-3 h-3 rounded bg-red-300 mx-1 ml-3 align-middle" />faltante
          <span className="inline-block w-3 h-3 rounded bg-orange-400 mx-1 ml-3 align-middle" />corte de saldo
        </p>
      </div>

      {/* Continuity warnings */}
      {[...continuity.entries()].some(([, gaps]) => gaps.length > 0) && (
        <div className="border border-orange-200 bg-orange-50 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-orange-500 shrink-0" />
            <p className="text-sm font-semibold text-orange-800">Cortes de continuidad detectados</p>
          </div>
          {[...continuity.entries()].filter(([, gaps]) => gaps.length > 0).map(([label, gaps]) => (
            <div key={label} className="space-y-1">
              <p className="text-xs font-semibold text-orange-700">{label}</p>
              {gaps.map(g => (
                <p key={g.fecha} className="text-xs text-orange-600 ml-3">
                  {g.fecha}: {g.diff > 0 ? `faltan` : `sobran`} aprox. ${Math.abs(g.diff).toLocaleString("es-UY", { maximumFractionDigits: 0 })}
                  {" "}({g.diff > 0 ? "período anterior con menos movimientos" : "posibles duplicados"})
                </p>
              ))}
            </div>
          ))}
        </div>
      )}

      {missing.length > 0 && (
        <div className="border border-orange-200 bg-orange-50 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-orange-800">Extractos faltantes</p>
            <span className="text-xs font-bold bg-orange-200 text-orange-900 rounded-full px-2.5 py-0.5">
              {missing.reduce((acc, b) => acc + b.meses.length, 0)} meses
            </span>
          </div>
          <ul className="space-y-1.5">
            {missing.map(({ banco, meses }) => (
              <li key={banco} className="text-sm text-orange-700">
                <span className="font-medium">{banco}</span>
                <span className="ml-1.5 text-xs font-semibold bg-orange-200 text-orange-900 rounded-full px-2 py-0.5">{meses.length}</span>
                <span className="ml-2 text-orange-600">{meses.join(", ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
