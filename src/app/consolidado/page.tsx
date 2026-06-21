import Link from "next/link";
import { createServerClient } from "@/lib/supabase";
import { formatUYU, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { TransactionFilters } from "@/components/transactions/filters";
import { KpiCard } from "@/components/ui/KpiDrawer";
import { ExportButtons } from "@/components/ExportButtons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consolidado | Dilusso Joyas" };

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
}

function rowImporteUYU(r: BSRow): number {
  if (r.moneda === "USD") return Math.abs(r.importe_uyu ?? 0);
  return (r.debito ?? 0) + (r.credito ?? 0);
}

export default async function ConsolidadoPage({ searchParams }: Props) {
  const sp = await searchParams;
  const sb = createServerClient();
  const mesFilter = sp.mes ? parseInt(sp.mes) : null;
  const añoFilter = sp.año ? parseInt(sp.año) : new Date().getFullYear();
  const tipoFilter = sp.tipo ?? null;
  const bancoFilter = sp.banco ?? null;

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
  let all: BSRow[] = [];
  let from = 0;
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (sb.from("bank_statements") as any)
      .select("id,banco,fecha,descripcion,debito,credito,importe_uyu,moneda,tipo,categoria_negocio,categoria_personal,clasificado")
      .gte("fecha", fechaDesde)
      .lt("fecha", fechaHasta)
      .neq("descripcion", "Saldo anterior")
      .neq("tipo", "traspaso")
      .order("fecha", { ascending: false })
      .range(from, from + PAGE - 1);
    if (tipoFilter) q = q.eq("tipo", tipoFilter);
    if (bancoFilter) q = q.eq("banco", bancoFilter);
    const { data } = await q;
    if (!data || data.length === 0) break;
    all = all.concat(data as BSRow[]);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const totalSalidas = all.filter(r => (r.debito ?? 0) > 0).reduce((s, r) => s + rowImporteUYU(r), 0);
  const totalIngresos = all.filter(r => (r.credito ?? 0) > 0).reduce((s, r) => s + rowImporteUYU(r), 0);
  const neto = totalIngresos - totalSalidas;

  // per-banco breakdown
  const byBancoIn = all.filter(r => (r.credito ?? 0) > 0).reduce<Record<string, number>>((a, r) => { a[r.banco] = (a[r.banco] ?? 0) + rowImporteUYU(r); return a; }, {});
  const byBancoOut = all.filter(r => (r.debito ?? 0) > 0).reduce<Record<string, number>>((a, r) => { a[r.banco] = (a[r.banco] ?? 0) + rowImporteUYU(r); return a; }, {});
  const ingresosDetail = Object.entries(byBancoIn).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  const egresosDetail = Object.entries(byBancoOut).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Consolidado</h1>
          <p className="text-sm text-muted mt-1">{all.length} movimientos</p>
        </div>
        <ExportButtons params={{
          año: String(añoFilter),
          ...(mesFilter ? { mes: String(mesFilter) } : {}),
          ...(tipoFilter ? { tipo: tipoFilter } : {}),
          ...(bancoFilter ? { banco: bancoFilter } : {}),
        }} />
      </div>

      <TransactionFilters />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard title="Ingresos" value={formatUYU(totalIngresos)} valueClass="text-olive" detail={ingresosDetail} detailTitle="Ingresos por banco" />
        <KpiCard title="Egresos" value={formatUYU(totalSalidas)} valueClass="text-terracotta" detail={egresosDetail} detailTitle="Egresos por banco" />
        <KpiCard title="Neto" value={formatUYU(neto)} valueClass={neto >= 0 ? "text-olive" : "text-terracotta"} />
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted">Fecha</th>
              <th className="text-left px-4 py-3 font-medium text-muted">Banco</th>
              <th className="text-left px-4 py-3 font-medium text-muted">Descripción</th>
              <th className="text-left px-4 py-3 font-medium text-muted">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-muted">Categoría</th>
              <th className="text-right px-4 py-3 font-medium text-muted">Importe UYU</th>
              <th className="text-center px-4 py-3 font-medium text-muted">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {all.map((r) => {
              const esIngreso = (r.credito ?? 0) > 0;
              const cat = r.tipo === "negocio" ? r.categoria_negocio : r.categoria_personal;
              return (
                <tr key={r.id} className="hover:bg-surface">
                  <td className="px-4 py-3 text-muted whitespace-nowrap">{formatDate(r.fecha)}</td>
                  <td className="px-4 py-3 font-medium">{r.banco}</td>
                  <td className="px-4 py-3 text-ink max-w-xs truncate">{r.descripcion ?? "—"}</td>
                  <td className="px-4 py-3">
                    {r.tipo ? (
                      <Badge variant={r.tipo === "negocio" ? "default" : "outline"}>{r.tipo}</Badge>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">{cat ?? "—"}</td>
                  <td className={`px-4 py-3 text-right font-medium ${esIngreso ? "text-olive" : "text-terracotta"}`}>
                    {esIngreso ? "+" : "-"}{formatUYU(rowImporteUYU(r))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={r.clasificado === "Si" ? "success" : "warning"}>
                      {r.clasificado === "Si" ? "OK" : "Pendiente"}
                    </Badge>
                  </td>
                </tr>
              );
            })}
            {!all.length && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-subtle">
                  <p className="font-medium text-muted mb-1">Sin movimientos para este período</p>
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
