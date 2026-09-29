/**
 * GET /api/cron/sync-tc
 *
 * Fetches today's USD/UYU exchange rate from BCU (Banco Central del Uruguay)
 * and upserts it into exchange_rates. Runs daily via Vercel Cron.
 *
 * Protected by CRON_SECRET env var (set in Vercel → Settings → Environment Variables).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { fetchTCRangeFromBCU, upsertTCRates } from "@/lib/bcu";

export const runtime = "nodejs";

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

  let rates: Map<string, number>;
  try {
    rates = await fetchTCRangeFromBCU(desde, hasta);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }

  if (!rates.size) {
    return NextResponse.json({ ok: true, skipped: true, desde, hasta, reason: "sin cotización BCU para el rango (feriados/fines de semana)" });
  }

  const sb = createServerClient();
  try {
    const actualizados = await upsertTCRates(sb, rates);
    return NextResponse.json({ ok: true, desde, hasta, actualizados, rates: Object.fromEntries(rates) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
