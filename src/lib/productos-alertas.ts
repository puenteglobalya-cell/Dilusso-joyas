export type ProductAlertRow = {
  id: string;
  tipo_producto: "joya" | "reloj";
  codigo_dl: string;
  nombre: string | null;
  proveedor: string | null;
  familia: string | null;
  costo_total: number | null;
  precio_venta: number | null;
  precio_calculado: number | null;
  pct_utilidad: number | null;
  stock: number | null;
  control_factores: string | null;
  peso: number | null;
  marca: string | null;
  medida: string | null;
  color_metal: string | null;
  color_piedra: string | null;
  fecha_ingreso: string | null;
  material: string | null;
};

export type ProductAlert = {
  tipo:
    | "control_factores"
    | "sin_costo"
    | "sin_precio"
    | "margen_negativo"
    | "margen_bajo"
    | "precio_bajo_reposicion"
    | "grupo_precio_inconsistente"
    | "gap_venta_calculado"
    | "marca_desviada"
    | "sin_calculo_automatico"
    | "stock_inmovilizado"
    | "desincronizado_erp";
  severidad: "alta" | "media" | "baja";
  titulo: string;
  detalle: string;
  productos: { id: string; codigo_dl: string; nombre: string | null }[];
};

const GRUPO_SPREAD_UMBRAL = 0.4; // 40% entre min y max del mismo producto
const GAP_VENTA_CALCULADO_UMBRAL = 0.15; // 15%
const MARGEN_BAJO_UMBRAL = 0.3; // 30%

