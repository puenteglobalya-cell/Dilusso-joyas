import Link from "next/link";
import { createServerClient } from "@/lib/supabase";
import { formatUYU, formatDate, monthName } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardValue, CardContent } from "@/components/ui/card";
import { TransactionFilters } from "@/components/transactions/filters";
import { ExportButton } from "@/components/transactions/export-button";
import { NegocioChart } from "@/components/negocio/chart";
import { NegocioTrendChart } from "@/components/negocio/trend-chart";
import type { Transaction } from "@/lib/database.types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Negocio | Dilusso Joyas" };

interface Props {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

function pct(num: number, den: number): number {
  return den === 0 ? 0 : Math.round((num / den) * 1000) / 10;
}

export default async function NegocioPage({ searchParams }: Props) {
  const sp = await searchParams;
  const sb = createServerClient();
  const mesFilter = sp.mes ? parseInt(sp.mes) : null;
  const añoFilter = sp.año ? parseInt(sp.año) : new Date().getFullYear();

  // ── Datos del período seleccionado ──────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (sb.from("transactions") as any)
    .select("*")
    .eq("tipo", "negocio")
    .order("fecha", { ascending: false })
    .limit(500);
  if (añoFilter) query = query.eq("año", añoFilter);
  if (mesFilter) query = query.eq("mes", mesFilter);

  // ── Últimos 12 meses para tendencia ─────────────────────────────────────
  const now = new Date();
  const fromAño = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear() - 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trendQuery = (sb.from("transactions") as any)
    .select("movimiento, importe_uyu, mes, año")
    .eq("tipo", "negocio")
    .gte("año", fromAño)
    .order("año", { ascending: true })
    .order("mes", { ascending: true });

  const [{ data }, { data: trendData }] = await Promise.all([query, trendQuery]);

  const txs = (data ?? []) as Transaction[];
  const trendTxs = (trendData ?? []) as Pick<Transaction, "movimiento" | "importe_uyu" | "mes" | "año">[];

  // ── Métricas del período ─────────────────────────────────────────────────
  const ingresos = txs.filter((t) => t.movimiento === "ingreso").reduce((s, t) => s + (t.importe_uyu ?? 0), 0);
  const egresos = txs.filter((t) => t.movimiento === "salida").reduce((s, t) => s + (t.importe_uyu ?? 0), 0);
  const resultado = ingresos - egresos;
  const margenNeto = pct(resultado, ingresos);

  // EBITDA aproximado: resultado operativo (sin separar depreciación/intereses por falta de dato)
  const ebitda = resultado;
  const margenEbitda = pct(ebitda, ingresos);

  // Punto de equilibrio: gastos fijos / (1 - gastos_variables / ingresos)
  // Sin clasificación fijo/variable, se muestra el total de egresos como referencia
  const puntoEquilibrio = ingresos > 0 ? egresos : null;

  // ── Gastos por categoría ─────────────────────────────────────────────────
  const byCategory = txs
    .filter((t) => t.movimiento === "salida" && t.categoria)
    .reduce<Record<string, number>>((acc, t) => {
      acc[t.categoria!] = (acc[t.categoria!] ?? 0) + (t.importe_uyu ?? 0);
      return acc;
    }, {});
  const categoryData = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));

  // ── Tendencia 12 meses ───────────────────────────────────────────────────
  const monthMap = new Map<string, { ingresos: number; egresos: number }>();
  for (const t of trendTxs) {
    if (!t.mes || !t.año) continue;
    const key = `${t.año}-${String(t.mes).padStart(2, "0")}`;
    if (!monthMap.has(key)) monthMap.set(key, { ingresos: 0, egresos: 0 });
    const entry = monthMap.get(key)!;
    if (t.movimiento === "ingreso") entry.ingresos += t.importe_uyu ?? 0;
    else entry.egresos += t.importe_uyu ?? 0;
  }
  const trend12 = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([key, val]) => {
      const [y, m] = key.split("-");
      const res = val.ingresos - val.egresos;
      return {
        label: `${monthName(parseInt(m)).slice(0, 3)} ${y.slice(2)}`,
        ingresos: val.ingresos,
        egresos: val.egresos,
        resultado: res,
        margenNeto: pct(res, val.ingresos),
      };
    });

  // ── Tabla mensual de los 12 meses ────────────────────────────────────────
  const tableMonths = trend12.slice().reverse();

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

      {/* KPIs del período */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Ingresos</CardTitle>
            <CardValue className="text-green-600">{formatUYU(ingresos)}</CardValue>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Egresos</CardTitle>
            <CardValue className="text-red-600">{formatUYU(egresos)}</CardValue>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Resultado neto</CardTitle>
            <CardValue className={resultado >= 0 ? "text-green-600" : "text-red-600"}>{formatUYU(resultado)}</CardValue>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Margen EBITDA</CardTitle>
            <CardValue className={margenEbitda >= 0 ? "text-green-600" : "text-red-600"}>{margenEbitda.toFixed(1)}%</CardValue>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Margen neto</CardTitle>
            <CardValue className={margenNeto >= 0 ? "text-green-600" : "text-red-600"}>{margenNeto.toFixed(1)}%</CardValue>
          </CardHeader>
        </Card>
      </div>

      {/* Gráfico 12 meses */}
      {trend12.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Últimos 12 meses — Ingresos vs Egresos y Margen neto</CardTitle>
          </CardHeader>
          <CardContent>
            <NegocioTrendChart data={trend12} />
          </CardContent>
        </Card>
      )}

      {/* Tabla de métricas por mes */}
      {tableMonths.length > 0 && (
        <div className="bg-white rounded-xl border overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Mes</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Ingresos</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Egresos</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Resultado</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Margen neto</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Punto de eq.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableMonths.map((m) => {
                const peq = m.ingresos > 0 ? m.egresos : null;
                return (
                  <tr key={m.label} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{m.label}</td>
                    <td className="px-4 py-3 text-right text-green-600">{formatUYU(m.ingresos)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{formatUYU(m.egresos)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${m.resultado >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatUYU(m.resultado)}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${m.margenNeto >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {m.margenNeto.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {peq != null ? formatUYU(peq) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Gastos por categoría */}
      {categoryData.length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Gastos por categoría — período seleccionado</CardTitle></CardHeader>
          <CardContent><NegocioChart data={categoryData} /></CardContent>
        </Card>
      )}

      {/* Detalle transacciones */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">Transacciones del período</p>
          {puntoEquilibrio != null && (
            <p className="text-xs text-slate-500">
              Punto de equilibrio: <span className="font-semibold text-slate-700">{formatUYU(puntoEquilibrio)}</span>
            </p>
          )}
        </div>
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
            {!txs.length && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                  <p className="font-medium text-slate-500 mb-1">Sin transacciones para este período</p>
                  <Link href="/admin" className="text-xs text-brand underline">Importar Excel maestro →</Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
