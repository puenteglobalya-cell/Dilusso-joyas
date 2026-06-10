import Link from "next/link";
import { createServerClient } from "@/lib/supabase";
import { formatUYU, formatDate, monthName } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TransactionFilters } from "@/components/transactions/filters";
import { NegocioChart } from "@/components/negocio/chart";
import { NegocioTrendChart } from "@/components/negocio/trend-chart";
import { NegocioHeatmap } from "@/components/negocio/heatmap";
import { NoteCell } from "@/components/bank/NoteCell";
import { KpiCard } from "@/components/ui/KpiDrawer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Negocio | Dilusso Joyas" };

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
  nota: string | null;
}

function rowImporteUYU(r: BSRow): number {
  if (r.moneda === "USD") return Math.abs(r.importe_uyu ?? 0);
  return (r.debito ?? 0) + (r.credito ?? 0);
}

function pct(num: number, den: number): number {
  return den === 0 ? 0 : Math.round((num / den) * 1000) / 10;
}

export default async function NegocioPage({ searchParams }: Props) {
  const sp = await searchParams;
  const sb = createServerClient();
  const mesFilter = sp.mes ? parseInt(sp.mes) : null;
  const añoFilter = sp.año ? parseInt(sp.año) : new Date().getFullYear();

  // Build date range for period filter
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
  async function fetchBS(desde: string, hasta: string): Promise<BSRow[]> {
    let all: BSRow[] = [];
    let from = 0;
    while (true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (sb.from("bank_statements") as any)
        .select("id,banco,fecha,descripcion,debito,credito,importe_uyu,moneda,tipo,categoria_negocio,categoria_personal,clasificado,nota")
        .eq("tipo", "negocio")
        .gte("fecha", desde)
        .lt("fecha", hasta)
        .neq("descripcion", "Saldo anterior")
        .order("fecha", { ascending: false })
        .range(from, from + PAGE - 1);
      if (!data || data.length === 0) break;
      all = all.concat(data as BSRow[]);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  }

  // Trend: if filtering by year (with or without month), use the filtered range;
  // otherwise (current year, no explicit año param) show last 12 months from today
  const now = new Date();
  const isCurrentYear = añoFilter === now.getFullYear() && !sp.año;
  const trendDesde = isCurrentYear
    ? `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
    : fechaDesde;
  const trendHasta = isCurrentYear
    ? `${now.getFullYear() + 1}-01-01`
    : fechaHasta;

  const [txs, trendRows] = await Promise.all([
    fetchBS(fechaDesde, fechaHasta),
    fetchBS(trendDesde, trendHasta),
  ]);

  const ingresos = txs.filter(r => (r.credito ?? 0) > 0).reduce((s, r) => s + rowImporteUYU(r), 0);
  const egresos = txs.filter(r => (r.debito ?? 0) > 0).reduce((s, r) => s + rowImporteUYU(r), 0);
  const resultado = ingresos - egresos;
  const margenNeto = pct(resultado, ingresos);

  const byCategory = txs
    .filter(r => (r.debito ?? 0) > 0 && r.categoria_negocio)
    .reduce<Record<string, number>>((acc, r) => {
      acc[r.categoria_negocio!] = (acc[r.categoria_negocio!] ?? 0) + rowImporteUYU(r);
      return acc;
    }, {});
  const categoryData = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
  const allCatDetail = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

  const byCategoryIngresos = txs
    .filter(r => (r.credito ?? 0) > 0 && r.categoria_negocio)
    .reduce<Record<string, number>>((acc, r) => {
      acc[r.categoria_negocio!] = (acc[r.categoria_negocio!] ?? 0) + rowImporteUYU(r);
      return acc;
    }, {});
  const ingresosDetail = Object.entries(byCategoryIngresos).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

  // Heatmap: category × month (egresses only, negocio)
  const heatCats = Object.keys(byCategory).sort((a, b) => byCategory[b] - byCategory[a]).slice(0, 12);
  const heatMonths = Array.from(new Set(trendRows.map(r => r.fecha.slice(0, 7)))).sort().slice(-12);
  const heatMap: Record<string, Record<string, number>> = {};
  for (const r of trendRows) {
    if ((r.debito ?? 0) <= 0 || !r.categoria_negocio) continue;
    const ym = r.fecha.slice(0, 7);
    const cat = r.categoria_negocio;
    if (!heatMap[cat]) heatMap[cat] = {};
    heatMap[cat][ym] = (heatMap[cat][ym] ?? 0) + rowImporteUYU(r);
  }

  const monthMap = new Map<string, { ingresos: number; egresos: number }>();
  for (const r of trendRows) {
    const ym = r.fecha.slice(0, 7);
    if (!monthMap.has(ym)) monthMap.set(ym, { ingresos: 0, egresos: 0 });
    const entry = monthMap.get(ym)!;
    const amt = rowImporteUYU(r);
    if ((r.credito ?? 0) > 0) entry.ingresos += amt;
    else entry.egresos += amt;
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

  const tableMonths = trend12.slice().reverse();
  const trend12Detail = trend12.slice().reverse().map(m => ({ label: m.label, value: m.resultado }));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Negocio</h1>
          <p className="text-sm text-slate-500 mt-1">Basado en extractos bancarios clasificados como negocio</p>
        </div>
      </div>

      <TransactionFilters />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <KpiCard
          title="Ingresos"
          value={formatUYU(ingresos)}
          valueClass="text-green-600"
          detail={ingresosDetail.length > 0 ? ingresosDetail : undefined}
          detailTitle="Ingresos por categoría"
        />
        <KpiCard
          title="Egresos"
          value={formatUYU(egresos)}
          valueClass="text-red-600"
          detail={allCatDetail}
          detailTitle="Gastos por categoría"
        />
        <KpiCard
          title="Resultado neto"
          value={formatUYU(resultado)}
          valueClass={resultado >= 0 ? "text-green-600" : "text-red-600"}
          detail={trend12Detail.length > 1 ? trend12Detail : undefined}
          detailTitle="Resultado por mes"
        />
        <KpiCard
          title="Margen neto"
          value={`${margenNeto.toFixed(1)}%`}
          valueClass={margenNeto >= 0 ? "text-green-600" : "text-red-600"}
          detail={trend12.slice().reverse().map(m => ({ label: m.label, value: m.margenNeto, pct: Math.max(0, m.margenNeto) }))}
          detailTitle="Margen neto por mes"
        />
        <KpiCard
          title="Top gasto"
          value={categoryData[0]?.name ?? "—"}
          valueClass="text-slate-800 text-base truncate"
          detail={allCatDetail}
          detailTitle="Todos los gastos por categoría"
        />
      </div>

      {trend12.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{isCurrentYear ? "Últimos 12 meses" : añoFilter} — Ingresos vs Egresos y Margen neto</CardTitle>
          </CardHeader>
          <CardContent>
            <NegocioTrendChart data={trend12} />
          </CardContent>
        </Card>
      )}

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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableMonths.map((m) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {heatCats.length > 0 && heatMonths.length > 1 && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Gastos por categoría × mes</CardTitle></CardHeader>
          <CardContent>
            <NegocioHeatmap cats={heatCats} months={heatMonths} data={heatMap} />
          </CardContent>
        </Card>
      )}

      {categoryData.length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Gastos por categoría — período seleccionado</CardTitle></CardHeader>
          <CardContent><NegocioChart data={categoryData} /></CardContent>
        </Card>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50">
          <p className="text-sm font-medium text-slate-700">Movimientos del período</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Fecha</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Banco</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Descripción</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Categoría</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500">Importe UYU</th>
              <th className="px-4 py-3 font-medium text-slate-500">Nota</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {txs.map((r) => {
              const esIngreso = (r.credito ?? 0) > 0;
              return (
                <tr key={r.id} className="group hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(r.fecha)}</td>
                  <td className="px-4 py-3 font-medium">{r.banco}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{r.descripcion ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{r.categoria_negocio ?? "—"}</td>
                  <td className={`px-4 py-3 text-right font-medium ${esIngreso ? "text-green-600" : "text-red-600"}`}>
                    {esIngreso ? "+" : "-"}{formatUYU(rowImporteUYU(r))}
                  </td>
                  <td className="px-4 py-3">
                    <NoteCell id={r.id} nota={r.nota} />
                  </td>
                </tr>
              );
            })}
            {!txs.length && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                  <p className="font-medium text-slate-500 mb-1">Sin movimientos clasificados como negocio para este período</p>
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
