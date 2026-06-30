/**
 * GET /api/cron/sync-tc
 *
 * Fetches today's USD/UYU exchange rate from BCU (Banco Central del Uruguay)
 * and upserts it into exchange_rates. Runs daily via Vercel Cron.
 *
 * BCU SOAP endpoint returns the official "interbancario" buying/selling rates.
 * We store the midpoint (compra + venta) / 2.
 *
 * Protected by CRON_SECRET env var (set in Vercel → Settings → Environment Variables).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

// BCU web service — returns XML with moneda 2222 = USD interbancario
const BCU_URL =
  "https://cotizaciones.bcu.gub.uy/wscotizaciones/ServicioWebSocketify/GetCotizacion";

function toBcuDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

// Devuelve un mapa fecha(YYYY-MM-DD) -> tasa para todo el rango pedido
async function fetchTCRangeFromBCU(desde: string, hasta: string): Promise<Map<string, number>> {
  const body = JSON.stringify({
    Moneda: 2222, // USD interbancario
    FechaDesde: toBcuDate(desde),
    FechaHasta: toBcuDate(hasta),
  });

  const res = await fetch(BCU_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  const out = new Map<string, number>();
  if (!res.ok) return out;

  const json = await res.json();
  const cotizaciones = json?.Cotizaciones ?? [];
  for (const c of cotizaciones) {
    const { Fecha, CotizacionCompra, CotizacionVenta } = c;
    if (!Fecha || !CotizacionCompra || !CotizacionVenta) continue;
    // Fecha viene como DD/MM/YYYY
    const [d, m, y] = String(Fecha).split("/");
    const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    out.set(iso, Math.round(((CotizacionCompra + CotizacionVenta) / 2) * 100) / 100);
  }
  return out;
}

export async function GET(req: NextRequest) {
  // Verify Vercel Cron secret
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const { searchParams } = new URL(req.url);
  const desde = searchParams.get("desde") ?? today;
  const hasta = searchParams.get("hasta") ?? today;

  const rates = await fetchTCRangeFromBCU(desde, hasta);

  if (!rates.size) {
    return NextResponse.json({ ok: true, skipped: true, desde, hasta, reason: "sin cotización BCU para el rango (feriados/fines de semana)" });
  }

  const sb = createServerClient();
  // No hay constraint único en "date", así que hacemos upsert manual: buscar fila existente y update, o insert.
  let actualizados = 0;
  for (const [date, rate] of rates) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (sb.from("exchange_rates") as any)
      .select("id")
      .eq("date", date)
      .maybeSingle();

    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (sb.from("exchange_rates") as any)
        .update({ fecha: date, usd_uyu: rate, rate, source: "BCU" })
        .eq("id", existing.id);
      if (error) return NextResponse.json({ error: error.message, date }, { status: 500 });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (sb.from("exchange_rates") as any)
        .insert({ date, fecha: date, usd_uyu: rate, rate, source: "BCU" });
      if (error) return NextResponse.json({ error: error.message, date }, { status: 500 });
    }
    actualizados++;
  }

  return NextResponse.json({ ok: true, desde, hasta, actualizados, rates: Object.fromEntries(rates) });
}