export function computeAlertas(rows: ProductAlertRow[]): ProductAlert[] {
  const alertas: ProductAlert[] = [];

  // 1. CONTROL_FACTORES marcado como error por la propia planilla
  const conError = rows.filter(r => r.control_factores && r.control_factores.toUpperCase() !== "OK");
  if (conError.length > 0) {
    alertas.push({
      tipo: "control_factores",
      severidad: "alta",
      titulo: `${conError.length} producto(s) con CONTROL_FACTORES en error`,
      detalle: "La propia planilla marcó estos códigos como inconsistentes en el cálculo de factores (posible factor mal aplicado).",
      productos: conError.map(r => ({ id: r.id, codigo_dl: r.codigo_dl, nombre: r.nombre })),
    });
  }

  // 2. Sin costo / sin precio
  const sinCosto = rows.filter(r => !r.costo_total);
  if (sinCosto.length > 0) {
    alertas.push({
      tipo: "sin_costo",
      severidad: "alta",
      titulo: `${sinCosto.length} producto(s) sin costo cargado`,
      detalle: "No tienen COSTO_TOTAL — no se puede calcular margen ni validar el precio.",
      productos: sinCosto.map(r => ({ id: r.id, codigo_dl: r.codigo_dl, nombre: r.nombre })),
    });
  }
  const sinPrecio = rows.filter(r => !r.precio_venta);
  if (sinPrecio.length > 0) {
    alertas.push({
      tipo: "sin_precio",
      severidad: "alta",
      titulo: `${sinPrecio.length} producto(s) sin precio de venta`,
      detalle: "No tienen PRECIO_VENTA cargado.",
      productos: sinPrecio.map(r => ({ id: r.id, codigo_dl: r.codigo_dl, nombre: r.nombre })),
    });
  }

  // 3. Margen negativo o muy bajo
  const margenNeg = rows.filter(r => r.pct_utilidad !== null && r.pct_utilidad < 0);
  if (margenNeg.length > 0) {
    alertas.push({
      tipo: "margen_negativo",
      severidad: "alta",
      titulo: `${margenNeg.length} producto(s) con margen negativo`,
      detalle: "Se venden por debajo del costo.",
      productos: margenNeg.map(r => ({ id: r.id, codigo_dl: r.codigo_dl, nombre: r.nombre })),
    });
  }
  const margenBajo = rows.filter(r => r.pct_utilidad !== null && r.pct_utilidad >= 0 && r.pct_utilidad < MARGEN_BAJO_UMBRAL);
  if (margenBajo.length > 0) {
    alertas.push({
      tipo: "margen_bajo",
      severidad: "media",
      titulo: `${margenBajo.length} producto(s) con margen menor al ${MARGEN_BAJO_UMBRAL * 100}%`,
      detalle: "Margen bruto por debajo del umbral esperado para la categoría.",
      productos: margenBajo.map(r => ({ id: r.id, codigo_dl: r.codigo_dl, nombre: r.nombre })),
    });
  }

  // 4. Precio de venta por debajo del precio de reposición (joyas)
  const precioBajoRepo = rows.filter(
    r => r.precio_venta && r.precio_venta > 0 && "precio_reposicion" in r
  ) as (ProductAlertRow & { precio_reposicion?: number | null })[];
  const bajoRepo = precioBajoRepo.filter(r => r.precio_reposicion && r.precio_venta! < r.precio_reposicion);
  if (bajoRepo.length > 0) {
    alertas.push({
      tipo: "precio_bajo_reposicion",
      severidad: "alta",
      titulo: `${bajoRepo.length} producto(s) con precio de venta por debajo del precio de reposición`,
      detalle: "Vender a ese precio no cubre reponer el stock.",
      productos: bajoRepo.map(r => ({ id: r.id, codigo_dl: r.codigo_dl, nombre: r.nombre })),
    });
  }

  // 5. Mismo producto (nombre + medida + color) con precios muy dispares entre códigos
  const grupos = new Map<string, ProductAlertRow[]>();
  for (const r of rows) {
    if (!r.nombre || !r.precio_venta) continue;
    const key = `${r.tipo_producto}|${r.nombre}|${r.medida ?? ""}|${r.color_metal ?? ""}|${r.color_piedra ?? ""}`;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(r);
  }
  const gruposInconsistentes: { key: string; productos: ProductAlertRow[]; min: number; max: number; spread: number }[] = [];
  for (const [key, productos] of grupos) {
    if (productos.length < 2) continue;
    const precios = productos.map(p => p.precio_venta!).filter(Boolean);
    const min = Math.min(...precios);
    const max = Math.max(...precios);
    const spread = min > 0 ? (max - min) / min : 0;
    if (spread >= GRUPO_SPREAD_UMBRAL) {
      gruposInconsistentes.push({ key, productos, min, max, spread });
    }
  }
  if (gruposInconsistentes.length > 0) {
    for (const g of gruposInconsistentes) {
      alertas.push({
        tipo: "grupo_precio_inconsistente",
        severidad: "media",
        titulo: `"${g.productos[0].nombre}" (${g.productos[0].medida ?? "s/medida"}) varía ${Math.round(g.spread * 100)}% entre códigos ($${g.min} a $${g.max})`,
        detalle: "Mismo producto (nombre/medida/color) cargado con costos o factores distintos según el ingreso — revisar si el costo de compra fue correcto en cada caso.",
        productos: g.productos.map(r => ({ id: r.id, codigo_dl: r.codigo_dl, nombre: r.nombre })),
      });
    }
  }

  // 6. Precio de venta muy por encima del precio calculado por fórmula (ajuste manual grande)
  const gaps = rows
    .map(r => {
      if (!r.precio_venta || r.precio_calculado === null || r.precio_calculado === 0) return null;
      const gap = (r.precio_venta - r.precio_calculado) / r.precio_calculado;
      return { r, gap };
    })
    .filter((x): x is { r: ProductAlertRow; gap: number } => x !== null && Math.abs(x.gap) >= GAP_VENTA_CALCULADO_UMBRAL);
  if (gaps.length > 0) {
    alertas.push({
      tipo: "gap_venta_calculado",
      severidad: "baja",
      titulo: `${gaps.length} producto(s) con precio de venta ${GAP_VENTA_CALCULADO_UMBRAL * 100}%+ distinto al calculado por fórmula`,
      detalle: "El precio final fue ajustado manualmente lejos del valor que da costo × factor. Puede ser una decisión de pricing válida, pero vale revisar caso a caso.",
      productos: gaps.map(x => ({ id: x.r.id, codigo_dl: x.r.codigo_dl, nombre: x.r.nombre })),
    });
  }

  // 6b. Precio calculado en 0 — la fórmula de factor no corrió (ej. factor de material no encontrado)
  // y el precio de venta quedó 100% a criterio manual, sin ancla de costo/margen automatizada.
  const sinCalculo = rows.filter(r => r.precio_venta && r.precio_calculado === 0);
  if (sinCalculo.length > 0) {
    alertas.push({
      tipo: "sin_calculo_automatico",
      severidad: "alta",
      titulo: `${sinCalculo.length} producto(s) con PRECIO_CALCULADO en $0 pese a tener precio de venta cargado`,
      detalle: "La fórmula de factor no encontró el multiplicador correspondiente (revisar FACTORES MATERIAL) — el precio de venta se cargó manualmente sin control automatizado de margen.",
      productos: sinCalculo.map(r => ({ id: r.id, codigo_dl: r.codigo_dl, nombre: r.nombre })),
    });
  }

  // 7. Marca con desviación sistemática vs el resto (todas las unidades de esa marca por encima/debajo del cálculo)
  const allGapsByMarca = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.marca || !r.precio_venta || !r.precio_calculado) continue;
    const gap = (r.precio_venta - r.precio_calculado) / r.precio_calculado;
    if (!allGapsByMarca.has(r.marca)) allGapsByMarca.set(r.marca, []);
    allGapsByMarca.get(r.marca)!.push(gap);
  }
  const marcaDesviada: { marca: string; avg: number; n: number }[] = [];
  const avgs = [...allGapsByMarca.entries()].map(([marca, arr]) => ({
    marca,
    avg: arr.reduce((a, b) => a + b, 0) / arr.length,
    n: arr.length,
  }));
  if (avgs.length > 1) {
    const overall = avgs.reduce((a, b) => a + b.avg, 0) / avgs.length;
    for (const a of avgs) {
      if (a.n >= 5 && a.avg - overall > 0.08) marcaDesviada.push(a);
    }
  }
  if (marcaDesviada.length > 0) {
    alertas.push({
      tipo: "marca_desviada",
      severidad: "baja",
      titulo: `Marca(s) con margen sistemáticamente por encima del resto: ${marcaDesviada.map(m => `${m.marca} (+${Math.round(m.avg * 100)}%)`).join(", ")}`,
      detalle: "Todas las unidades de esta marca están vendidas por encima de lo que da la fórmula de precio — probablemente intencional, pero conviene confirmarlo.",
      productos: [],
    });
  }

  // 8. Stock inmovilizado — ingresó hace más de 180/360 días y todavía figura con stock
  const hoy = Date.now();
  const DIA_MS = 24 * 60 * 60 * 1000;
  const stockViejo = rows.filter(r => {
    if (!r.fecha_ingreso || !r.stock || r.stock <= 0) return false;
    const dias = (hoy - new Date(r.fecha_ingreso).getTime()) / DIA_MS;
    return dias >= 180;
  });
  if (stockViejo.length > 0) {
    const muyViejo = stockViejo.filter(r => {
      const dias = (hoy - new Date(r.fecha_ingreso!).getTime()) / DIA_MS;
      return dias >= 360;
    });
    alertas.push({
      tipo: "stock_inmovilizado",
      severidad: muyViejo.length > 0 ? "media" : "baja",
      titulo: `${stockViejo.length} producto(s) con stock ingresado hace 180+ días (${muyViejo.length} hace 360+ días)`,
      detalle: "Capital inmovilizado en vitrina sin evidencia de rotación reciente — candidatos a liquidar, rebajar o promocionar. (Aproximado: no tenemos fecha de última venta, solo fecha de ingreso.)",
      productos: stockViejo.map(r => ({ id: r.id, codigo_dl: r.codigo_dl, nombre: r.nombre })),
    });
  }

  return alertas;
}

