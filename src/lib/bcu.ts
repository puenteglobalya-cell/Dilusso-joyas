/**
 * Cotizaciones USD/UYU desde el BCU (Banco Central del Uruguay).
 * Usado tanto por el cron diario (/api/cron/sync-tc) como por el botón
 * manual de administración (/api/admin/sync-tc).
 *
 * El BCU expone un WebService SOAP (no REST/JSON) en
 * https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsbcucotizaciones
 * Moneda 2225 = "Dólar USA Billete" (código oficial documentado por el BCU).
 */
import { createClientAsync } from "soap";

const WSDL_URL = "https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsbcucotizaciones?wsdl";
const MONEDA_USD = 2225;

// El servicio devuelve error 104 si el rango de fechas es muy largo; se
// consulta en tandas para no depender de cuál sea ese límite exacto.
const CHUNK_DAYS = 20;

const BCU_ERROR_CODES: Record<number, string> = {
  100: "no hay cotización para la fecha indicada",
  101: "código de moneda inexistente",
  102: "fecha inválida",
  103: "la fecha hasta es anterior a la fecha desde",
  104: "el rango de fechas supera el límite permitido por el BCU",
  105: "el grupo no existe o está deshabilitado",
  106: "servicio no disponible por actualización de datos",
  107: "servicio no disponible",
};

interface BcuDato {
  Fecha: string | null;
  Moneda: number;
  TCC: number; // tipo de cambio compra
  TCV: number; // tipo de cambio venta
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

async function fetchChunkFromBCU(desde: string, hasta: string): Promise<Map<string, number>> {
  const client = await createClientAsync(WSDL_URL);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result] = await (client as any).ExecuteAsync({
    Entrada: {
      Moneda: [{ item: MONEDA_USD }],
      Grupo: 0,
      FechaDesde: desde,
      FechaHasta: hasta,
    },
  });

  const status = result?.Salida?.respuestastatus;
  const codigo = status?.codigoerror ?? 0;
  if (codigo === 100) return new Map(); // sin cotización en el rango (feriados/fin de semana): no es error
  if (codigo !== 0) {
    throw new Error(`BCU error ${codigo}: ${BCU_ERROR_CODES[codigo] ?? "error desconocido"}`);
  }

  const datos = result?.Salida?.datoscotizaciones?.["datoscotizaciones.dato"] ?? [];
  const list: BcuDato[] = Array.isArray(datos) ? datos : [datos];

  const out = new Map<string, number>();
  for (const d of list) {
    if (!d?.Fecha || d.TCC == null || d.TCV == null) continue;
    const iso = String(d.Fecha).split("T")[0]; // el WSDL devuelve ISO 8601
    out.set(iso, Math.round(((d.TCC + d.TCV) / 2) * 100) / 100);
  }
  return out;
}

/** Devuelve un mapa fecha(YYYY-MM-DD) -> tasa para todo el rango pedido. */
export async function fetchTCRangeFromBCU(desde: string, hasta: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  let cur = desde;
  while (cur <= hasta) {
    const chunkEnd = addDays(cur, CHUNK_DAYS - 1) > hasta ? hasta : addDays(cur, CHUNK_DAYS - 1);
    const chunk = await fetchChunkFromBCU(cur, chunkEnd);
    for (const [k, v] of chunk) out.set(k, v);
    cur = addDays(chunkEnd, 1);
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
