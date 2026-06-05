import { createServerClient } from "@/lib/supabase";
import { formatUYU, formatDate } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardValue, CardContent } from "@/components/ui/card";
import { TransactionFilters } from "@/components/transactions/filters";
import { ExportButton } from "@/components/transactions/export-button";
import { NegocioChart } from "@/components/negocio/chart";
import type { Transaction } from "@/lib/database.types";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function NegocioPage({ searchParams }: Props) {
  const sp = await searchParams;
  const sb = createServerClient();
  const mes = sp.mes ? parseInt(sp.mes) : null;
  const año = sp.año ? parseInt(sp.año) : new Date().getFullYear();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (sb.from("transactions") as any).select("*").eq("tipo", "negocio").order("fecha", { ascending: false }).limit(500);
  if (año) query = query.eq("año", año);
  if (mes) query = query.eq("mes", mes);

  const { data } = await query;
  const txs = (data ?? []) as Transaction[];

  const salidas = txs.filter((t) => t.movimiento === "salida").reduce((s, t) => s + (t.importe_uyu ?? 0), 0);
  const ingresos = txs.filter((t) => t.movimiento === "ingreso").reduce((s, t) => s + (t.importe_uyu ?? 0), 0);

  const byCategory = txs
    .filter((t) => t.movimiento === "salida" && t.categoria)
    .reduce<Record<string, number>>((acc, t) => {
      acc[t.categoria!] = (acc[t.categoria!] ?? 0) + (t.importe_uyu ?? 0);
      return acc;
    }, {});

  const categoryData = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Negocio</h1>
          <p className="text-sm text-slate-500 mt-1">BBVA · OCA · Efectivo negocio</p>
        </div>
        <ExportButton />
      </div>

      <TransactionFilters />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card><CardHeader><CardTitle>Ingresos</CardTitle><CardValue className="text-green-600">{formatUYU(ingresos)}</CardValue></CardHeader></Card>
        <Card><CardHeader><CardTitle>Egresos</CardTitle><CardValue className="text-red-600">{formatUYU(salidas)}</CardValue></CardHeader></Card>
        <Card><CardHeader><CardTitle>Resultado</CardTitle><CardValue className={ingresos - salidas >= 0 ? "text-green-600" : "text-red-600"}>{formatUYU(ingresos - salidas)}</CardValue></CardHeader></Card>
      </div>

      {categoryData.length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Gastos por categoría</CardTitle></CardHeader>
          <CardContent><NegocioChart data={categoryData} /></CardContent>
        </Card>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Fecha</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Banco</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Detalle</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Categoría</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500">Importe UYU</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {txs.map((tx) => (
              <tr key={tx.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(tx.fecha)}</td>
                <td className="px-4 py-3 font-medium">{tx.banco}</td>
                <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{tx.detalle ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">{tx.categoria ?? "—"}</td>
                <td className={`px-4 py-3 text-right font-medium ${tx.movimiento === "salida" ? "text-red-600" : "text-green-600"}`}>
                  {tx.movimiento === "salida" ? "-" : "+"}{formatUYU(tx.importe_uyu)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
