/**
 * POST /api/admin/sync-tc
 *
 * Botón manual de "Actualizar cotizaciones" en Herramientas. Corre desde el
 * navegador del usuario (o desde Vercel), no desde un sandbox con egress
 * restringido, así que puede llegar al BCU sin depender del cron.
 *
 * Body opcional: { desde?: "YYYY-MM-DD", hasta?: "YYYY-MM-DD" }
 * Sin body: completa automáticamente desde el día siguiente a la última
 * cotización guardada en exchange_rates hasta hoy.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { fetchTCRangeFromBCU, upsertTCRates } from "@/lib/bcu";

export const runtime = "nodejs";

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({})) as { desde?: string; hasta?: string };
  const today = new Date().toISOString().split("T")[0];

  const sb = createServerClient();

  let desde = body.desde;
  if (!desde) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: last } = await (sb.from("exchange_rates") as any).select("date").order("date", { ascending: false }).limit(1).maybeSingle();
    desde = last?.date ? addDays(last.date, 1) : today;
  }
  const hasta = body.hasta ?? today;

  if (desde > hasta) {
    return NextResponse.json({ ok: true, actualizados: 0, desde, hasta, reason: "ya está al día" });
  }

  let rates: Map<string, number>;
  try {
    rates = await fetchTCRangeFromBCU(desde, hasta);
  } catch (e) {
    return NextResponse.json({ error: `No se pudo conectar al BCU: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }

  if (!rates.size) {
    return NextResponse.json({ ok: true, actualizados: 0, desde, hasta, reason: "sin cotización BCU para el rango (feriados/fines de semana, o rango ya cargado)" });
  }

  try {
    const actualizados = await upsertTCRates(sb, rates);
    const fechas = [...rates.keys()].sort();
    return NextResponse.json({
      ok: true,
      desde, hasta, actualizados,
      primera: fechas[0],
      ultima: fechas[fechas.length - 1],
      ultimoValor: rates.get(fechas[fechas.length - 1]),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
