import Link from "next/link";
import { createServerClient } from "@/lib/supabase";
import { formatUYU, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { TransactionFilters } from "@/components/transactions/filters";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consolidado | Dilusso Joyas" };

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
  tipo: string | null;
  categoria_negocio: string | null;
  categoria_personal: string | null;
  clasificado: string | null;
}

function rowImporteUYU(r: BSRow): number {
  if (r.moneda === "USD") return Math.abs(r.importe_uyu ?? 0);
  return (r.debito ?? 0) + (r.credito ?? 0);
}

export default async function ConsolidadoPage({ searchParams }: Props) {
  const sp = await searchParams;
  const sb = createServerClient();
  const mesFilter = sp.mes ? parseInt(sp.mes) : null;
  const añoFilter = sp.año ? parseInt(sp.año) : new Date().getFullYear();
  const tipoFilter = sp.tipo ?? null;
  const bancoFilter = sp.banco ?? null;

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
    let q = (sb.from("bank_statements") as any)
      .select("id,banco,fecha,descripcion,debito,credito,importe_uyu,moneda,tipo,categoria_negocio,categoria_personal,clasificado")
      .gte("fecha", fechaDesde)
      .lt("fecha", fechaHasta)
      .neq("descripcion", "Saldo anterior")
      .neq("tipo", "traspaso")
      .order("fecha", { ascending: false })
      .range(from, from + PAGE - 1);
    if (tipoFilter) q = q.eq("tipo", tipoFilter);
    if (bancoFilter) q = q.eq("banco", bancoFilter);
    const { data } = await q;
    if (!data || data.length === 0) break;
    all = all.concat(data as BSRow[]);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const totalSalidas = all.filter(r => (r.debito ?? 0) > 0).reduce((s, r) => s + rowImporteUYU(r), 0);
  const totalIngresos = all.filter(r => (r.credito ?? 0) > 0).reduce((s, r) => s + rowImporteUYU(r), 0);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Consolidado</h1>
          <p className="text-sm text-slate-500 mt-1">{all.length} movimientos</p>
        </div>
      </div>

      <TransactionFilters />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card><CardHeader><CardTitle>Ingresos</CardTitle><CardValue className="text-green-600">{formatUYU(totalIngresos)}</CardValue></CardHeader></Card>
        <Card><CardHeader><CardTitle>Egresos</CardTitle><CardValue className="text-red-600">{formatUYU(totalSalidas)}</CardValue></CardHeader></Card>
        <Card><CardHeader><CardTitle>Neto</CardTitle><CardValue className={totalIngresos - totalSalidas >= 0 ? "text-green-600" : "text-red-600"}>{formatUYU(totalIngresos - totalSalidas)}</CardValue></CardHeader></Card>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Fecha</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Banco</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Descripción</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Categoría</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500">Importe UYU</th>
              <th className="text-center px-4 py-3 font-medium text-slate-500">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {all.map((r) => {
              const esIngreso = (r.credito ?? 0) > 0;
              const cat = r.tipo === "negocio" ? r.categoria_negocio : r.categoria_personal;
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(r.fecha)}</td>
                  <td className="px-4 py-3 font-medium">{r.banco}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{r.descripcion ?? "—"}</td>
                  <td className="px-4 py-3">
                    {r.tipo ? (
                      <Badge variant={r.tipo === "negocio" ? "default" : "outline"}>{r.tipo}</Badge>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{cat ?? "—"}</td>
                  <td className={`px-4 py-3 text-right font-medium ${esIngreso ? "text-green-600" : "text-red-600"}`}>
                    {esIngreso ? "+" : "-"}{formatUYU(rowImporteUYU(r))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={r.clasificado === "Si" ? "success" : "warning"}>
                      {r.clasificado === "Si" ? "OK" : "Pendiente"}
                    </Badge>
                  </td>
                </tr>
              );
            })}
            {!all.length && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                  <p className="font-medium text-slate-500 mb-1">Sin movimientos para este período</p>
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
