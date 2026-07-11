import { createServerClient } from "@/lib/supabase";
import { formatUYU, monthName } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import type { Settlement } from "@/lib/database.types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Liquidaciones | Dilusso Joyas" };

interface Props {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

interface MonthRecon {
  año: number;
  mes: number;
  // Lado liquidación (lo que debería entrar al banco)
  tarjetaLiq: number;  // tarjeta de settlements
  fadavalLiq: number;  // fadaval de settlements
  efectivoLiq: number; // efectivo (referencia, no va al banco)
  // Lado banco (acreditaciones reales en extracto)
  tarjetaCob: number;  // bank_statements clasificado como tarjeta
  fadavalCob: number;  // bank_statements clasificado como fadaval
  ocaCob: number;      // bank_statements banco = OCA crédito
}

interface BSIncome {
  fecha: string;
  descripcion: string | null;
  credito: number | null;
  importe_uyu: number | null;
  moneda: string;
  banco: string;
  categoria_negocio: string | null;
}

interface MonthDetail {
  año: number;
  mes: number;
  facturado: number;
  efectivo: number;
  tarjeta: number;
  fadaval: number;
  gastos: number;
  adelanto: number;
  semanas: number;
}

export default async function LiquidacionesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const sb = createServerClient();
  const mesFilter = sp.mes ? parseInt(sp.mes) : null;
  const añoFilter = sp.año ? parseInt(sp.año) : new Date().getFullYear();

  const fechaDesde = `${añoFilter}-01-01`;
  const fechaHasta = `${añoFilter + 1}-01-01`;

  // ── Años disponibles para el selector ─────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: yearsData } = await (sb.from("settlements") as any).select("año");
  const añosDisponibles = [...new Set(((yearsData ?? []) as { año: number }[]).map(r => r.año).filter(Boolean))].sort((a, b) => b - a);
  if (!añosDisponibles.includes(añoFilter)) añosDisponibles.push(añoFilter);
  añosDisponibles.sort((a, b) => b - a);

  // ── Liquidaciones del período ─────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (sb.from("settlements") as any).select("*").order("desde", { ascending: false });
  if (añoFilter) query = query.eq("año", añoFilter);
  if (mesFilter) query = query.eq("mes", mesFilter);

  // ── Todas las liquidaciones del año para reconciliación ───────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allSettlementsQ = (sb.from("settlements") as any)
    .select("año, mes, tarjeta, fadaval, efectivo")
    .eq("año", añoFilter);

