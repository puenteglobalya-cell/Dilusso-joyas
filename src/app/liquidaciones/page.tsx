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

  const cobByMonth = new Map<string, { tarjeta: number; fadaval: number; oca: number; efectivo: number }>();
  for (const r of bsIncome) {
    const ym = r.fecha.slice(0, 7);
    if (!cobByMonth.has(ym)) cobByMonth.set(ym, { tarjeta: 0, fadaval: 0, oca: 0, efectivo: 0 });
    const e = cobByMonth.get(ym)!;
    const imp = r.moneda === "USD" ? Math.abs(r.importe_uyu ?? 0) : (r.credito ?? 0);
    const cat = (r.categoria_negocio ?? "").toLowerCase();
    const desc = (r.descripcion ?? "").toLowerCase();

    if (r.banco === "Efectivo") {
      e.efectivo += imp;
    } else if (r.banco === "OCA") {
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

      {/* ── Tablas de auditoría por canal ─────────────────────────────────── */}
      {(() => {
        const allKeys = Array.from(new Set([
          ...monthDetails.map(m => `${m.año}-${String(m.mes).padStart(2,"0")}`),
          ...recon.map(r => `${r.año}-${String(r.mes).padStart(2,"0")}`),
        ])).sort().reverse();

        const detailMap = new Map(monthDetails.map(m => [`${m.año}-${String(m.mes).padStart(2,"0")}`, m]));
        const reconMap  = new Map(recon.map(r  => [`${r.año}-${String(r.mes).padStart(2,"0")}`, r]));

        type AuditRow = { liq: number; banco: number };
        type Canal = { title: string; color: string; rows: Map<string, AuditRow>; nota?: string };

        // Efectivo: liquidación vs bank_statements banco='Efectivo' (resumen mensual cargado)
        const efectivoRows = new Map<string, AuditRow>();
        allKeys.forEach(k => {
          const d = detailMap.get(k);
          const c = cobByMonth.get(k);
          efectivoRows.set(k, { liq: d?.efectivo ?? 0, banco: c?.efectivo ?? 0 });
        });

        // Tarjeta (incluye OCA banco — ambas son cobros con tarjeta)
        const tarjetaRows = new Map<string, AuditRow>();
        allKeys.forEach(k => {
          const d = detailMap.get(k);
          const r = reconMap.get(k);
          tarjetaRows.set(k, { liq: d?.tarjeta ?? 0, banco: (r?.tarjetaCob ?? 0) + (r?.ocaCob ?? 0) });
        });

        // Fadaval
        const fadavalRows = new Map<string, AuditRow>();
        allKeys.forEach(k => {
          const d = detailMap.get(k);
          const r = reconMap.get(k);
          fadavalRows.set(k, { liq: d?.fadaval ?? 0, banco: r?.fadavalCob ?? 0 });
        });

        // Total
        const totalRows = new Map<string, AuditRow>();
        allKeys.forEach(k => {
          const d = detailMap.get(k);
          const r = reconMap.get(k);
          const c = cobByMonth.get(k);
          const liqTotal   = (d?.efectivo ?? 0) + (d?.tarjeta ?? 0) + (d?.fadaval ?? 0);
          const bancoTotal = (c?.efectivo ?? 0) + (r?.tarjetaCob ?? 0) + (r?.fadavalCob ?? 0) + (r?.ocaCob ?? 0);
          totalRows.set(k, { liq: liqTotal, banco: bancoTotal });
        });

        const canales: Canal[] = [
          { title: "Efectivo", color: "#586E50", rows: efectivoRows, nota: "Banco/Sistema = movimientos con banco='Efectivo' en bank_statements (resumen mensual cargado vía SQL)." },
          { title: "Tarjeta (incluye OCA)", color: "#A3907A", rows: tarjetaRows, nota: "Banco = acreditaciones tarjeta + OCA, ambas son cobros con tarjeta." },
          { title: "Fadaval", color: "#A3907A", rows: fadavalRows },
          { title: "Total general", color: "#2E2B2A", rows: totalRows },
        ];

        const fmt = (n: number) => formatUYU(n);
        const label = (k: string) => {
          const d = detailMap.get(k);
          if (d) return `${monthName(d.mes)} ${d.año}`;
          const [y, m] = k.split("-");
          return `${monthName(parseInt(m))} ${y}`;
        };

        return (
          <div className="space-y-8 mb-4">
            {canales.map(canal => {
              const rows = Array.from(canal.rows.entries());
              const totLiq   = rows.reduce((s, [, v]) => s + v.liq, 0);
              const totBanco = rows.reduce((s, [, v]) => s + v.banco, 0);
              const totDiff  = totLiq - totBanco;
              return (
                <div key={canal.title}>
                  <h2 className="text-base font-bold mb-1" style={{ color: canal.color }}>{canal.title}</h2>
                  {canal.nota && <p className="text-xs text-muted mb-2">{canal.nota}</p>}
                  <div className="bg-white rounded-xl border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-surface border-b text-xs font-medium text-muted">
                        <tr>
                          <th className="text-left px-4 py-2">Mes</th>
                          <th className="text-right px-4 py-2">Liquidación</th>
                          <th className="text-right px-4 py-2">Banco / Sistema</th>
                          <th className="text-right px-4 py-2">Diferencia</th>
                          <th className="text-center px-4 py-2">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.map(([k, v]) => {
                          const diff = v.liq - v.banco;
                          const ok   = canal.title === "Efectivo" || Math.abs(diff) < 500;
                          const skip = canal.title === "OCA" && v.liq === 0 && v.banco === 0;
                          if (skip) return null;
                          return (
                            <tr key={k} className={`hover:bg-surface ${!ok && diff > 5000 ? "bg-red-50" : ""}`}>
                              <td className="px-4 py-2.5 font-medium whitespace-nowrap">{label(k)}</td>
                              <td className="px-4 py-2.5 text-right">{v.liq > 0 ? fmt(v.liq) : "—"}</td>
                              <td className="px-4 py-2.5 text-right text-olive">{v.banco > 0 ? fmt(v.banco) : "—"}</td>
                              <td className={`px-4 py-2.5 text-right font-semibold ${ok ? "text-olive" : diff > 0 ? "text-terracotta" : "text-muted"}`}>
                                {diff === 0 ? "—" : (diff > 0 ? "+" : "") + fmt(diff)}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {ok
                                  ? <CheckCircle className="w-3.5 h-3.5 text-green-500 mx-auto" />
                                  : <AlertCircle className="w-3.5 h-3.5 text-yellow-500 mx-auto" />
                                }
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t-2 bg-surface text-xs font-bold">
                        <tr>
                          <td className="px-4 py-2.5">Total {añoFilter}</td>
                          <td className="px-4 py-2.5 text-right">{fmt(totLiq)}</td>
                          <td className="px-4 py-2.5 text-right text-olive">{fmt(totBanco)}</td>
                          <td className={`px-4 py-2.5 text-right ${Math.abs(totDiff) < 500 ? "text-olive" : totDiff > 0 ? "text-terracotta" : "text-muted"}`}>
                            {totDiff === 0 ? "—" : (totDiff > 0 ? "+" : "") + fmt(totDiff)}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
      <p className="text-xs text-subtle mb-8">
        Diferencia positiva = liquidado pero no acreditado aún · Negativa = acreditado de más (cobro de mes anterior) · ✓ = diferencia menor a $500
      </p>
    </div>
  );
}
