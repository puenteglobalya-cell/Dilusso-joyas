import { createServerClient } from "@/lib/supabase";
import Link from "next/link";
import { ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { formatUYU } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  banco: string;
  cuenta: string | null;
  fecha: string;
  descripcion: string | null;
  debito: number | null;
  credito: number | null;
  saldo: number | null;
  moneda: string;
}

function balanceOk(prev: Row, cur: Row): boolean {
  if (prev.saldo === null || cur.saldo === null) return true;
  const esperado = prev.saldo + (cur.credito ?? 0) - (cur.debito ?? 0);
  return Math.abs(esperado - cur.saldo) <= 1;
}

export default async function ExtractoBancoPage({ params }: { params: Promise<{ banco: string }> }) {
  const { banco } = await params;
  const bancoDecoded = decodeURIComponent(banco);
  const sb = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb.from("bank_statements") as any)
    .select("*")
    .eq("banco", bancoDecoded)
    .order("fecha", { ascending: true })
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as Row[];

  if (rows.length === 0) {
    return (
      <div className="p-8">
        <Link href="/extractos" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Extractos
        </Link>
        <p className="text-gray-500">No hay movimientos para {bancoDecoded}.</p>
      </div>
    );
  }

  // Compute balance consistency per row
  const withCheck = rows.map((row, i) => {
    if (i === 0) return { ...row, ok: true, diff: null as number | null };
    const prev = rows[i - 1];
    const ok = balanceOk(prev, row);
    const diff = row.saldo !== null && prev.saldo !== null
      ? row.saldo - (prev.saldo + (row.credito ?? 0) - (row.debito ?? 0))
      : null;
    return { ...row, ok, diff };
  });

  const errores = withCheck.filter((r) => !r.ok).length;
  const saldoInicial = rows[0].saldo;
  const saldoFinal = rows[rows.length - 1].saldo;
  const totalCredito = rows.reduce((s, r) => s + (r.credito ?? 0), 0);
  const totalDebito = rows.reduce((s, r) => s + (r.debito ?? 0), 0);

  // Group by month for navigation
  const meses = [...new Set(rows.map((r) => r.fecha.slice(0, 7)))].sort();

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/extractos" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Extractos
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{bancoDecoded}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{rows[0]?.cuenta && `Cuenta ${rows[0].cuenta} · `}{rows.length} movimientos · {meses[0]} a {meses[meses.length - 1]}</p>
        </div>
        <Link href="/admin" className="text-xs text-brand underline">Reimportar →</Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 mb-1">Saldo inicial</p>
          <p className="text-lg font-bold">{saldoInicial != null ? formatUYU(saldoInicial) : "—"}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 mb-1">Saldo final</p>
          <p className="text-lg font-bold">{saldoFinal != null ? formatUYU(saldoFinal) : "—"}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 mb-1">Total ingresos</p>
          <p className="text-lg font-bold text-green-600">{formatUYU(totalCredito)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 mb-1">Total egresos</p>
          <p className="text-lg font-bold text-red-600">{formatUYU(totalDebito)}</p>
        </div>
      </div>

      {/* Validation banner */}
      {errores === 0 ? (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-6 text-sm text-green-700">
          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
          Saldos consistentes — todos los movimientos cuadran cronológicamente
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 mb-6 text-sm text-orange-700">
          <AlertCircle className="w-4 h-4 text-orange-500 shrink-0" />
          {errores} inconsistencia{errores > 1 ? "s" : ""} de saldo detectada{errores > 1 ? "s" : ""} — filas marcadas en naranja
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 font-medium text-right">Débito</th>
              <th className="px-4 py-3 font-medium text-right">Crédito</th>
              <th className="px-4 py-3 font-medium text-right">Saldo</th>
              <th className="px-4 py-3 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {withCheck.map((row, i) => (
              <tr key={row.id ?? i} className={row.ok ? "hover:bg-gray-50" : "bg-orange-50 hover:bg-orange-100"}>
                <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap tabular-nums">{row.fecha}</td>
                <td className="px-4 py-2.5 text-gray-800 max-w-xs truncate">{row.descripcion ?? "—"}</td>
                <td className="px-4 py-2.5 text-right text-red-600 tabular-nums">
                  {row.debito != null ? formatUYU(row.debito) : ""}
                </td>
                <td className="px-4 py-2.5 text-right text-green-600 tabular-nums">
                  {row.credito != null ? formatUYU(row.credito) : ""}
                </td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                  {row.saldo != null ? formatUYU(row.saldo) : "—"}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {!row.ok && (
                    <span title={`Diferencia: ${row.diff?.toFixed(2)}`}>
                      <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
