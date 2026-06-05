import { createServerClient } from "@/lib/supabase";
import { formatUYU, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { TransactionFilters } from "@/components/transactions/filters";
import { ExportButton } from "@/components/transactions/export-button";
import type { Transaction } from "@/lib/database.types";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function ConsolidadoPage({ searchParams }: Props) {
  const sp = await searchParams;
  const sb = createServerClient();
  const mes = sp.mes ? parseInt(sp.mes) : null;
  const año = sp.año ? parseInt(sp.año) : new Date().getFullYear();
  const tipo = sp.tipo ?? null;
  const banco = sp.banco ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (sb.from("transactions") as any)
    .select("*", { count: "exact" })
    .order("fecha", { ascending: false })
    .limit(500);

  if (año) query = query.eq("año", año);
  if (mes) query = query.eq("mes", mes);
  if (tipo) query = query.eq("tipo", tipo);
  if (banco) query = query.eq("banco", banco);

  const { data, count } = await query;
  const transactions = (data ?? []) as Transaction[];

  const totalSalidas = transactions
    .filter((t) => t.movimiento === "salida")
    .reduce((s, t) => s + (t.importe_uyu ?? 0), 0);
  const totalIngresos = transactions
    .filter((t) => t.movimiento === "ingreso")
    .reduce((s, t) => s + (t.importe_uyu ?? 0), 0);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Consolidado</h1>
          <p className="text-sm text-slate-500 mt-1">{count ?? 0} transacciones</p>
        </div>
        <ExportButton />
      </div>

      <TransactionFilters />

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-slate-500">Total salidas</p>
          <p className="text-xl font-bold text-red-600 mt-1">{formatUYU(totalSalidas)}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-slate-500">Total ingresos</p>
          <p className="text-xl font-bold text-green-600 mt-1">{formatUYU(totalIngresos)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Fecha</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Banco</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Detalle</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Categoría</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500">Importe UYU</th>
              <th className="text-center px-4 py-3 font-medium text-slate-500">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(tx.fecha)}</td>
                <td className="px-4 py-3 font-medium">{tx.banco}</td>
                <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{tx.detalle ?? "—"}</td>
                <td className="px-4 py-3">
                  {tx.tipo ? (
                    <Badge variant={tx.tipo === "negocio" ? "default" : "outline"}>{tx.tipo}</Badge>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">{tx.categoria ?? "—"}</td>
                <td className={`px-4 py-3 text-right font-medium ${tx.movimiento === "salida" ? "text-red-600" : "text-green-600"}`}>
                  {tx.movimiento === "salida" ? "-" : "+"}{formatUYU(tx.importe_uyu)}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={tx.clasificado ? "success" : "warning"}>
                    {tx.clasificado ? "OK" : "Pendiente"}
                  </Badge>
                </td>
              </tr>
            ))}
            {!transactions.length && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                  Sin transacciones para este período
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
