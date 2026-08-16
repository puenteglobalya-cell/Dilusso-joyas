import * as XLSX from "xlsx";

export type ProductRow = {
  tipo_producto: "joya" | "reloj";
  codigo_dl: string;
  codigo_proveedor: string | null;
  proveedor: string | null;
  familia: string | null;
  sub_tipo: string | null;
  sub_sub_tipo: string | null;
  nombre: string | null;
  marca: string | null;
  medida: string | null;
  color_metal: string | null;
  color_piedra: string | null;
  tipo_piedra: string | null;
  material: string | null;
  peso: number | null;
  detalle: string | null;
  linea: string | null;
  moneda_compra: string | null;
  costo_compra: number | null;
  costo_compra_uyu: number | null;
  costo_total: number | null;
  tipo_cambio: number | null;
  factor_final: number | null;
  precio_calculado: number | null;
  precio_ajustado: number | null;
  precio_venta: number | null;
  precio_reposicion: number | null;
  pct_utilidad: number | null;
  stock: number | null;
  unidad: string | null;
  control_factores: string | null;
  fecha_ingreso: string | null;
  fecha_factura: string | null;
  numero_documento: string | null;
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function dateStr(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null;
}

/** Sheet "PRECIOS_JOYAS" del archivo SISTEMA_JOYAS */
export function parseJoyas(buffer: ArrayBuffer): ProductRow[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const ws = wb.Sheets["PRECIOS_JOYAS"];
  if (!ws) throw new Error('No se encontró la hoja "PRECIOS_JOYAS" en el archivo.');
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });

  const out: ProductRow[] = [];
  for (const r of rows) {
    const codigo_dl = str(r["CODIGO_DL"]);
    if (!codigo_dl) continue;
    out.push({
      tipo_producto: "joya",
      codigo_dl,
      codigo_proveedor: str(r["CODIGO_PROVEEDOR"]),
      proveedor: str(r["PROVEEDOR"]),
      familia: str(r["FAMILIA"]),
      sub_tipo: str(r["SUB_TIPO"]),
      sub_sub_tipo: str(r["SUB_SUB_TIPO"]),
      nombre: str(r["NOMBRE"]),
      marca: null,
      medida: str(r["MEDIDA"]),
      color_metal: str(r["COLOR_METAL"]),
      color_piedra: str(r["COLOR_PIEDRA"]),
      tipo_piedra: str(r["TIPO_PIEDRA"]),
      material: str(r["MATERIAL"]),
      peso: num(r["PESO"]),
      detalle: str(r["DETALLE"]),
      linea: str(r["LINEA"]),
      moneda_compra: str(r["MONEDA_COMPRA (USD/UYU)"]),
      costo_compra: num(r["COSTO_COMPRA"]),
      costo_compra_uyu: num(r["COSTO_COMPRA_UYU"]),
      costo_total: num(r["COSTO TOTAL"]),
      tipo_cambio: num(r["TIPO_CAMBIO"]),
      factor_final: num(r["FACTOR_FINAL"]),
      precio_calculado: num(r["PRECIO_CALCULADO (antes banda)"]),
      precio_ajustado: num(r["PRECIO_AJUSTADO"]),
      precio_venta: num(r["PRECIO_VENTA"]),
      precio_reposicion: num(r["PRECIO_REPOSICION"]),
      pct_utilidad: num(r["% UTILIDAD"]),
      stock: num(r["STOCK"]),
      unidad: str(r["UNIDAD"]),
      control_factores: str(r["CONTROL_FACTORES"]),
      fecha_ingreso: dateStr(r["FECHA_INGRESO"]),
      fecha_factura: dateStr(r["FECHA_FACTURA"]),
      numero_documento: str(r["NUMERO_DOCUMENTO"]),
    });
  }
  return out;
}

/** Sheet "planilla precio relojes" del archivo SISTEMA_RELOJES */
export function parseRelojes(buffer: ArrayBuffer): ProductRow[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const ws = wb.Sheets["planilla precio relojes"];
  if (!ws) throw new Error('No se encontró la hoja "planilla precio relojes" en el archivo.');
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });

  const out: ProductRow[] = [];
  for (const r of rows) {
    const codigo_dl = str(r["CODIGO "]) ?? str(r["Codigo DL de Barras"]);
    if (!codigo_dl) continue;
    const costo = num(r["COSTO DE COMPRA"]);
    const precioVenta = num(r["Precio de VENTA"]);
    // La planilla trae "% UTILIDAD SOBRE COMPRA" (markup sobre costo, ej 105 = 105%).
    // Lo normalizamos a margen sobre precio de venta (fracción 0-1) para que sea
    // comparable con el % UTILIDAD de la planilla de joyas.
    const pctUtilidadNormalizado = costo && precioVenta ? (precioVenta - costo) / precioVenta : null;
    out.push({
      tipo_producto: "reloj",
      codigo_dl,
      codigo_proveedor: str(r["CODIGO DEL PROVEEDOR"]),
      proveedor: str(r["PROVEEDOR"]),
      familia: str(r["TIPO DE ARTÍCULO"]),
      sub_tipo: str(r["Sub-Tipo"]),
      sub_sub_tipo: str(r["Sub-Sub Tipo"]),
      nombre: str(r["NOMBRE"]),
      marca: str(r["MARCA"]),
      medida: str(r["Valor Atributo 1 (Tamaño)"]),
      color_metal: str(r["Valor Atributo 2 (Color de Malla)"]),
      color_piedra: null,
      tipo_piedra: null,
      material: str(r["Valor Atributo 3 (Material/Tipo de Malla)"]),
      peso: null,
      detalle: str(r["Valor Atributo 4 (Resistencia Agua)"]),
      linea: null,
      moneda_compra: str(r["MONEDA DE VENTA"]),
      costo_compra: num(r["COSTO DE COMPRA"]),
      costo_compra_uyu: null,
      costo_total: num(r["COSTO DE COMPRA"]),
      tipo_cambio: num(r["Tipo_Cambio"]),
      factor_final: num(r["Factor"]),
      precio_calculado: num(r["Precio_Calculado_UYU"]),
      precio_ajustado: null,
      precio_venta: precioVenta,
      precio_reposicion: null,
      pct_utilidad: pctUtilidadNormalizado,
      stock: num(r["STOCK"]),
      unidad: str(r["UNIDAD DE MEDIDA"]),
      control_factores: null,
      fecha_ingreso: null,
      fecha_factura: null,
      numero_documento: str(r["NUMERO_DOCUMENTO"]),
    });
  }
  return out;
}