const REPOSICION_UMBRAL = 0.1; // 10% de erosión de margen por suba de costo del metal

export type MetalPrice = { metal: string; precio_uyu_gramo: number };

/**
 * Compara el margen histórico (costo de compra al momento de ingreso) contra el margen
 * que quedaría si hubiera que reponer ese mismo peso de metal a la cotización actual.
 * Solo aplica a joyas con MATERIAL == PLATA 925 / ORO 10K / ORO 18K y PESO cargado —
 * el resto de los materiales (enchapados, combinaciones) no tiene cotización de mercado directa.
 */
export function computeReposicionAlertas(
  rows: (ProductAlertRow & { peso: number | null })[],
  metalPrices: MetalPrice[]
): ProductAlert[] {
  const alertas: ProductAlert[] = [];
  const precioPorMetal = new Map(metalPrices.map(m => [m.metal, m.precio_uyu_gramo]));
  if (precioPorMetal.size === 0) return alertas;

  const erosionados: { r: ProductAlertRow; margenHistorico: number; margenReposicion: number }[] = [];
  for (const r of rows) {
    const precioGramo = r.material ? precioPorMetal.get(r.material) : undefined;
    if (!precioGramo || !r.peso || !r.precio_venta || !r.costo_total) continue;
    const costoReposicion = r.peso * precioGramo;
    if (costoReposicion <= r.costo_total) continue; // el metal no subió lo suficiente para importar
    const margenHistorico = (r.precio_venta - r.costo_total) / r.precio_venta;
    const margenReposicion = (r.precio_venta - costoReposicion) / r.precio_venta;
    if (margenHistorico - margenReposicion >= REPOSICION_UMBRAL) {
      erosionados.push({ r, margenHistorico, margenReposicion });
    }
  }

  if (erosionados.length > 0) {
    alertas.push({
      tipo: "margen_bajo",
      severidad: "media",
      titulo: `${erosionados.length} producto(s) con margen erosionado si hay que reponer stock a precio de metal actual`,
      detalle: `Vendidos con margen histórico de ~${Math.round((erosionados.reduce((a, x) => a + x.margenHistorico, 0) / erosionados.length) * 100)}%, pero repondrían con ~${Math.round((erosionados.reduce((a, x) => a + x.margenReposicion, 0) / erosionados.length) * 100)}% al precio de metal cargado — se está "comiendo" capital en vez de reponerlo.`,
      productos: erosionados.map(x => ({ id: x.r.id, codigo_dl: x.r.codigo_dl, nombre: x.r.nombre })),
    });
  }
  return alertas;
}

