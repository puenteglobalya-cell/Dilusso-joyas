import { createServerClient } from "@/lib/supabase";
import { formatUYU, formatDate, monthName } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { CheckCircle, AlertCircle } from "lucide-react";
import type { Settlement, Transaction } from "@/lib/database.types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Liquidaciones | Dilusso Joyas" };

interface Props {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

interface MonthRecon {
  año: number;
  mes: number;
  tarjetaLiq: number;   // lo que dice la liquidación
  tarjetaCob: number;   // lo que entró al banco BBVA
  fadavalLiq: number;
  fadavalCob: number;
  ocaLiq: number;       // Venta tarjeta OCA registrada en consolidado
  ocaCob: number;       // TRANSF.ENT cobrado en OCA
}

const TARJETA_KEYWORDS = ["CRED.MASTERCARD", "CREDITO VISA", "CRED.MAESTRO", "CRED.MASTER PREPA"];

export default async function LiquidacionesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const sb = createServerClient();
  const mesFilter = sp.mes ? parseInt(sp.mes) : null;
  const añoFilter = sp.año ? parseInt(sp.año) : new Date().getFullYear();

  // ── Liquidaciones del período ─────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (sb.from("settlements") as any).select("*").order("desde", { ascending: false });
  if (añoFilter) query = query.eq("año", añoFilter);
  if (mesFilter) query = query.eq("mes", mesFilter);

  // ── Todas las liquidaciones para reconciliación (sin filtro de mes) ───────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allSettlementsQ = (sb.from("settlements") as any)
    .select("año, mes, tarjeta, fadaval")
    .eq("año", añoFilter);

  // ── Transacciones de negocio para reconciliar ────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txReconQ = (sb.from("transactions") as any)
    .select("año, mes, detalle, categoria, banco, movimiento, importe_uyu")
    .eq("tipo", "negocio")
    .eq("movimiento", "ingreso")
    .eq("año", añoFilter)
    .in("categoria", ["Venta tarjeta", "Fabadal", "Venta tarjeta OCA"]);

  const [{ data }, { data: allSett }, { data: txRecon }] = await Promise.all([
    query,
    allSettlementsQ,
    txReconQ,
  ]);

  const items = (data ?? []) as Settlement[];
  const settlements = (allSett ?? []) as Pick<Settlement, "año" | "mes" | "tarjeta" | "fadaval">[];
  const reconTxs = (txRecon ?? []) as Pick<Transaction, "año" | "mes" | "detalle" | "categoria" | "banco" | "movimiento" | "importe_uyu">[];

  const totals = {
    facturado: items.reduce((s, r) => s + (r.facturado ?? 0), 0),
    efectivo: items.reduce((s, r) => s + (r.efectivo ?? 0), 0),
    tarjeta: items.reduce((s, r) => s + (r.tarjeta ?? 0), 0),
    fadaval: items.reduce((s, r) => s + (r.fadaval ?? 0), 0),
    gastos: items.reduce((s, r) => s + (r.gastos ?? 0), 0),
    adelanto: items.reduce((s, r) => s + (r.adelanto_sueldos ?? 0), 0),
  };

  // ── Reconciliación por mes ────────────────────────────────────────────────
  // Acumular liquidaciones por mes
  const settlByMonth = new Map<string, { tarjeta: number; fadaval: number }>();
  for (const s of settlements) {
    if (!s.mes || !s.año) continue;
    const k = `${s.año}-${s.mes}`;
    if (!settlByMonth.has(k)) settlByMonth.set(k, { tarjeta: 0, fadaval: 0 });
    const e = settlByMonth.get(k)!;
    e.tarjeta += s.tarjeta ?? 0;
    e.fadaval += s.fadaval ?? 0;
  }

