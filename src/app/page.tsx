import Link from "next/link";
import { createServerClient } from "@/lib/supabase";
import { Card, CardHeader, CardTitle, CardValue, CardContent } from "@/components/ui/card";
import { formatUYU, monthName } from "@/lib/utils";
import { DashboardChart } from "@/components/dashboard/chart";
import { AlertCircle, AlertTriangle, Upload } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard | Dilusso Joyas" };

interface TrendItem { label: string; negocio: number; personal: number }

interface BSRow {
  tipo: string | null;
  debito: number | null;
  credito: number | null;
  importe_uyu: number | null;
  moneda: string;
  fecha: string;
}

function rowImporteUYU(r: BSRow): number {
  if (r.moneda === "USD") return Math.abs(r.importe_uyu ?? 0);
  return (r.debito ?? 0) + (r.credito ?? 0);
}

async function getStats() {
  const sb = createServerClient();
  const now = new Date();
  const mes = now.getMonth() + 1;
  const año = now.getFullYear();
  const mesStr = String(mes).padStart(2, "0");
  const fechaDesde = `${año}-${mesStr}-01`;
  const fechaHasta = mes === 12 ? `${año + 1}-01-01` : `${año}-${String(mes + 1).padStart(2, "0")}-01`;

  const PAGE = 1000;

  async function fetchAll(opts: { desde?: string; hasta?: string; order?: boolean }): Promise<BSRow[]> {
    let all: BSRow[] = [];
    let from = 0;
    while (true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (sb.from("bank_statements") as any)
        .select("tipo,debito,credito,importe_uyu,moneda,fecha")
        .neq("descripcion", "Saldo anterior")
        .neq("tipo", "traspaso");
      if (opts.desde) q = q.gte("fecha", opts.desde);
      if (opts.hasta) q = q.lt("fecha", opts.hasta);
      if (opts.order) q = q.order("fecha", { ascending: true });
      const { data } = await q.range(from, from + PAGE - 1);
      if (!data || data.length === 0) break;
      all = all.concat(data as BSRow[]);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  }

  const [thisMonth, trendRows, unclRes, tcRes, settlRes] = await Promise.all([
    fetchAll({ desde: fechaDesde, hasta: fechaHasta }),
    fetchAll({ desde: `${año - 1}-${mesStr}-01`, order: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from("bank_statements") as any).select("id", { count: "exact", head: true }).eq("clasificado", "No").neq("descripcion", "Saldo anterior").neq("tipo", "traspaso"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from("exchange_rates") as any).select("rate, date").order("date", { ascending: false }).limit(1).single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from("settlements") as any).select("facturado").eq("año", año).eq("mes", mes),
  ]);

  const negocioSalidas = thisMonth.filter(r => r.tipo === "negocio" && (r.debito ?? 0) > 0).reduce((s, r) => s + rowImporteUYU(r), 0);
  const negocioIngresos = thisMonth.filter(r => r.tipo === "negocio" && (r.credito ?? 0) > 0).reduce((s, r) => s + rowImporteUYU(r), 0);
  const personalSalidas = thisMonth.filter(r => r.tipo === "personal" && (r.debito ?? 0) > 0).reduce((s, r) => s + rowImporteUYU(r), 0);
  const unclassifiedCount = (unclRes.count ?? 0) as number;
  const latestTC = ((tcRes.data as { rate: number } | null)?.rate ?? 0);
  const facturado = ((settlRes.data ?? []) as { facturado: number | null }[]).reduce((s, r) => s + (r.facturado ?? 0), 0);

  const trend = buildTrend(trendRows, 6);

  return { negocioSalidas, negocioIngresos, personalSalidas, facturado, unclassifiedCount, latestTC, mes, año, trend };
}

function buildTrend(rows: BSRow[], months: number): TrendItem[] {
  const map = new Map<string, { negocio: number; personal: number }>();
  for (const r of rows) {
    const ym = r.fecha.slice(0, 7);
    if (!map.has(ym)) map.set(ym, { negocio: 0, personal: 0 });
    const entry = map.get(ym)!;
    const amt = rowImporteUYU(r);
    if ((r.debito ?? 0) > 0) {
      if (r.tipo === "negocio") entry.negocio += amt;
      else if (r.tipo === "personal") entry.personal += amt;
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-months)
    .map(([key, val]) => {
      const [y, m] = key.split("-");
      return { label: `${monthName(parseInt(m))} ${y}`, negocio: val.negocio, personal: val.personal };
    });
}

export default async function DashboardPage() {
  const stats = await getStats();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">{monthName(stats.mes)} {stats.año}</p>
        </div>
        <div className="text-sm text-slate-500 flex items-center gap-3">
          <Link href="/admin" className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors">
            <Upload className="w-3.5 h-3.5" />
            Importar datos
          </Link>
          {stats.latestTC === 0 ? (
            <Link href="/tc" className="flex items-center gap-1.5 text-orange-600 hover:text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors">
              <AlertTriangle className="w-3.5 h-3.5" />
              TC no configurado — configurar
            </Link>
          ) : (
            <Link href="/tc" className="hover:text-slate-700 transition-colors">
              TC USD/UYU: <span className="font-semibold text-slate-900">{stats.latestTC.toFixed(3)}</span>
            </Link>
          )}
        </div>
      </div>

      {stats.unclassifiedCount > 0 && (
        <Link href="/sin-conciliar" className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 flex items-center gap-3 hover:bg-yellow-100 transition-colors">
          <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0" />
          <span className="text-yellow-800 text-sm font-medium">{stats.unclassifiedCount} movimientos sin clasificar</span>
          <span className="text-yellow-600 text-sm underline ml-auto">Revisar ahora →</span>
        </Link>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link href="/liquidaciones" className="block hover:scale-[1.02] transition-transform">
          <Card>
            <CardHeader>
              <CardTitle>Facturado (mes)</CardTitle>
              <CardValue>{formatUYU(stats.facturado)}</CardValue>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/negocio" className="block hover:scale-[1.02] transition-transform">
          <Card>
            <CardHeader>
              <CardTitle>Gastos negocio</CardTitle>
              <CardValue className="text-red-600">{formatUYU(stats.negocioSalidas)}</CardValue>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/personal" className="block hover:scale-[1.02] transition-transform">
          <Card>
            <CardHeader>
              <CardTitle>Gastos personales</CardTitle>
              <CardValue className="text-orange-600">{formatUYU(stats.personalSalidas)}</CardValue>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/negocio" className="block hover:scale-[1.02] transition-transform">
          <Card>
            <CardHeader>
              <CardTitle>Ingresos negocio</CardTitle>
              <CardValue className="text-green-600">{formatUYU(stats.negocioIngresos)}</CardValue>
            </CardHeader>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gastos por mes (últimos 6 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.trend.length > 0 ? (
            <DashboardChart data={stats.trend} />
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <p className="text-sm">Sin datos aún</p>
              <Link href="/admin" className="text-xs text-brand underline mt-1">Importar extractos →</Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
