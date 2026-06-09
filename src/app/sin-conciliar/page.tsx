import { createServerClient } from "@/lib/supabase";
import { formatUYU, formatDate } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sin clasificar | Dilusso Joyas" };

interface BSRow {
  id: string;
  banco: string;
  fecha: string;
  descripcion: string | null;
  debito: number | null;
  credito: number | null;
  importe_uyu: number | null;
  moneda: string;
}

function rowImporteUYU(r: BSRow): number {
  if (r.moneda === "USD") return Math.abs(r.importe_uyu ?? 0);
  return (r.debito ?? 0) + (r.credito ?? 0);
}

export default async function SinConciliarPage() {
  const sb = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, count } = await (sb.from("bank_statements") as any)
    .select("id,banco,fecha,descripcion,debito,credito,importe_uyu,moneda", { count: "exact" })
    .eq("clasificado", "No")
    .neq("descripcion", "Saldo anterior")
    .neq("tipo", "traspaso")
    .order("fecha", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as BSRow[];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Sin clasificar</h1>
        <p className="text-sm text-slate-500 mt-1">{count ?? 0} movimientos pendientes</p>
      </div>

      {!rows.length ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-2xl mb-2">✓</p>
          <p className="text-base font-medium text-slate-600">Todo clasificado</p>
          <p className="text-sm mt-1">No hay movimientos pendientes de clasificar</p>
        </div>
      ) : (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 text-sm text-blue-700">
            Para clasificar, abrí el extracto del banco correspondiente y usá el botón &quot;Ver sin clasificar&quot;.{" "}
            <Link href="/extractos" className="underline font-medium">Ir a extractos →</Link>
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Banco</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Descripción</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500">Importe UYU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const esIngreso = (r.credito ?? 0) > 0;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(r.fecha)}</td>
                      <td className="px-4 py-3 font-medium">{r.banco}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{r.descripcion ?? "—"}</td>
                      <td className={`px-4 py-3 text-right font-medium ${esIngreso ? "text-green-600" : "text-red-600"}`}>
                        {esIngreso ? "+" : "-"}{formatUYU(rowImporteUYU(r))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
