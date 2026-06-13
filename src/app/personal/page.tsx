import { createServerClient } from "@/lib/supabase";
import { formatUYU, monthName } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/KpiDrawer";
import { TransactionFilters } from "@/components/transactions/filters";
import { DrillableChart, DrillableHeatmap } from "@/components/CategoryDrilldown";
import { ExportButtons } from "@/components/ExportButtons";
import { NegocioTrendChart } from "@/components/negocio/trend-chart";
import { TxTable } from "@/components/TxTable";

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
  nota: string | null;
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

  const now = new Date();
  const isCurrentYear = añoFilter === now.getFullYear() && !sp.año;
  const trendDesde = isCurrentYear
    ? `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
    : fechaDesde;
  const trendHasta = isCurrentYear ? `${now.getFullYear() + 1}-01-01` : fechaHasta;

  const PAGE = 1000;
  async function fetchBS(desde: string, hasta: string): Promise<BSRow[]> {
    let all: BSRow[] = [];
    let from = 0;
    while (true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (sb.from("bank_statements") as any)
        .select("id,banco,fecha,descripcion,debito,credito,importe_uyu,moneda,categoria_personal,nota")
        .eq("tipo", "personal")
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

  const [txs, trendRows] = await Promise.all([
    fetchBS(fechaDesde, fechaHasta),
    fetchBS(trendDesde, trendHasta),
  ]);

  const salidas = txs.filter(r => (r.debito ?? 0) > 0).reduce((s, r) => s + rowImporteUYU(r), 0);
  const ingresos = txs.filter(r => (r.credito ?? 0) > 0).reduce((s, r) => s + rowImporteUYU(r), 0);
  const resultado = ingresos - salidas;

  const byCategory = txs
    .filter(r => (r.debito ?? 0) > 0 && r.categoria_personal)
    .reduce<Record<string, number>>((acc, r) => {
      acc[r.categoria_personal!] = (acc[r.categoria_personal!] ?? 0) + rowImporteUYU(r);
      return acc;
    }, {});
  const categoryData = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }));
  const allCatDetail = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

  // Heatmap data (same as negocio)
  const heatCats = Object.keys(byCategory).sort((a, b) => byCategory[b] - byCategory[a]).slice(0, 12);
  const heatMonths = Array.from(new Set(trendRows.map(r => r.fecha.slice(0, 7)))).sort().slice(-12);
  const heatMap: Record<string, Record<string, number>> = {};
  for (const r of trendRows) {
    if ((r.debito ?? 0) <= 0 || !r.categoria_personal) continue;
    const ym = r.fecha.slice(0, 7);
    const cat = r.categoria_personal;
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
        margenNeto: 0,
      };
    });
  const trend12Detail = trend12.slice().reverse().map(m => ({ label: m.label, value: m.resultado }));
  const tableMonths = trend12.slice().reverse();

  const periodLabel = mesFilter
    ? `${monthName(mesFilter)} ${añoFilter}`
    : isCurrentYear ? "Últimos 12 meses" : String(añoFilter);

  const txTableRows = txs.map(r => ({
    id: r.id,
    banco: r.banco,
    fecha: r.fecha,
    descripcion: r.descripcion,
    debito: r.debito,
    credito: r.credito,
    importe_uyu: r.importe_uyu,
    moneda: r.moneda,
    categoria: r.categoria_personal,
    nota: r.nota,
  }));

  return (
    <div className="p-6 max-w-7xl">

      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#2a1f1a" }}>Movimientos de Cecilia</h1>
          <p className="text-sm mt-0.5" style={{ color: "#b5a49a" }}>{periodLabel} · {txs.length} movimientos</p>
        </div>
        <ExportButtons params={{ tipo: "personal", año: String(añoFilter), ...(mesFilter ? { mes: String(mesFilter) } : {}) }} />
      </div>

      <div className="mb-6">
        <TransactionFilters />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard
          title="Ingresos"
          value={formatUYU(ingresos)}
          valueClass="text-sky-700"
        />
        <KpiCard
          title="Gastos"
          value={formatUYU(salidas)}
          valueClass="text-rose-600"
          detail={allCatDetail}
          detailTitle="Gastos por categoría"
        />
        <KpiCard
          title="Neto"
          value={formatUYU(resultado)}
          valueClass={resultado >= 0 ? "text-sky-700" : "text-rose-600"}
          detail={trend12Detail.length > 1 ? trend12Detail : undefined}
          detailTitle="Neto por mes"
        />
      </div>

      {/* Trend chart + monthly table side by side */}
      {trend12.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-600">{isCurrentYear ? "Últimos 12 meses" : añoFilter} — Ingresos vs Gastos</CardTitle>
            </CardHeader>
            <CardContent>
              <NegocioTrendChart data={trend12} />
            </CardContent>
          </Card>

          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #ede9e4" }}>
            <div className="px-4 py-3 border-b" style={{ background: "#faf8f5", borderColor: "#ede9e4" }}>
              <p className="text-sm font-semibold" style={{ color: "#7a6a60" }}>Por mes</p>
            </div>
            <div className="overflow-y-auto max-h-[300px]">
              <table className="w-full text-xs">
                <tbody>
                  {tableMonths.map((m) => (
                    <tr key={m.label} className="border-b" style={{ borderColor: "#f5f0eb" }}>
                      <td className="px-4 py-2.5 font-medium whitespace-nowrap" style={{ color: "#5c4d45" }}>{m.label}</td>
                      <td className="px-4 py-2.5 text-right text-rose-500 tabular-nums">{formatUYU(m.egresos)}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${m.resultado >= 0 ? "text-sky-700" : "text-rose-600"}`}>
                        {formatUYU(m.resultado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Heatmap + category chart side by side */}
      {(heatCats.length > 0 || categoryData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {heatCats.length > 0 && heatMonths.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-600">Gastos por categoría × mes</CardTitle>
              </CardHeader>
              <CardContent>
                <DrillableHeatmap cats={heatCats} months={heatMonths} data={heatMap} tipo="personal" />
              </CardContent>
            </Card>
          )}
          {categoryData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-600">Gastos por categoría — período</CardTitle>
              </CardHeader>
              <CardContent>
                <DrillableChart data={categoryData} tipo="personal" />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Transactions */}
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: "#5c4d45" }}>Movimientos</p>
        <span className="text-xs" style={{ color: "#b5a49a" }}>{txs.length} registros</span>
      </div>
      <TxTable
        rows={txTableRows}
        emptyMessage="Sin movimientos clasificados como personal para este período"
        emptyLink={{ href: "/extractos", label: "Ir a extractos →" }}
      />
    </div>
  );
}