  // ── Cobros bancarios del año desde bank_statements ────────────────────────
  const PAGE = 1000;
  async function fetchBSIncome(): Promise<BSIncome[]> {
    let all: BSIncome[] = [];
    let from = 0;
    while (true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (sb.from("bank_statements") as any)
        .select("fecha,descripcion,credito,importe_uyu,moneda,banco,categoria_negocio")
        .gt("credito", 0)
        .gte("fecha", fechaDesde)
        .lt("fecha", fechaHasta)
        .neq("descripcion", "Saldo anterior")
        .range(from, from + PAGE - 1);
      if (!data || data.length === 0) break;
      all = all.concat(data as BSIncome[]);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  }

  const [{ data }, { data: allSett }, bsIncome] = await Promise.all([
    query,
    allSettlementsQ,
    fetchBSIncome(),
  ]);

  const items = (data ?? []) as Settlement[];
  type SettRow = { año: number; mes: number; tarjeta: number | null; fadaval: number | null; efectivo: number | null };
  const settlements = (allSett ?? []) as SettRow[];

  const totals = {
    facturado: items.reduce((s, r) => s + (r.facturado ?? 0), 0),
    efectivo: items.reduce((s, r) => s + (r.efectivo ?? 0), 0),
    tarjeta: items.reduce((s, r) => s + (r.tarjeta ?? 0), 0),
    fadaval: items.reduce((s, r) => s + (r.fadaval ?? 0), 0),
    gastos: items.reduce((s, r) => s + (r.gastos ?? 0), 0),
    adelanto: items.reduce((s, r) => s + (r.adelanto_sueldos ?? 0), 0),
  };

  // ── Detalle agrupado por mes (antes era por semana) ───────────────────────
  const detailByMonth = new Map<string, MonthDetail>();
  for (const s of items) {
    if (!s.mes || !s.año) continue;
    const k = `${s.año}-${String(s.mes).padStart(2, "0")}`;
    if (!detailByMonth.has(k)) {
      detailByMonth.set(k, { año: s.año, mes: s.mes, facturado: 0, efectivo: 0, tarjeta: 0, fadaval: 0, gastos: 0, adelanto: 0, semanas: 0 });
    }
    const e = detailByMonth.get(k)!;
    e.facturado += s.facturado ?? 0;
    e.efectivo += s.efectivo ?? 0;
    e.tarjeta += s.tarjeta ?? 0;
    e.fadaval += s.fadaval ?? 0;
    e.gastos += s.gastos ?? 0;
    e.adelanto += s.adelanto_sueldos ?? 0;
    e.semanas += 1;
  }
  const monthDetails = Array.from(detailByMonth.values()).sort((a, b) =>
    b.año !== a.año ? b.año - a.año : b.mes - a.mes
  );

  // ── Reconciliación por mes ────────────────────────────────────────────────
  // NOTA: el efectivo NO se incluye en "liquidado para banco" porque no pasa por extracto.
  // Solo tarjeta + fadaval deben aparecer como acreditaciones bancarias.
  const settlByMonth = new Map<string, { tarjeta: number; fadaval: number; efectivo: number }>();
  for (const s of settlements) {
    if (!s.mes || !s.año) continue;
    const k = `${s.año}-${String(s.mes).padStart(2, "0")}`;
    if (!settlByMonth.has(k)) settlByMonth.set(k, { tarjeta: 0, fadaval: 0, efectivo: 0 });
    const e = settlByMonth.get(k)!;
    e.tarjeta  += s.tarjeta  ?? 0;
    e.fadaval  += s.fadaval  ?? 0;
    e.efectivo += s.efectivo ?? 0;
  }

  // Keywords en descripción que identifican cobros de tarjeta (cuando no hay categoría asignada)
  const TARJETA_DESC = ["posnet", "fiserv", "visanet", "mastercard", "visa", "creditel", "redpagos", "red pagos", "acreditacion tarjeta", "cobro tarjeta"];
  const FADAVAL_DESC = ["fadaval"];

  const cobByMonth = new Map<string, { tarjeta: number; fadaval: number; oca: number }>();
  for (const r of bsIncome) {
    const ym = r.fecha.slice(0, 7);
    if (!cobByMonth.has(ym)) cobByMonth.set(ym, { tarjeta: 0, fadaval: 0, oca: 0 });
    const e = cobByMonth.get(ym)!;
    const imp = r.moneda === "USD" ? Math.abs(r.importe_uyu ?? 0) : (r.credito ?? 0);
    const cat = (r.categoria_negocio ?? "").toLowerCase();
    const desc = (r.descripcion ?? "").toLowerCase();

    if (r.banco === "OCA") {
      e.oca += imp;
    } else if (cat.includes("fadaval") || FADAVAL_DESC.some(k => desc.includes(k))) {
      e.fadaval += imp;
    } else if (cat.includes("venta tarjeta") || TARJETA_DESC.some(k => desc.includes(k))) {
      e.tarjeta += imp;
    }
  }

  const allMonths = Array.from(new Set([...settlByMonth.keys(), ...cobByMonth.keys()])).sort();

  const recon: MonthRecon[] = allMonths.map((k) => {
    const [y, m] = k.split("-").map(Number);
    const s = settlByMonth.get(k) ?? { tarjeta: 0, fadaval: 0, efectivo: 0 };
    const c = cobByMonth.get(k) ?? { tarjeta: 0, fadaval: 0, oca: 0 };
    return {
      año: y, mes: m,
      tarjetaLiq:  s.tarjeta,
      fadavalLiq:  s.fadaval,
      efectivoLiq: s.efectivo,
      tarjetaCob:  c.tarjeta,
      fadavalCob:  c.fadaval,
      ocaCob:      c.oca,
    };
  });

  const totalLiquidado = recon.reduce((s, r) => s + r.tarjetaLiq + r.fadavalLiq, 0);
  const totalCobrado   = recon.reduce((s, r) => s + r.tarjetaCob + r.fadavalCob + r.ocaCob, 0);
  const totalPendiente = totalLiquidado - totalCobrado;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">Liquidaciones</h1>
        {/* Year selector */}
        <div className="flex gap-1">
          {añosDisponibles.map(a => (
            <Link
              key={a}
              href={`/liquidaciones?año=${a}`}
              className={`px-3 h-8 flex items-center text-sm font-medium rounded-lg border transition-colors ${
                a === añoFilter
                  ? "bg-brand text-white border-brand"
                  : "bg-white text-ink border-gray-200 hover:bg-surface"
              }`}
            >
              {a}
            </Link>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted mb-6">Caja diaria — efectivo, tarjeta y Fadaval · {añoFilter}</p>

      {/* KPIs */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {[
          { label: "Facturado", value: totals.facturado, color: "" },
          { label: "Efectivo", value: totals.efectivo, color: "text-olive" },
          { label: "Tarjeta", value: totals.tarjeta, color: "text-brand" },
          { label: "Fadaval", value: totals.fadaval, color: "text-bronze" },
          { label: "Gastos", value: totals.gastos, color: "text-terracotta" },
          { label: "Adelantos", value: totals.adelanto, color: "text-orange-600" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle>{label}</CardTitle>
              <CardValue className={color}>{formatUYU(value)}</CardValue>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Tabla de liquidaciones — agrupada por mes */}
      <div className="bg-white rounded-xl border overflow-x-auto mb-10">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted">Mes</th>
              <th className="text-center px-4 py-3 font-medium text-muted">Liquidaciones</th>
              <th className="text-right px-4 py-3 font-medium text-muted">Facturado</th>
              <th className="text-right px-4 py-3 font-medium text-muted">Efectivo</th>
              <th className="text-right px-4 py-3 font-medium text-muted">Tarjeta</th>
              <th className="text-right px-4 py-3 font-medium text-muted">Fadaval</th>
              <th className="text-right px-4 py-3 font-medium text-muted">Gastos</th>
              <th className="text-right px-4 py-3 font-medium text-muted">Adelantos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {monthDetails.map((m) => (
              <tr key={`${m.año}-${m.mes}`} className="hover:bg-surface">
                <td className="px-4 py-3 font-medium">{monthName(m.mes)} {m.año}</td>
                <td className="px-4 py-3 text-center text-subtle text-xs">{m.semanas}</td>
                <td className="px-4 py-3 text-right font-medium">{formatUYU(m.facturado)}</td>
                <td className="px-4 py-3 text-right text-olive">{formatUYU(m.efectivo)}</td>
                <td className="px-4 py-3 text-right text-brand">{formatUYU(m.tarjeta)}</td>
                <td className="px-4 py-3 text-right text-bronze">{formatUYU(m.fadaval)}</td>
                <td className="px-4 py-3 text-right text-terracotta">{formatUYU(m.gastos)}</td>
                <td className="px-4 py-3 text-right text-orange-600">{m.adelanto > 0 ? formatUYU(m.adelanto) : "—"}</td>
              </tr>
            ))}
            {!monthDetails.length && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-subtle">Sin liquidaciones para este período</td></tr>
            )}
          </tbody>
          {monthDetails.length > 0 && (
            <tfoot className="border-t-2 bg-surface">
              <tr>
                <td className="px-4 py-3 font-bold text-slate-700">Total {añoFilter}</td>
                <td className="px-4 py-3 text-center text-subtle text-xs">{monthDetails.reduce((s, m) => s + m.semanas, 0)}</td>
                <td className="px-4 py-3 text-right font-bold">{formatUYU(totals.facturado)}</td>
                <td className="px-4 py-3 text-right font-bold text-olive">{formatUYU(totals.efectivo)}</td>
                <td className="px-4 py-3 text-right font-bold text-brand">{formatUYU(totals.tarjeta)}</td>
                <td className="px-4 py-3 text-right font-bold text-bronze">{formatUYU(totals.fadaval)}</td>
                <td className="px-4 py-3 text-right font-bold text-terracotta">{formatUYU(totals.gastos)}</td>
                <td className="px-4 py-3 text-right font-bold text-orange-600">{formatUYU(totals.adelanto)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Conciliación: Liquidación vs Extracto bancario ───────────────── */}
      <div className="mb-6">
        <h2 className="text-lg font-bold mb-1">Conciliación cobros</h2>
        <p className="text-sm text-muted mb-4">
          Tarjeta y Fadaval de la liquidación vs lo acreditado en el extracto bancario. El efectivo se muestra aparte — no pasa por banco.
        </p>

        {/* KPIs resumen */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Liquidado (tarjeta + Fadaval)</CardTitle>
              <CardValue>{formatUYU(totalLiquidado)}</CardValue>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Cobrado en banco</CardTitle>
              <CardValue className="text-olive">{formatUYU(totalCobrado)}</CardValue>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pendiente a cobrar</CardTitle>
              <CardValue className={Math.abs(totalPendiente) < 500 ? "text-olive" : totalPendiente > 0 ? "text-terracotta" : "text-ink"}>
                {totalPendiente > 0 ? "+" : ""}{formatUYU(totalPendiente)}
              </CardValue>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Efectivo (fuera de banco)</CardTitle>
              <CardValue className="text-muted">{formatUYU(recon.reduce((s, r) => s + r.efectivoLiq, 0))}</CardValue>
            </CardHeader>
          </Card>
        </div>

        {/* Tabla mes a mes */}
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {/* Cabeceras de grupo */}
              <tr className="border-b" style={{ background: "#F5F0E8" }}>
                <th className="px-4 py-2" />
                <th colSpan={2} className="px-4 py-2 text-center text-xs font-semibold tracking-wide uppercase" style={{ color: "#8C857B" }}>Liquidación</th>
                <th colSpan={3} className="px-4 py-2 text-center text-xs font-semibold tracking-wide uppercase border-l" style={{ color: "#8C857B" }}>Extracto banco</th>
                <th colSpan={2} className="px-4 py-2 text-center text-xs font-semibold tracking-wide uppercase border-l" style={{ color: "#8C857B" }}>Resultado</th>
              </tr>
              <tr className="bg-surface border-b text-xs font-medium text-muted">
                <th className="text-left px-4 py-2">Mes</th>
                <th className="text-right px-4 py-2">Tarjeta</th>
                <th className="text-right px-4 py-2">Fadaval</th>
                <th className="text-right px-4 py-2 border-l">Tarjeta banco</th>
                <th className="text-right px-4 py-2">Fadaval banco</th>
                <th className="text-right px-4 py-2">OCA banco</th>
                <th className="text-right px-4 py-2 border-l font-semibold">Pendiente</th>
                <th className="text-center px-4 py-2">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recon.map((r) => {
                const liquidado = r.tarjetaLiq + r.fadavalLiq;
                const cobrado   = r.tarjetaCob + r.fadavalCob + r.ocaCob;
                const diff      = liquidado - cobrado;
                const ok        = Math.abs(diff) < 500;
                const rowBg     = ok ? "" : diff > 5000 ? "bg-red-50" : "";
                return (
                  <tr key={`${r.año}-${r.mes}`} className={`hover:bg-surface ${rowBg}`}>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{monthName(r.mes)} {r.año}</td>
                    {/* Liquidación */}
                    <td className="px-4 py-3 text-right text-brand">{r.tarjetaLiq > 0 ? formatUYU(r.tarjetaLiq) : "—"}</td>
                    <td className="px-4 py-3 text-right text-bronze">{r.fadavalLiq > 0 ? formatUYU(r.fadavalLiq) : "—"}</td>
                    {/* Banco */}
                    <td className="px-4 py-3 text-right text-brand border-l">{r.tarjetaCob > 0 ? formatUYU(r.tarjetaCob) : "—"}</td>
                    <td className="px-4 py-3 text-right text-bronze">{r.fadavalCob > 0 ? formatUYU(r.fadavalCob) : "—"}</td>
                    <td className="px-4 py-3 text-right" style={{ color: "#7C5C3B" }}>{r.ocaCob > 0 ? formatUYU(r.ocaCob) : "—"}</td>
                    {/* Resultado */}
                    <td className={`px-4 py-3 text-right font-semibold border-l ${ok ? "text-olive" : diff > 0 ? "text-terracotta" : "text-muted"}`}>
                      {diff === 0 ? "—" : (diff > 0 ? "+" : "") + formatUYU(diff)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {ok
                        ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                        : <AlertCircle className="w-4 h-4 text-yellow-500 mx-auto" />
                      }
                    </td>
                  </tr>
                );
              })}
              {recon.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-subtle">Sin datos de conciliación para este período</td></tr>
              )}
            </tbody>
            {recon.length > 0 && (
              <tfoot className="border-t-2 bg-surface text-sm font-bold">
                <tr>
                  <td className="px-4 py-3 text-slate-700">Total {añoFilter}</td>
                  <td className="px-4 py-3 text-right text-brand">{formatUYU(recon.reduce((s, r) => s + r.tarjetaLiq, 0))}</td>
                  <td className="px-4 py-3 text-right text-bronze">{formatUYU(recon.reduce((s, r) => s + r.fadavalLiq, 0))}</td>
                  <td className="px-4 py-3 text-right text-brand border-l">{formatUYU(recon.reduce((s, r) => s + r.tarjetaCob, 0))}</td>
                  <td className="px-4 py-3 text-right text-bronze">{formatUYU(recon.reduce((s, r) => s + r.fadavalCob, 0))}</td>
                  <td className="px-4 py-3 text-right" style={{ color: "#7C5C3B" }}>{formatUYU(recon.reduce((s, r) => s + r.ocaCob, 0))}</td>
                  <td className={`px-4 py-3 text-right border-l ${Math.abs(totalPendiente) < 500 ? "text-olive" : "text-terracotta"}`}>
                    {totalPendiente > 0 ? "+" : ""}{formatUYU(totalPendiente)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className="text-xs text-subtle mt-2">
          Pendiente = liquidado (tarjeta + Fadaval) − cobrado en banco · Positivo = falta acreditar · Negativo = cobro anticipado de mes anterior · ✓ = diferencia menor a $500
        </p>
      </div>
    </div>
  );
}
