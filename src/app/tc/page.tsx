import { createServerClient } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";
import { AddTCEntry } from "@/components/tc/add-entry";
import type { ExchangeRate } from "@/lib/database.types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tipo de cambio | Dilusso Joyas" };

export default async function TCPage() {
  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb.from("exchange_rates") as any).select("*").order("date", { ascending: false }).limit(60);
  const rates = (data ?? []) as ExchangeRate[];
  const latest = rates[0];

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Tipo de cambio</h1>
          <p className="text-sm text-muted mt-1">USD / UYU</p>
        </div>
        <AddTCEntry />
      </div>

      {latest && (
        <div className="bg-slate-900 text-white rounded-xl p-6 mb-6">
          <p className="text-sm text-subtle">TC vigente</p>
          <p className="text-4xl font-bold mt-1">{latest.rate.toFixed(3)}</p>
          <p className="text-xs text-subtle mt-2">{formatDate(latest.date)}</p>
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted">Fecha</th>
              <th className="text-right px-4 py-3 font-medium text-muted">TC (USD/UYU)</th>
              <th className="text-left px-4 py-3 font-medium text-muted">Fuente</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rates.map((r) => (
              <tr key={r.id} className="hover:bg-surface">
                <td className="px-4 py-3 text-muted">{formatDate(r.date)}</td>
                <td className="px-4 py-3 text-right font-semibold">{r.rate.toFixed(4)}</td>
                <td className="px-4 py-3 text-subtle text-xs">{r.source ?? "Manual"}</td>
              </tr>
            ))}
            {!rates.length && (
              <tr><td colSpan={3} className="px-4 py-12 text-center text-subtle">Sin datos de tipo de cambio</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
