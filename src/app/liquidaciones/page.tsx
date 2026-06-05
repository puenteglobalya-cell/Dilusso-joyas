import { createServerClient } from "@/lib/supabase";
import { formatUYU, formatDate, monthName } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import type { Settlement } from "@/lib/database.types";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function LiquidacionesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const sb = createServerClient();
  const mes = sp.mes ? parseInt(sp.mes) : null;
  const año = sp.año ? parseInt(sp.año) : new Date().getFullYear();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (sb.from("settlements") as any).select("*").order("desde", { ascending: false });
  if (año) query = query.eq("año", año);
  if (mes) query = query.eq("mes", mes);

  const { data } = await query;
  const items = (data ?? []) as Settlement[];

  const totals = {
    facturado: items.reduce((s, r) => s + (r.facturado ?? 0), 0),
    efectivo: items.reduce((s, r) => s + (r.efectivo ?? 0), 0),
    tarjeta: items.reduce((s, r) => s + (r.tarjeta ?? 0), 0),
    fadaval: items.reduce((s, r) => s + (r.fadaval ?? 0), 0),
    gastos: items.reduce((s, r) => s + (r.gastos ?? 0), 0),
    adelanto: items.reduce((s, r) => s + (r.adelanto_sueldos ?? 0), 0),
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Liquidaciones</h1>
      <p className="text-sm text-slate-500 mb-6">Caja diaria — efectivo, tarjeta y Fadaval</p>

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

      <div className="bg-white rounded-xl border overflow-x-auto">
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
    </div>
  );
}