  // Acumular cobros bancarios por mes
  const cobByMonth = new Map<string, { tarjeta: number; fadaval: number; oca: number }>();
  for (const t of reconTxs) {
    if (!t.mes || !t.año) continue;
    const k = `${t.año}-${t.mes}`;
    if (!cobByMonth.has(k)) cobByMonth.set(k, { tarjeta: 0, fadaval: 0, oca: 0 });
    const e = cobByMonth.get(k)!;
    const imp = t.importe_uyu ?? 0;
    if (t.categoria === "Venta tarjeta" && TARJETA_KEYWORDS.some(kw => (t.detalle ?? "").toUpperCase().includes(kw))) {
      e.tarjeta += imp;
    } else if (t.categoria === "Venta tarjeta") {
      e.tarjeta += imp; // cualquier venta tarjeta BBVA
    } else if (t.categoria === "Fabadal") {
      e.fadaval += imp;
    } else if (t.categoria === "Venta tarjeta OCA") {
      e.oca += imp;
    }
  }

  // Construir filas de reconciliación para los meses que tienen liquidación
  const allMonths = Array.from(new Set([
    ...Array.from(settlByMonth.keys()),
    ...Array.from(cobByMonth.keys()),
  ])).sort();

  const recon: MonthRecon[] = allMonths.map((k) => {
    const [y, m] = k.split("-").map(Number);
    const s = settlByMonth.get(k) ?? { tarjeta: 0, fadaval: 0 };
    const c = cobByMonth.get(k) ?? { tarjeta: 0, fadaval: 0, oca: 0 };
    return {
      año: y, mes: m,
      tarjetaLiq: s.tarjeta, tarjetaCob: c.tarjeta,
      fadavalLiq: s.fadaval, fadavalCob: c.fadaval,
      ocaLiq: 0, ocaCob: c.oca,
    };
  });

  // Totales acumulados pendientes
  const totalPendTarjeta = recon.reduce((s, r) => s + (r.tarjetaLiq - r.tarjetaCob), 0);
  const totalPendFadaval = recon.reduce((s, r) => s + (r.fadavalLiq - r.fadavalCob), 0);
  const totalPendOca = recon.reduce((s, r) => s + (r.ocaLiq - r.ocaCob), 0);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Liquidaciones</h1>
      <p className="text-sm text-slate-500 mb-6">Caja diaria — efectivo, tarjeta y Fadaval</p>

      {/* KPIs */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {[
          { label: "Facturado", value: totals.facturado, color: "" },
          { label: "Efectivo", value: totals.efectivo, color: "text-green-600" },
          { label: "Tarjeta", value: totals.tarjeta, color: "text-blue-600" },
          { label: "Fadaval", value: totals.fadaval, color: "text-purple-600" },
          { label: "Gastos", value: totals.gastos, color: "text-red-600" },
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

      {/* Tabla de liquidaciones */}
      <div className="bg-white rounded-xl border overflow-x-auto mb-10">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Período</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Mes</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500">Facturado</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500">Efectivo</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500">Tarjeta</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500">Fadaval</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500">Gastos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(s.desde)} – {formatDate(s.hasta)}</td>
                <td className="px-4 py-3">{monthName(s.mes)} {s.año}</td>
                <td className="px-4 py-3 text-right font-medium">{formatUYU(s.facturado)}</td>
                <td className="px-4 py-3 text-right text-green-600">{formatUYU(s.efectivo)}</td>
                <td className="px-4 py-3 text-right text-blue-600">{formatUYU(s.tarjeta)}</td>
                <td className="px-4 py-3 text-right text-purple-600">{formatUYU(s.fadaval)}</td>
                <td className="px-4 py-3 text-right text-red-600">{formatUYU(s.gastos)}</td>
              </tr>
            ))}
            {!items.length && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Sin liquidaciones para este período</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Reconciliación: Liquidado vs Cobrado ─────────────────────────── */}
      <div className="mb-6">
        <h2 className="text-lg font-bold mb-1">Pendiente de cobro</h2>
        <p className="text-sm text-slate-500 mb-4">
          Compara lo liquidado en caja vs lo acreditado en banco por mes. La diferencia es lo que falta cobrar.
        </p>

