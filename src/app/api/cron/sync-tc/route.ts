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

async function fetchTCFromBCU(date: string): Promise<number | null> {
  // date format: YYYY-MM-DD → BCU expects DD/MM/YYYY
  const [y, m, d] = date.split("-");
  const bcuDate = `${d}/${m}/${y}`;

  const body = JSON.stringify({
    Moneda: 2222,        // USD interbancario
    FechaDesde: bcuDate,
    FechaHasta: bcuDate,
  });

  const res = await fetch(BCU_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!res.ok) return null;

  const json = await res.json();
  // Response: { Cotizaciones: [{ CotizacionCompra, CotizacionVenta }] }
  const cotizaciones = json?.Cotizaciones;
  if (!cotizaciones?.length) return null;

  const { CotizacionCompra, CotizacionVenta } = cotizaciones[0];
  if (!CotizacionCompra || !CotizacionVenta) return null;

  return Math.round(((CotizacionCompra + CotizacionVenta) / 2) * 100) / 100;
}

export async function GET(req: NextRequest) {
  // Verify Vercel Cron secret
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const rate = await fetchTCFromBCU(today);

  if (!rate) {
    // Weekend or holiday — BCU returns no data, that's normal
    return NextResponse.json({ ok: true, skipped: true, date: today, reason: "sin cotización BCU (feriado/fin de semana)" });
  }

  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from("exchange_rates") as any).upsert(
    { date: today, rate, source: "BCU" },
    { onConflict: "date" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, date: today, rate, source: "BCU" });
}
