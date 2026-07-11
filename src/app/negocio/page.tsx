import { createServerClient } from "@/lib/supabase";
import { formatUYU, monthName } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TransactionFilters } from "@/components/transactions/filters";
import { NegocioTrendChart } from "@/components/negocio/trend-chart";
import { DrillableHeatmap, DrillableChart } from "@/components/CategoryDrilldown";
import { ExportButtons } from "@/components/ExportButtons";
import { TxTable } from "@/components/TxTable";
import { KpiCard } from "@/components/ui/KpiDrawer";
import { PeriodToggle } from "@/components/PeriodToggle";

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

const TODAY_DATE = new Date();

export default async function NegocioPage({ searchParams }: Props) {
  const sp = await searchParams;
  const sb = createServerClient();
  const mesFilter = sp.mes ? parseInt(sp.mes) : null;
  const añoFilter = sp.año ? parseInt(sp.año) : TODAY_DATE.getFullYear();
  const periodo = sp.periodo ?? "12m";

  // Build date range based on periodo toggle or explicit mes/año filters
  let fechaDesde: string;
  let fechaHasta: string;
  let periodLabel: string;

  if (mesFilter) {
    const m = String(mesFilter).padStart(2, "0");
    fechaDesde = `${añoFilter}-${m}-01`;
    const nextM = mesFilter === 12 ? 1 : mesFilter + 1;
    const nextY = mesFilter === 12 ? añoFilter + 1 : añoFilter;
    fechaHasta = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
    periodLabel = `${monthName(mesFilter)} ${añoFilter}`;
  } else if (periodo === "año") {
    fechaDesde = `${añoFilter}-01-01`;
    fechaHasta = `${añoFilter + 1}-01-01`;
    periodLabel = `Año ${añoFilter}`;
  } else {
    // Default: last 12 months
    const y = TODAY_DATE.getFullYear();
    const m = TODAY_DATE.getMonth() + 1;
    const fromY = m === 12 ? y : y - 1;
    const fromM = m === 12 ? 12 : m;
    fechaDesde = `${fromY}-${String(fromM).padStart(2, "0")}-01`;
    fechaHasta = `${y + 1}-01-01`;
    periodLabel = "Últimos 12 meses";
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

  const [txs, trendRows] = await Promise.all([
    fetchBS(fechaDesde, fechaHasta),
    fetchBS(fechaDesde, fechaHasta),
  ]);

  // Débitos que son traspasos internos (caja→banco, etc.) — no son gastos reales
  const IGNORAR_DEBITOS = new Set([
    "Traspaso", "traspaso", "TRASPASO",
    "Venta efectivo",  // cierre de caja = traspaso efectivo→banco, no gasto
  ]);

  const ingresos = txs.filter(r => (r.credito ?? 0) > 0).reduce((s, r) => s + rowImporteUYU(r), 0);
  const egresos = txs.filter(r => (r.debito ?? 0) > 0 && !IGNORAR_DEBITOS.has(r.categoria_negocio ?? "")).reduce((s, r) => s + rowImporteUYU(r), 0);
  const resultado = ingresos - egresos;
  const margenNeto = pct(resultado, ingresos);

  const IGNORAR_CATS = IGNORAR_DEBITOS;

  const byCategory = txs
    .filter(r => (r.debito ?? 0) > 0 && r.categoria_negocio && !IGNORAR_CATS.has(r.categoria_negocio))
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

  // Heatmap: category × month (egresses only, negocio) — exclude traspasos y venta efectivo
  const heatCats = Object.keys(byCategory).sort((a, b) => byCategory[b] - byCategory[a]).slice(0, 12);
  const heatMonths = Array.from(new Set(trendRows.map(r => r.fecha.slice(0, 7)))).sort().slice(-12);
  const heatMap: Record<string, Record<string, number>> = {};
  for (const r of trendRows) {
    if ((r.debito ?? 0) <= 0 || !r.categoria_negocio) continue;
    if (IGNORAR_CATS.has(r.categoria_negocio)) continue;
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
    else if (!IGNORAR_CATS.has(r.categoria_negocio ?? "")) entry.egresos += amt;
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

  const txTableRows = txs.map(r => ({
    id: r.id,
    banco: r.banco,
    fecha: r.fecha,
    descripcion: r.descripcion,
    debito: r.debito,
    credito: r.credito,
    importe_uyu: r.importe_uyu,
    moneda: r.moneda,
    categoria: r.categoria_negocio,
    nota: r.nota,
  }));

  return (
    <div className="p-8 max-w-7xl">

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#2E2B2A" }}>Negocio</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8C857B" }}>{periodLabel} · {txs.length} movimientos</p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodToggle />
          <ExportButtons params={{ tipo: "negocio", año: String(añoFilter), ...(mesFilter ? { mes: String(mesFilter) } : {}) }} />
        </div>
      </div>

      <div className="mb-8">
        <TransactionFilters />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-5 mb-8">
        <KpiCard title="Lo que entró" value={formatUYU(ingresos)} valueColor="#586E50"
          detail={ingresosDetail.length > 0 ? ingresosDetail : undefined} detailTitle="Ingresos por categoría" />
        <KpiCard title="Lo que se gastó" value={formatUYU(egresos)} valueColor="#946E61"
          detail={allCatDetail} detailTitle="Gastos por categoría" />
        <KpiCard title="Te quedó" value={formatUYU(resultado)}
          valueColor={resultado >= 0 ? "#586E50" : "#946E61"}
          detail={trend12Detail.length > 1 ? trend12Detail : undefined} detailTitle="Resultado por mes" />
        <KpiCard title="Margen neto" value={`${margenNeto.toFixed(1)}%`}
          valueColor={margenNeto >= 0 ? "#586E50" : "#946E61"}
          detail={trend12.slice().reverse().map(m => ({ label: m.label, value: m.margenNeto, pct: Math.max(0, m.margenNeto) }))}
          detailTitle="Margen neto por mes" />
        <KpiCard title="Top gasto" value={categoryData[0]?.name ?? "—"}
          valueColor="#2E2B2A"
          detail={allCatDetail} detailTitle="Todos los gastos" />
      </div>

      {/* Trend chart + monthly table side by side */}
      {trend12.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold" style={{ color: "#8C857B" }}>{periodLabel} — Ingresos vs Egresos</CardTitle>
            </CardHeader>
            <CardContent>
              <NegocioTrendChart data={trend12} />
            </CardContent>
          </Card>

          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E6E1DA" }}>
            <div className="px-4 py-3 border-b" style={{ background: "#FCFBFA", borderColor: "#E6E1DA" }}>
              <p className="text-sm font-semibold" style={{ color: "#8C857B" }}>Por mes</p>
            </div>
            <div className="overflow-y-auto max-h-[300px]">
              <table className="w-full text-xs">
                <thead className="border-b sticky top-0 bg-white" style={{ borderColor: "#E6E1DA" }}>
                  <tr>
                    <th className="text-left px-3 py-2 font-medium" style={{ color: "#8C857B" }}>Mes</th>
                    <th className="text-right px-3 py-2 font-medium" style={{ color: "#8C857B" }}>Ingresos</th>
                    <th className="text-right px-3 py-2 font-medium" style={{ color: "#8C857B" }}>Egresos</th>
                    <th className="text-right px-3 py-2 font-medium" style={{ color: "#8C857B" }}>Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {tableMonths.map((m) => (
                    <tr key={m.label} className="border-b" style={{ borderColor: "#E6E1DA" }}>
                      <td className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: "#2E2B2A" }}>{m.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#586E50" }}>{formatUYU(m.ingresos)}</td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#946E61" }}>{formatUYU(m.egresos)}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums" style={{ color: m.margenNeto >= 0 ? "#586E50" : "#946E61" }}>
                        {m.margenNeto.toFixed(0)}%
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {heatCats.length > 0 && heatMonths.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-sm font-semibold" style={{ color: "#8C857B" }}>Gastos por categoría × mes</CardTitle>
              </CardHeader>
              <CardContent>
                <DrillableHeatmap cats={heatCats} months={heatMonths} data={heatMap} tipo="negocio" />
              </CardContent>
            </Card>
          )}
          {categoryData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-sm font-semibold" style={{ color: "#8C857B" }}>Gastos por categoría — período</CardTitle>
              </CardHeader>
              <CardContent>
                <DrillableChart data={categoryData} tipo="negocio" />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Transactions */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: "#2E2B2A" }}>Movimientos</p>
        <span className="text-xs" style={{ color: "#8C857B" }}>{txs.length} registros</span>
      </div>
      <TxTable
        rows={txTableRows}
        emptyMessage="Sin movimientos clasificados como negocio para este período"
        emptyLink={{ href: "/extractos", label: "Ir a extractos →" }}
      />
    </div>
  );
}
