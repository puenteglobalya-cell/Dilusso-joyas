/**
 * Cotizaciones USD/UYU desde el BCU (Banco Central del Uruguay).
 * Usado tanto por el cron diario (/api/cron/sync-tc) como por el botón
 * manual de administración (/api/admin/sync-tc).
 */

const BCU_URL =
  "https://cotizaciones.bcu.gub.uy/wscotizaciones/ServicioWebSocketify/GetCotizacion";

function toBcuDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

/** Devuelve un mapa fecha(YYYY-MM-DD) -> tasa para todo el rango pedido. */
export async function fetchTCRangeFromBCU(desde: string, hasta: string): Promise<Map<string, number>> {
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

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`BCU respondió ${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`BCU no devolvió JSON válido: ${text.slice(0, 300)}`);
  }

  const out = new Map<string, number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cotizaciones = (json as any)?.Cotizaciones ?? [];
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function upsertTCRates(sb: any, rates: Map<string, number>): Promise<number> {
  let actualizados = 0;
  for (const [date, rate] of rates) {
    const { data: existing } = await sb.from("exchange_rates").select("id").eq("date", date).maybeSingle();
    if (existing) {
      const { error } = await sb.from("exchange_rates")
        .update({ fecha: date, usd_uyu: rate, rate, source: "BCU" })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sb.from("exchange_rates")
        .insert({ date, fecha: date, usd_uyu: rate, rate, source: "BCU" });
      if (error) throw new Error(error.message);
    }
    actualizados++;
  }
  return actualizados;
}
