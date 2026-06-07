import Link from "next/link";
import { createServerClient } from "@/lib/supabase";
import { formatUYU, formatDate } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardValue, CardContent } from "@/components/ui/card";
import { TransactionFilters } from "@/components/transactions/filters";
import { NegocioChart } from "@/components/negocio/chart";

export const dynamic = "force-dynamic";
export const metadata = { title: "Movimientos de Cecilia | Dilusso Joyas" };

interface Props {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

interface BSRow {
  id: string;
  banco: string;
  fecha: string;
  descripcion: string | null;
  debito: number | null;
  credito: number | null;
  importe_uyu: number | null;
  moneda: string;
  categoria_personal: string | null;
}

function rowImporteUYU(r: BSRow): number {
  if (r.moneda === "USD") return Math.abs(r.importe_uyu ?? 0);
  return (r.debito ?? 0) + (r.credito ?? 0);
}

export default async function PersonalPage({ searchParams }: Props) {
  const sp = await searchParams;
  const sb = createServerClient();
  const mesFilter = sp.mes ? parseInt(sp.mes) : null;
  const añoFilter = sp.año ? parseInt(sp.año) : new Date().getFullYear();

  let fechaDesde: string;
  let fechaHasta: string;
  if (mesFilter) {
    const m = String(mesFilter).padStart(2, "0");
    fechaDesde = `${añoFilter}-${m}-01`;
    const nextM = mesFilter === 12 ? 1 : mesFilter + 1;
    const nextY = mesFilter === 12 ? añoFilter + 1 : añoFilter;
    fechaHasta = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
  } else {
    fechaDesde = `${añoFilter}-01-01`;
    fechaHasta = `${añoFilter + 1}-01-01`;
  }

  const PAGE = 1000;
  let all: BSRow[] = [];
  let from = 0;
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (sb.from("bank_statements") as any)
      .select("id,banco,fecha,descripcion,debito,credito,importe_uyu,moneda,categoria_personal")
      .eq("tipo", "personal")
      .gte("fecha", fechaDesde)
      .lt("fecha", fechaHasta)
      .neq("descripcion", "Saldo anterior")
      .order("fecha", { ascending: false })
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    all = all.concat(data as BSRow[]);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  const txs = all;

  const salidas = txs.filter(r => (r.debito ?? 0) > 0).reduce((s, r) => s + rowImporteUYU(r), 0);
  const ingresos = txs.filter(r => (r.credito ?? 0) > 0).reduce((s, r) => s + rowImporteUYU(r), 0);

  const byCategory = txs
    .filter(r => (r.debito ?? 0) > 0 && r.categoria_personal)
    .reduce<Record<string, number>>((acc, r) => {
      acc[r.categoria_personal!] = (acc[r.categoria_personal!] ?? 0) + rowImporteUYU(r);
      return acc;
    }, {});
  const categoryData = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Movimientos de Cecilia</h1>
          <p className="text-sm text-slate-500 mt-1">Basado en extractos bancarios clasificados como personal</p>
        </div>
      </div>

      <TransactionFilters />

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card><CardHeader><CardTitle>Ingresos</CardTitle><CardValue className="text-green-600">{formatUYU(ingresos)}</CardValue></CardHeader></Card>
        <Card><CardHeader><CardTitle>Gastos</CardTitle><CardValue className="text-red-600">{formatUYU(salidas)}</CardValue></CardHeader></Card>
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
              <th className="text-left px-4 py-3 font-medium text-slate-500">Descripción</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Categoría</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500">Importe UYU</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {txs.map((r) => {
              const esIngreso = (r.credito ?? 0) > 0;
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(r.fecha)}</td>
                  <td className="px-4 py-3 font-medium">{r.banco}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{r.descripcion ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{r.categoria_personal ?? "—"}</td>
                  <td className={`px-4 py-3 text-right font-medium ${esIngreso ? "text-green-600" : "text-red-600"}`}>
                    {esIngreso ? "+" : "-"}{formatUYU(rowImporteUYU(r))}
                  </td>
                </tr>
              );
            })}
            {!txs.length && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                  <p className="font-medium text-slate-500 mb-1">Sin movimientos clasificados como personal para este período</p>
                  <Link href="/extractos" className="text-xs text-brand underline">Ir a extractos →</Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
