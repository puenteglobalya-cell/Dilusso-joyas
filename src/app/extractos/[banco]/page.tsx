import { createServerClient } from "@/lib/supabase";
import Link from "next/link";
import { ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { formatUYU } from "@/lib/utils";
import BankStatementTable, { type Row } from "./BankStatementTable";

export const dynamic = "force-dynamic";

interface PeriodGap {
  fecha: string;       // fecha of the Saldo anterior row
  esperado: number;    // last saldo of previous period
  recibido: number;    // saldo of this Saldo anterior
  diff: number;
}

function checkPeriodContinuity(rows: Row[]): PeriodGap[] {
  const gaps: PeriodGap[] = [];

  for (let i = 1; i < rows.length; i++) {
    if (rows[i].descripcion !== "Saldo anterior") continue;

    // Find last non-"Saldo anterior" row before this one
    let prevSaldo: number | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (rows[j].descripcion !== "Saldo anterior" && rows[j].saldo !== null) {
        prevSaldo = rows[j].saldo;
        break;
      }
    }

    const curSaldo = rows[i].saldo;
    if (prevSaldo === null || curSaldo === null) continue;
    if (Math.abs(curSaldo - prevSaldo) > 1) {
      gaps.push({
        fecha: rows[i].fecha,
        esperado: prevSaldo,
        recibido: curSaldo,
        diff: curSaldo - prevSaldo,
      });
    }
  }

  return gaps;
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

  // All rows pass individual check (no per-row orange highlighting)
  const withCheck = rows.map((row) => ({ ...row, ok: true, diff: null as number | null }));

  const gaps = checkPeriodContinuity(rows);

  const saldoInicial = rows[0].saldo;
  const saldoFinal = rows[rows.length - 1].saldo;
  const totalCredito = rows.reduce((s, r) => s + (r.credito ?? 0), 0);
  const totalDebito = rows.reduce((s, r) => s + (r.debito ?? 0), 0);

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
        <Link href="/admin" className="text-xs text-brand underline">Importar más →</Link>
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

      {/* Period continuity validation */}
      {gaps.length === 0 ? (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-6 text-sm text-green-700">
          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
          Continuidad de saldos OK — el saldo final de cada período coincide con el saldo inicial del siguiente
        </div>
      ) : (
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 mb-6 text-sm text-orange-700 space-y-1">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 text-orange-500 shrink-0" />
            {gaps.length} corte{gaps.length > 1 ? "s" : ""} de continuidad entre períodos
          </div>
          {gaps.map((g) => (
            <p key={g.fecha} className="ml-6 text-xs">
              {g.fecha}: saldo anterior declarado {formatUYU(g.recibido)} ≠ último saldo previo {formatUYU(g.esperado)}
              {" "}({g.diff > 0 ? "+" : ""}{formatUYU(g.diff)})
            </p>
          ))}
        </div>
      )}

      <BankStatementTable rows={withCheck} />
    </div>
  );
}
