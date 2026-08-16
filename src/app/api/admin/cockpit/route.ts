import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

// Categorías consideradas costo fijo operativo (independiente del volumen de venta).
const CATEGORIAS_COSTO_FIJO = [
  "Alquiler local",
  "Empleados / sueldos",
  "Seguridad",
  "Seguro negocio",
  "Servicios (OSE/UTE/Antel)",
  "Gastos bancarios",
];
const CATEGORIAS_VENTA = ["Venta efectivo", "Venta tarjeta"];

type Row = {
  fecha: string;
  banco: string;
  cuenta: string | null;
  moneda: string;
  debito: number | null;
  credito: number | null;
  saldo: number | null;
  categoria_negocio: string | null;
  importe_uyu: number | null;
  tc: number | null;
};

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const sb = createServerClient();

  const desde90 = new Date();
  desde90.setDate(desde90.getDate() - 90);
  const desdeStr = desde90.toISOString().slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: statements, error: e1 } = await (sb.from("bank_statements") as any)
    .select("fecha, banco, cuenta, moneda, debito, credito, saldo, categoria_negocio, importe_uyu, tc")
    .gte("fecha", desdeStr)
    .neq("banco", "Efectivo")
    .order("fecha", { ascending: true });
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cashEntries, error: e2 } = await (sb.from("cash_entries") as any)
    .select("fecha, monto, movimiento, categoria_negocio")
    .gte("fecha", desdeStr);
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: latestTc } = await (sb.from("exchange_rates") as any)
    .select("usd_uyu, fecha").order("fecha", { ascending: false }).limit(1);
  const tcActual = latestTc?.[0]?.usd_uyu ?? null;

  const rows: Row[] = statements ?? [];

  // ── Luz 1: liquidez — último saldo conocido por cuenta, convertido a UYU ──
  const ultimoSaldoPorCuenta = new Map<string, Row>();
  for (const r of rows) {
    const key = `${r.banco}|${r.cuenta ?? ""}|${r.moneda}`;
    const prev = ultimoSaldoPorCuenta.get(key);
    if (!prev || r.fecha >= prev.fecha) ultimoSaldoPorCuenta.set(key, r);
  }
  let saldoTotalUyu = 0;
  const saldosPorCuenta: { banco: string; cuenta: string | null; moneda: string; saldo: number; saldo_uyu: number; fecha: string }[] = [];
  for (const r of ultimoSaldoPorCuenta.values()) {
    const saldo = r.saldo ?? 0;
    const saldoUyu = r.moneda === "USD" ? saldo * (tcActual ?? r.tc ?? 0) : saldo;
    saldoTotalUyu += saldoUyu;
    saldosPorCuenta.push({ banco: r.banco, cuenta: r.cuenta, moneda: r.moneda, saldo, saldo_uyu: Math.round(saldoUyu), fecha: r.fecha });
  }

  // ── Costo fijo mensual promedio (bancario + Lado B efectivo, últimos 3 meses) ──
  const mesesConDatos = new Set<string>();
  let costoFijoTotal = 0;
  for (const r of rows) {
    const mes = r.fecha.slice(0, 7);
    mesesConDatos.add(mes);
    if (r.categoria_negocio && CATEGORIAS_COSTO_FIJO.includes(r.categoria_negocio)) {
      costoFijoTotal += r.moneda === "USD" ? (r.importe_uyu ? Math.abs(r.importe_uyu) : (r.debito ?? 0) * (tcActual ?? 1)) : (r.debito ?? 0);
    }
  }
  for (const r of (cashEntries ?? []) as { fecha: string; monto: number; movimiento: string; categoria_negocio: string | null }[]) {
    const mes = r.fecha.slice(0, 7);
    mesesConDatos.add(mes);
    if (r.categoria_negocio && CATEGORIAS_COSTO_FIJO.includes(r.categoria_negocio) && r.movimiento === "salida") {
      costoFijoTotal += r.monto;
    }
  }
  const nMeses = Math.max(mesesConDatos.size, 1);
  const costoFijoMensual = costoFijoTotal / nMeses;
  const costoFijoDiario = costoFijoMensual / 30;
  const diasCobertura = costoFijoDiario > 0 ? saldoTotalUyu / costoFijoDiario : null;

  // ── Luz 6: punto de equilibrio del mes en curso ──
  const mesActual = new Date().toISOString().slice(0, 7);
  let ventasMesActual = 0;
  for (const r of rows) {
    if (r.fecha.slice(0, 7) !== mesActual) continue;
    if (r.categoria_negocio && CATEGORIAS_VENTA.includes(r.categoria_negocio)) {
      ventasMesActual += r.moneda === "USD" ? (r.importe_uyu ?? (r.credito ?? 0) * (tcActual ?? 1)) : (r.credito ?? 0);
    }
  }
  const diaDelMes = new Date().getDate();
  const metaAcumuladaAHoy = costoFijoDiario * diaDelMes;
  const pctCumplimiento = metaAcumuladaAHoy > 0 ? Math.round((ventasMesActual / metaAcumuladaAHoy) * 1000) / 10 : null;

  function semaforo(valor: number | null, verde: number, amarillo: number, invertido = false): "verde" | "amarillo" | "rojo" | "sin_datos" {
    if (valor === null) return "sin_datos";
    if (invertido) {
      if (valor <= verde) return "verde";
      if (valor <= amarillo) return "amarillo";
      return "rojo";
    }
    if (valor >= verde) return "verde";
    if (valor >= amarillo) return "amarillo";
    return "rojo";
  }

  return NextResponse.json({
    luz_1_liquidez: {
      saldo_total_uyu: Math.round(saldoTotalUyu),
      costo_fijo_diario_uyu: Math.round(costoFijoDiario),
      dias_cobertura: diasCobertura !== null ? Math.round(diasCobertura) : null,
      semaforo: semaforo(diasCobertura, 60, 30),
      saldos_por_cuenta: saldosPorCuenta,
    },
    luz_6_punto_equilibrio: {
      ventas_mes_actual_uyu: Math.round(ventasMesActual),
      meta_acumulada_a_hoy_uyu: Math.round(metaAcumuladaAHoy),
      pct_cumplimiento: pctCumplimiento,
      semaforo: semaforo(pctCumplimiento, 100, 85),
    },
    contexto: {
      costo_fijo_mensual_promedio_uyu: Math.round(costoFijoMensual),
      meses_analizados: nMeses,
      tc_actual: tcActual,
      categorias_costo_fijo_usadas: CATEGORIAS_COSTO_FIJO,
    },
    no_disponible: [
      { luz: "Luz 3 — Cuotas de tarjeta pendientes de cobro", motivo: "El extracto bancario no distingue cuotas futuras de tarjeta, solo el ingreso ya liquidado. Requiere datos del procesador de pago (ej. reporte de Zureo/adquirente)." },
    ],
  });
}
