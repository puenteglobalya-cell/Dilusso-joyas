import Link from "next/link";
import { createServerClient } from "@/lib/supabase";
import { formatUYU, monthName } from "@/lib/utils";
import { AlertCircle, AlertTriangle, Upload } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard | Dilusso Joyas" };

interface TrendItem { label: string; negocio: number; personal: number; ingresos: number }

interface BSRow {
  tipo: string | null;
  debito: number | null;
  credito: number | null;
  importe_uyu: number | null;
  moneda: string;
  fecha: string;
}

interface SaldoRow {
  banco: string;
  moneda: string;
  saldo: number;
  fecha: string;
  importe_uyu: number | null;
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

  const [thisMonth, trendRows, unclRes, tcRes, settlRes, saldosRes] = await Promise.all([
    fetchAll({ desde: fechaDesde, hasta: fechaHasta }),
    fetchAll({ desde: `${año - 1}-${mesStr}-01`, order: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from("bank_statements") as any).select("id", { count: "exact", head: true }).eq("clasificado", "No").neq("descripcion", "Saldo anterior").neq("tipo", "traspaso"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from("exchange_rates") as any).select("rate, date").order("date", { ascending: false }).limit(1).single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from("settlements") as any).select("facturado").eq("año", año).eq("mes", mes),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from("bank_statements") as any)
      .select("banco,moneda,saldo,fecha,importe_uyu")
      .not("saldo", "is", null)
      .neq("descripcion", "Saldo anterior")
      .order("fecha", { ascending: false })
      .order("id", { ascending: false })
      .limit(200),
  ]);

  const negocioSalidas = thisMonth.filter(r => r.tipo === "negocio" && (r.debito ?? 0) > 0).reduce((s, r) => s + rowImporteUYU(r), 0);
  const negocioIngresos = thisMonth.filter(r => r.tipo === "negocio" && (r.credito ?? 0) > 0).reduce((s, r) => s + rowImporteUYU(r), 0);
  const personalSalidas = thisMonth.filter(r => r.tipo === "personal" && (r.debito ?? 0) > 0).reduce((s, r) => s + rowImporteUYU(r), 0);
  const personalIngresos = thisMonth.filter(r => r.tipo === "personal" && (r.credito ?? 0) > 0).reduce((s, r) => s + rowImporteUYU(r), 0);
  const unclassifiedCount = (unclRes.count ?? 0) as number;
  const latestTC = ((tcRes.data as { rate: number } | null)?.rate ?? 0);
  const facturado = ((settlRes.data ?? []) as { facturado: number | null }[]).reduce((s, r) => s + (r.facturado ?? 0), 0);

  const trend = buildTrend(trendRows, 6);
  const resultado = negocioIngresos - negocioSalidas;

  // Per-category detail for KpiCards
  interface BSRowFull extends BSRow { categoria_negocio?: string | null; categoria_personal?: string | null }
  const negocioGastosDetail = Object.entries(
    (thisMonth as BSRowFull[]).filter(r => r.tipo === "negocio" && (r.debito ?? 0) > 0 && r.categoria_negocio)
      .reduce<Record<string, number>>((a, r) => { a[r.categoria_negocio!] = (a[r.categoria_negocio!] ?? 0) + rowImporteUYU(r); return a; }, {})
  ).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

  const personalGastosDetail = Object.entries(
    (thisMonth as BSRowFull[]).filter(r => r.tipo === "personal" && (r.debito ?? 0) > 0 && r.categoria_personal)
      .reduce<Record<string, number>>((a, r) => { a[r.categoria_personal!] = (a[r.categoria_personal!] ?? 0) + rowImporteUYU(r); return a; }, {})
  ).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

  const negocioIngDetail = Object.entries(
    (thisMonth as BSRowFull[]).filter(r => r.tipo === "negocio" && (r.credito ?? 0) > 0 && r.categoria_negocio)
      .reduce<Record<string, number>>((a, r) => { a[r.categoria_negocio!] = (a[r.categoria_negocio!] ?? 0) + rowImporteUYU(r); return a; }, {})
  ).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

  const trendResultado = trend.map(t => ({ label: t.label, value: t.ingresos - t.negocio - t.personal }));

  // Latest saldo per banco+moneda
  const saldoRows = (saldosRes.data ?? []) as SaldoRow[];
  const seen = new Set<string>();
  const saldos: { banco: string; moneda: string; saldo: number; fecha: string; saldoUYU: number }[] = [];
  for (const r of saldoRows) {
    const key = `${r.banco}|${r.moneda}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const saldoUYU = r.moneda === "USD" ? Math.abs(r.saldo) * (latestTC || 1) : r.saldo;
    saldos.push({ banco: r.banco, moneda: r.moneda, saldo: r.saldo, fecha: r.fecha, saldoUYU });
  }

  return { negocioSalidas, negocioIngresos, personalSalidas, personalIngresos, resultado, facturado, unclassifiedCount, latestTC, mes, año, trend, negocioGastosDetail, personalGastosDetail, negocioIngDetail, trendResultado, saldos };
}

function buildTrend(rows: BSRow[], months: number): TrendItem[] {
  const map = new Map<string, { negocio: number; personal: number; ingresos: number }>();
  for (const r of rows) {
    const ym = r.fecha.slice(0, 7);
    if (!map.has(ym)) map.set(ym, { negocio: 0, personal: 0, ingresos: 0 });
    const entry = map.get(ym)!;
    const amt = rowImporteUYU(r);
    if ((r.debito ?? 0) > 0) {
      if (r.tipo === "negocio") entry.negocio += amt;
      else if (r.tipo === "personal") entry.personal += amt;
    }
    if ((r.credito ?? 0) > 0) {
      if (r.tipo === "negocio") entry.ingresos += amt;
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-months)
    .map(([key, val]) => {
      const [y, m] = key.split("-");
      return { label: `${monthName(parseInt(m))} ${y}`, negocio: val.negocio, personal: val.personal, ingresos: val.ingresos };
    });
}

export default async function DashboardPage() {
  const stats = await getStats();

  const negocioResultado = stats.negocioIngresos - stats.negocioSalidas;
  const personalResultado = stats.personalIngresos - stats.personalSalidas;

  return (
    <div className="p-6 max-w-7xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#2a1f1a" }}>{monthName(stats.mes)} {stats.año}</h1>
          <p className="text-sm mt-0.5" style={{ color: "#b5a49a" }}>Resumen del mes</p>
        </div>
        <div className="flex items-center gap-3">
          {stats.latestTC > 0 && (
            <Link href="/tc" className="text-xs px-3 py-1.5 rounded-lg transition-colors" style={{ background: "#f0ece6", color: "#7a6a60" }}>
              USD/UYU <span className="font-semibold" style={{ color: "#2a1f1a" }}>{stats.latestTC.toFixed(2)}</span>
            </Link>
          )}
          {stats.latestTC === 0 && (
            <Link href="/tc" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 border border-orange-200">
              <AlertTriangle className="w-3.5 h-3.5" />
              Configurar TC
            </Link>
          )}
          <Link href="/admin" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors" style={{ background: "#2a1f1a", color: "#f5f0eb" }}>
            <Upload className="w-3.5 h-3.5" />
            Importar
          </Link>
        </div>
      </div>

      {/* Alert */}
      {stats.unclassifiedCount > 0 && (
        <Link href="/sin-conciliar" className="mb-5 rounded-xl px-4 py-3 flex items-center gap-3 transition-colors block" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
          <AlertCircle className="w-4 h-4 shrink-0" style={{ color: "#946E61" }} />
          <span className="text-sm font-medium" style={{ color: "#2E2B2A" }}>{stats.unclassifiedCount} movimientos sin clasificar</span>
          <span className="text-sm underline ml-auto" style={{ color: "#946E61" }}>Revisar ahora →</span>
        </Link>
      )}

      {/* Coverage index (Kiyosaki-style) */}
      {stats.negocioIngresos > 0 && stats.personalSalidas > 0 && (() => {
        const cobertura = Math.round((stats.negocioIngresos / stats.personalSalidas) * 100);
        const ok = cobertura >= 100;
        return (
          <div className="mb-5 rounded-2xl p-4" style={{ background: ok ? "#EEF3EB" : "#F5EAE7", border: `1px solid ${ok ? "#D0DBC8" : "#E0C5BE"}` }}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: ok ? "#586E50" : "#946E61" }}>Tu Nivel de Cobertura</p>
                <p className="text-sm mt-0.5" style={{ color: "#2E2B2A" }}>
                  Este mes Di Lusso cubrió el <strong>{cobertura}%</strong> de tus gastos personales
                </p>
              </div>
              <p className="text-3xl font-bold tabular-nums" style={{ color: ok ? "#586E50" : "#946E61" }}>{cobertura}%</p>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: ok ? "#D0DBC8" : "#E0C5BE" }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(cobertura, 100)}%`, background: ok ? "#586E50" : "#946E61" }} />
            </div>
          </div>
        );
      })()}

      {/* Two-column: Negocio | Personal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

        {/* NEGOCIO */}
        <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #E6E1DA", borderLeft: "4px solid #C5A059" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8C857B" }}>Di Lusso · Negocio</p>
              <p className="text-xs mt-0.5" style={{ color: "#A3907A" }}>{monthName(stats.mes)} {stats.año}</p>
            </div>
            <Link href="/negocio" className="text-xs px-2.5 py-1 rounded-lg" style={{ color: "#C5A059", background: "#F5F0E8" }}>
              Ver todo →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl p-3" style={{ background: "#EEF3EB" }}>
              <p className="text-[10px] font-medium mb-1" style={{ color: "#586E50" }}>Lo que entró</p>
              <p className="text-base font-bold" style={{ color: "#586E50" }}>{formatUYU(stats.negocioIngresos)}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: "#F5EAE7" }}>
              <p className="text-[10px] font-medium mb-1" style={{ color: "#946E61" }}>Lo que se gastó</p>
              <p className="text-base font-bold" style={{ color: "#946E61" }}>{formatUYU(stats.negocioSalidas)}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: negocioResultado >= 0 ? "#EEF3EB" : "#F5EAE7" }}>
              <p className="text-[10px] font-medium mb-1" style={{ color: "#8C857B" }}>Te quedó</p>
              <p className="text-base font-bold" style={{ color: negocioResultado >= 0 ? "#586E50" : "#946E61" }}>{formatUYU(negocioResultado)}</p>
            </div>
          </div>
          {stats.facturado > 0 && (
            <div className="rounded-xl px-3 py-2 flex items-center justify-between" style={{ background: "#F5F0E8", border: "1px solid #E6E1DA" }}>
              <p className="text-xs" style={{ color: "#8C857B" }}>Facturado</p>
              <Link href="/liquidaciones" className="text-sm font-semibold" style={{ color: "#C5A059" }}>{formatUYU(stats.facturado)}</Link>
            </div>
          )}
          {stats.negocioGastosDetail.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "#A3907A" }}>Top gastos</p>
              <div className="space-y-1.5">
                {stats.negocioGastosDetail.slice(0, 4).map(d => (
                  <div key={d.label} className="flex items-center justify-between">
                    <span className="text-xs truncate pr-2" style={{ color: "#2E2B2A" }}>{d.label}</span>
                    <span className="text-xs font-medium tabular-nums" style={{ color: "#946E61" }}>{formatUYU(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* PERSONAL */}
        <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #E6E1DA", borderLeft: "4px solid #A3907A" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8C857B" }}>Cecilia · Personal</p>
              <p className="text-xs mt-0.5" style={{ color: "#A3907A" }}>{monthName(stats.mes)} {stats.año}</p>
            </div>
            <Link href="/personal" className="text-xs px-2.5 py-1 rounded-lg" style={{ color: "#C5A059", background: "#F5F0E8" }}>
              Ver todo →
            </Link>
          </div>
          {stats.personalSalidas === 0 && stats.personalIngresos === 0 ? (
            <div className="rounded-xl px-4 py-6 text-center" style={{ background: "#FCFBFA", border: "1px solid #E6E1DA" }}>
              <p className="text-sm" style={{ color: "#8C857B" }}>Sin extracto cargado para este mes</p>
              <Link href="/admin" className="text-xs mt-1 inline-block font-medium" style={{ color: "#C5A059" }}>Importar →</Link>
            </div>
          ) : (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl p-3" style={{ background: "#EEF3EB" }}>
              <p className="text-[10px] font-medium mb-1" style={{ color: "#586E50" }}>Lo que entró</p>
              <p className="text-base font-bold" style={{ color: "#586E50" }}>{formatUYU(stats.personalIngresos)}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: "#F5EAE7" }}>
              <p className="text-[10px] font-medium mb-1" style={{ color: "#946E61" }}>Lo que se gastó</p>
              <p className="text-base font-bold" style={{ color: "#946E61" }}>{formatUYU(stats.personalSalidas)}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: personalResultado >= 0 ? "#EEF3EB" : "#F5EAE7" }}>
              <p className="text-[10px] font-medium mb-1" style={{ color: "#8C857B" }}>Neto</p>
              <p className="text-base font-bold" style={{ color: personalResultado >= 0 ? "#586E50" : "#946E61" }}>{formatUYU(personalResultado)}</p>
            </div>
          </div>
          )}
          {stats.personalGastosDetail.length > 0 && stats.personalSalidas > 0 && (
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "#A3907A" }}>Top gastos</p>
              <div className="space-y-1.5">
                {stats.personalGastosDetail.slice(0, 4).map(d => (
                  <div key={d.label} className="flex items-center justify-between">
                    <span className="text-xs truncate pr-2" style={{ color: "#2E2B2A" }}>{d.label}</span>
                    <span className="text-xs font-medium tabular-nums" style={{ color: "#946E61" }}>{formatUYU(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bank balances */}
      {stats.saldos.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#8C857B" }}>Saldos bancarios</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {stats.saldos.map(s => (
              <div key={`${s.banco}|${s.moneda}`} className="bg-white rounded-xl p-4" style={{ border: "1px solid #E6E1DA", borderLeft: "3px solid #C5A059" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold" style={{ color: "#2E2B2A" }}>{s.banco}</p>
                  {s.moneda === "USD" && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#F5F0E8", color: "#A3907A" }}>USD</span>
                  )}
                </div>
                <p className="text-base font-bold tabular-nums" style={{ color: "#2E2B2A" }}>
                  {s.moneda === "USD"
                    ? `U$S ${s.saldo.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                    : `$ ${s.saldo.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                  }
                </p>
                {s.moneda === "USD" && stats.latestTC > 0 && (
                  <p className="text-[10px] mt-0.5 tabular-nums" style={{ color: "#8C857B" }}>
                    ≈ $ {s.saldoUYU.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                )}
                <p className="text-[10px] mt-1.5" style={{ color: "#A3907A" }}>
                  {monthName(parseInt(s.fecha.slice(5, 7)))} {s.fecha.slice(0, 4)}
                </p>
              </div>
            ))}
            <Link href="/asientos" className="bg-white rounded-xl p-4 flex flex-col justify-center items-center gap-1 hover:border-[#C5A059] transition-colors" style={{ border: "1px dashed #E6E1DA" }}>
              <p className="text-xs text-center" style={{ color: "#A3907A" }}>+ Efectivo / otros activos</p>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