export type SyncAlertRow = {
  codigo_dl: string;
  nombre: string | null;
  en_precios: boolean;
  en_checklist: boolean;
  en_zureo: boolean;
};

/** Alertas de sincronización entre Checklist de ingreso, planilla de costos y carga a Zureo (ERP). */
export function computeSyncAlertas(rows: SyncAlertRow[]): ProductAlert[] {
  const alertas: ProductAlert[] = [];

  const faltaEnZureo = rows.filter(r => r.en_checklist && !r.en_zureo);
  if (faltaEnZureo.length > 0) {
    alertas.push({
      tipo: "desincronizado_erp",
      severidad: "alta",
      titulo: `${faltaEnZureo.length} código(s) ingresados físicamente pero no cargados en Zureo`,
      detalle: "Van a faltar en el punto de venta y en el control de inventario del ERP hasta que se exporten manualmente.",
      productos: faltaEnZureo.map(r => ({ id: r.codigo_dl, codigo_dl: r.codigo_dl, nombre: r.nombre })),
    });
  }

  const faltaEnPrecios = rows.filter(r => r.en_checklist && !r.en_precios);
  if (faltaEnPrecios.length > 0) {
    alertas.push({
      tipo: "desincronizado_erp",
      severidad: "alta",
      titulo: `${faltaEnPrecios.length} código(s) en el checklist de ingreso pero sin costeo en PRECIOS_JOYAS`,
      detalle: "No tienen costo ni precio calculado — no se puede validar margen ni exportarlos correctamente.",
      productos: faltaEnPrecios.map(r => ({ id: r.codigo_dl, codigo_dl: r.codigo_dl, nombre: r.nombre })),
    });
  }

  const soloEnZureo = rows.filter(r => r.en_zureo && !r.en_checklist);
  if (soloEnZureo.length > 0) {
    alertas.push({
      tipo: "desincronizado_erp",
      severidad: "media",
      titulo: `${soloEnZureo.length} código(s) cargados en Zureo sin registro en el checklist de ingreso`,
      detalle: "Puede ser normal (carga histórica) o indicar que se saltearon el control de ingreso físico.",
      productos: soloEnZureo.map(r => ({ id: r.codigo_dl, codigo_dl: r.codigo_dl, nombre: r.nombre })),
    });
  }

  return alertas;
}