        {/* Totales pendientes */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Tarjeta pendiente", value: totalPendTarjeta, color: "text-blue-600" },
            { label: "Fadaval pendiente", value: totalPendFadaval, color: "text-purple-600" },
            { label: "OCA pendiente", value: totalPendOca, color: "text-orange-600" },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardHeader>
                <CardTitle>{label}</CardTitle>
                <CardValue className={Math.abs(value) < 500 ? "text-green-600" : color}>
                  {formatUYU(value)}
                </CardValue>
              </CardHeader>
            </Card>
          ))}
        </div>

        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Mes</th>
                {/* Tarjeta */}
                <th className="text-right px-4 py-3 font-medium text-blue-500">Tarjeta liq.</th>
                <th className="text-right px-4 py-3 font-medium text-blue-500">Tarjeta banco</th>
                <th className="text-right px-4 py-3 font-medium text-blue-700">Diferencia</th>
                {/* Fadaval */}
                <th className="text-right px-4 py-3 font-medium text-purple-500">Fadaval liq.</th>
                <th className="text-right px-4 py-3 font-medium text-purple-500">Fadaval banco</th>
                <th className="text-right px-4 py-3 font-medium text-purple-700">Diferencia</th>
                {/* OCA */}
                <th className="text-right px-4 py-3 font-medium text-orange-500">OCA cobrado</th>
                <th className="text-center px-4 py-3 font-medium text-slate-500">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recon.map((r) => {
                const diffTarjeta = r.tarjetaLiq - r.tarjetaCob;
                const diffFadaval = r.fadavalLiq - r.fadavalCob;
                const ok = Math.abs(diffTarjeta) < 500 && Math.abs(diffFadaval) < 500;
                return (
                  <tr key={`${r.año}-${r.mes}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{monthName(r.mes)} {r.año}</td>
                    <td className="px-4 py-3 text-right text-blue-600">{formatUYU(r.tarjetaLiq)}</td>
                    <td className="px-4 py-3 text-right text-blue-600">{formatUYU(r.tarjetaCob)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${Math.abs(diffTarjeta) < 500 ? "text-green-600" : diffTarjeta > 0 ? "text-red-600" : "text-slate-600"}`}>
                      {diffTarjeta > 0 ? "+" : ""}{formatUYU(diffTarjeta)}
                    </td>
                    <td className="px-4 py-3 text-right text-purple-600">{formatUYU(r.fadavalLiq)}</td>
                    <td className="px-4 py-3 text-right text-purple-600">{formatUYU(r.fadavalCob)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${Math.abs(diffFadaval) < 500 ? "text-green-600" : diffFadaval > 0 ? "text-red-600" : "text-slate-600"}`}>
                      {diffFadaval > 0 ? "+" : ""}{formatUYU(diffFadaval)}
                    </td>
                    <td className="px-4 py-3 text-right text-orange-600">{r.ocaCob > 0 ? formatUYU(r.ocaCob) : "—"}</td>
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
                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">Sin datos de reconciliación</td></tr>
              )}
            </tbody>
            {recon.length > 0 && (
              <tfoot className="border-t-2 bg-slate-50">
                <tr>
                  <td className="px-4 py-3 font-bold text-slate-700">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-600">{formatUYU(recon.reduce((s, r) => s + r.tarjetaLiq, 0))}</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-600">{formatUYU(recon.reduce((s, r) => s + r.tarjetaCob, 0))}</td>
                  <td className={`px-4 py-3 text-right font-bold ${Math.abs(totalPendTarjeta) < 500 ? "text-green-600" : "text-red-600"}`}>
                    {totalPendTarjeta > 0 ? "+" : ""}{formatUYU(totalPendTarjeta)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-purple-600">{formatUYU(recon.reduce((s, r) => s + r.fadavalLiq, 0))}</td>
                  <td className="px-4 py-3 text-right font-bold text-purple-600">{formatUYU(recon.reduce((s, r) => s + r.fadavalCob, 0))}</td>
                  <td className={`px-4 py-3 text-right font-bold ${Math.abs(totalPendFadaval) < 500 ? "text-green-600" : "text-red-600"}`}>
                    {totalPendFadaval > 0 ? "+" : ""}{formatUYU(totalPendFadaval)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-orange-600">{formatUYU(recon.reduce((s, r) => s + r.ocaCob, 0))}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          ✓ = diferencia menor a $500 · Diferencia positiva = falta acreditar · Negativa = acreditado de más (mes anterior)
        </p>
      </div>
    </div>
  );
}
