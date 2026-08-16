import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { computeAlertas, computeSyncAlertas, computeReposicionAlertas, ProductAlertRow, SyncAlertRow } from "@/lib/productos-alertas";

export const runtime = "nodejs";

type ProductFull = ProductAlertRow & {
  precio_reposicion: number | null;
  costo_compra: number | null;
  proveedor: string | null;
  fecha_ingreso: string | null;
};

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const sb = createServerClient();

  const PAGE = 1000;
  let rows: ProductFull[] = [];
  let from = 0;
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from("products") as any)
      .select("id, tipo_producto, codigo_dl, nombre, proveedor, familia, costo_compra, costo_total, precio_venta, precio_calculado, precio_reposicion, pct_utilidad, stock, control_factores, peso, marca, medida, color_metal, color_piedra, fecha_ingreso, material")
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    rows = rows.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  if (rows.length === 0) {
    return NextResponse.json({ alertas: [], resumen: null, total_productos: 0 });
  }

  const alertas = computeAlertas(rows);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: syncRows } = await (sb.from("product_sync_status") as any)
    .select("codigo_dl, nombre, en_precios, en_checklist, en_zureo");
  if (syncRows && syncRows.length > 0) {
    alertas.push(...computeSyncAlertas(syncRows as SyncAlertRow[]));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: metalPrices } = await (sb.from("metal_prices") as any).select("metal, precio_uyu_gramo");
  if (metalPrices && metalPrices.length > 0) {
    alertas.push(...computeReposicionAlertas(rows, metalPrices));
  }

  // ── Resumen de gestión ──────────────────────────────────────────────
  const porFamilia = new Map<string, { costo: number; venta: number; stock: number; n: number }>();
  const porProveedor = new Map<string, { costo: number; n: number }>();
  let stockValorTotal = 0;
  let costoTotalCompras = 0;

  for (const r of rows) {
    const fam = `${r.tipo_producto} / ${r.familia ?? "Sin familia"}`;
    if (!porFamilia.has(fam)) porFamilia.set(fam, { costo: 0, venta: 0, stock: 0, n: 0 });
    const f = porFamilia.get(fam)!;
    f.costo += r.costo_total ?? 0;
    f.venta += r.precio_venta ?? 0;
    f.stock += r.stock ?? 0;
    f.n += 1;

    const prov = r.proveedor ?? "Sin proveedor";
    if (!porProveedor.has(prov)) porProveedor.set(prov, { costo: 0, n: 0 });
    const p = porProveedor.get(prov)!;
    const costoLinea = (r.costo_compra ?? r.costo_total ?? 0) * (r.stock ?? 1);
    p.costo += costoLinea;
    p.n += 1;

    stockValorTotal += (r.costo_total ?? 0) * (r.stock ?? 0);
    costoTotalCompras += r.costo_compra ?? r.costo_total ?? 0;
  }

  const margenPorFamilia = [...porFamilia.entries()]
    .map(([familia, v]) => ({
      familia,
      n: v.n,
      margen_pct: v.venta > 0 ? Math.round(((v.venta - v.costo) / v.venta) * 1000) / 10 : null,
      valor_stock: Math.round(v.stock * (v.costo / v.n || 0)),
    }))
    .sort((a, b) => b.n - a.n);

  const concentracionProveedores = [...porProveedor.entries()]
    .map(([proveedor, v]) => ({
      proveedor,
      n: v.n,
      costo_total: Math.round(v.costo),
      pct_del_total: costoTotalCompras > 0 ? Math.round((v.costo / [...porProveedor.values()].reduce((a, b) => a + b.costo, 0)) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.costo_total - a.costo_total);

  const resumen = {
    stock_valor_total: Math.round(stockValorTotal),
    margen_promedio_pct:
      rows.filter(r => r.pct_utilidad !== null).length > 0
        ? Math.round(
            (rows.reduce((a, r) => a + (r.pct_utilidad ?? 0), 0) / rows.filter(r => r.pct_utilidad !== null).length) * 1000
          ) / 10
        : null,
    margen_por_familia: margenPorFamilia,
    concentracion_proveedores: concentracionProveedores,
  };

  return NextResponse.json({ alertas, resumen, total_productos: rows.length });
}
