import { createServerClient } from "@/lib/supabase";
import { Card, CardHeader, CardTitle, CardValue, CardContent } from "@/components/ui/card";
import { formatUYU, monthName } from "@/lib/utils";
import { DashboardChart } from "@/components/dashboard/chart";
import type { Transaction } from "@/lib/database.types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard | Dilusso Joyas" };

interface TrendItem { label: string; negocio: number; personal: number }

async function getStats() {
  const sb = createServerClient();
  const now = new Date();
  const mes = now.getMonth() + 1;
  const año = now.getFullYear();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [txRes, settlRes, unclRes, tcRes] = await Promise.all([
    (sb.from("transactions") as any).select("movimiento, tipo, importe_uyu, mes, año").eq("año", año).eq("mes", mes),
    (sb.from("settlements") as any).select("facturado").eq("año", año).eq("mes", mes),
    (sb.from("transactions") as any).select("id", { count: "exact" }).eq("clasificado", false),
    (sb.from("exchange_rates") as any).select("rate, date").order("date", { ascending: false }).limit(1).single(),
  ]);

  const transactions = (txRes.data ?? []) as Pick<Transaction, "movimiento" | "tipo" | "importe_uyu">[];
  const settlements = (settlRes.data ?? []) as { facturado: number | null }[];
  const unclassifiedCount = (unclRes.count ?? 0) as number;
  const latestTC = ((tcRes.data as { rate: number } | null)?.rate ?? 0);

  const negocioSalidas = transactions.filter((t) => t.tipo === "negocio" && t.movimiento === "salida").reduce((s, t) => s + (t.importe_uyu ?? 0), 0);
  const negocioIngresos = transactions.filter((t) => t.tipo === "negocio" && t.movimiento === "ingreso").reduce((s, t) => s + (t.importe_uyu ?? 0), 0);
  const personalSalidas = transactions.filter((t) => t.tipo === "personal" && t.movimiento === "salida").reduce((s, t) => s + (t.importe_uyu ?? 0), 0);
  const facturado = settlements.reduce((s, r) => s + (r.facturado ?? 0), 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trendRes = await (sb.from("transactions") as any)
    .select("movimiento, tipo, importe_uyu, mes, año")
    .gte("año", año - 1)
    .order("año", { ascending: true })
    .order("mes", { ascending: true });

  const trend = buildTrend((trendRes.data ?? []) as Pick<Transaction, "movimiento" | "tipo" | "importe_uyu" | "mes" | "año">[], 6);

  return { negocioSalidas, negocioIngresos, personalSalidas, facturado, unclassifiedCount, latestTC, mes, año, trend };
}

function buildTrend(
  rows: Pick<Transaction, "movimiento" | "tipo" | "importe_uyu" | "mes" | "año">[],
  months: number
): TrendItem[] {
  const map = new Map<string, { negocio: number; personal: number }>();
  for (const r of rows) {
    if (!r.mes || !r.año) continue;
    const key = `${r.año}-${String(r.mes).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, { negocio: 0, personal: 0 });
    const entry = map.get(key)!;
    if (r.movimiento === "salida") {
      if (r.tipo === "negocio") entry.negocio += r.importe_uyu ?? 0;
      else if (r.tipo === "personal") entry.personal += r.importe_uyu ?? 0;
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
        <div className="text-sm text-slate-500">
          TC USD/UYU: <span className="font-semibold text-slate-900">{stats.latestTC.toFixed(3)}</span>
        </div>
      </div>

      {stats.unclassifiedCount > 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <span className="text-yellow-600 font-semibold">{stats.unclassifiedCount}</span>
          <span className="text-yellow-800 text-sm">transacciones sin conciliar —</span>
          <a href="/sin-conciliar" className="text-yellow-700 underline text-sm font-medium">Revisar ahora</a>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Facturado (mes)</CardTitle>
            <CardValue>{formatUYU(stats.facturado)}</CardValue>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Gastos negocio</CardTitle>
            <CardValue className="text-red-600">{formatUYU(stats.negocioSalidas)}</CardValue>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Gastos personales</CardTitle>
            <CardValue className="text-orange-600">{formatUYU(stats.personalSalidas)}</CardValue>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ingresos negocio</CardTitle>
            <CardValue className="text-green-600">{formatUYU(stats.negocioIngresos)}</CardValue>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gastos por mes (últimos 6 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <DashboardChart data={stats.trend} />
        </CardContent>
      </Card>
    </div>
  );
}
