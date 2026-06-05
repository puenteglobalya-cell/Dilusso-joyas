import { createServerClient } from "@/lib/supabase";
import { formatUYU, formatDate } from "@/lib/utils";
import { ClassifyForm } from "@/components/transactions/classify-form";
import type { Transaction, Category } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function SinConciliarPage() {
  const sb = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: txData, count } = await (sb.from("transactions") as any)
    .select("*", { count: "exact" })
    .eq("clasificado", false)
    .order("fecha", { ascending: false })
    .limit(200);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: catData } = await (sb.from("categories") as any).select("*").order("name");

  const transactions = (txData ?? []) as Transaction[];
  const categories = (catData ?? []) as Category[];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Sin conciliar</h1>
        <p className="text-sm text-slate-500 mt-1">{count ?? 0} transacciones pendientes</p>
      </div>

      {!transactions.length ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg">✓ Todo conciliado</p>
          <p className="text-sm mt-1">No hay transacciones pendientes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx) => (
            <div key={tx.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-slate-400">{formatDate(tx.fecha)}</span>
                    <span className="text-xs font-medium text-slate-600">{tx.banco}</span>
                  </div>
                  <p className="text-sm text-slate-800 truncate">{tx.detalle ?? "Sin descripción"}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-semibold ${tx.movimiento === "salida" ? "text-red-600" : "text-green-600"}`}>
                    {tx.movimiento === "salida" ? "-" : "+"}{formatUYU(tx.importe_uyu)}
                  </p>
                  <p className="text-xs text-slate-400">{tx.moneda}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t">
                <ClassifyForm
                  transactionId={tx.id}
                  detalle={tx.detalle ?? ""}
                  banco={tx.banco}
                  categories={categories}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
