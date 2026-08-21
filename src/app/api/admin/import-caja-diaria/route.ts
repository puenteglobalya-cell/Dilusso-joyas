/**
 * POST /api/admin/import-caja-diaria
 *
 * Importa el archivo "Controles de Caja Diaria" (una hoja por mes, más una
 * hoja "Consolidado" que se ignora) y reemplaza por completo la tabla
 * `settlements` con los períodos parseados.
 *
 * Las columnas se detectan por nombre de encabezado (no por posición fija),
 * porque el formato cambió entre meses del mismo archivo real:
 *  - Nov 2025 – Mayo 2026: una sola columna "Fecha venta" (texto libre o fecha)
 *  - Junio 2026 en adelante: columnas separadas "Fecha venta Desde" / "...hasta"
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
};

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function parseSheetMonth(name: string): { mes: number; año: number } | null {
  const m = stripAccents(name.trim().toLowerCase()).match(/^([a-z]+)\s+(\d{4})/);
  if (!m) return null;
  const mes = MESES[m[1]];
  if (!mes) return null;
  return { mes, año: parseInt(m[2]) };
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

interface Cols {
  desde: number; hasta: number; fondo: number; facturado: number; retiro: number;
  efectivo: number; tarjeta: number; fabadal: number; adelantos: number; gastos: number; cierre: number;
}

function findCol(header: unknown[], match: (h: string) => boolean): number {
  for (let i = 0; i < header.length; i++) {
    const h = stripAccents(String(header[i] ?? "").toLowerCase());
    if (match(h)) return i;
  }
  return -1;
}

function detectColumns(header: unknown[]): Cols {
  const hasHastaCol = findCol(header, h => h.includes("fecha venta hasta")) >= 0;
  return {
    desde: findCol(header, h => h.includes("fecha venta desde") || (h.includes("fecha venta") && !h.includes("hasta"))),
    hasta: hasHastaCol ? findCol(header, h => h.includes("fecha venta hasta")) : -1,
    fondo: findCol(header, h => h.includes("fondo apertura")),
    facturado: findCol(header, h => h.includes("facturaci")),
    retiro: findCol(header, h => h.includes("retiro de caja")),
    efectivo: findCol(header, h => h.includes("venta efectivo")),
    tarjeta: findCol(header, h => h.includes("venta tarjeta")),
    fabadal: findCol(header, h => h.includes("fabadal") || h.includes("fadaval")),
    adelantos: findCol(header, h => h.includes("adelantos de sueldo")),
    gastos: findCol(header, h => h.includes("gastos varios")),
    cierre: findCol(header, h => h.includes("cierre de caja")),
  };
}

// El texto de "Fecha venta" suele terminar en "/<mes>" y a veces "/<año o año
// abreviado>" — redundante con el mes/año que ya sabemos por el nombre de la
// hoja. Se remueve por segmento completo (separado por "/"), no por número
// individual, para no confundir un día real que coincida con el mes
// (ej. "4 a 6/6" en la hoja de Junio: el "6" del medio es el día, no ruido).
function stripTrailingNoiseSegments(raw: string, mes: number, año: number): string {
  const añoShort = año % 100;
  const segments = raw.split("/").map(s => s.trim());
  let end = segments.length;
  let popped = 0;
  while (end > 1 && popped < 2) {
    const seg = segments[end - 1];
    if (/^\d+$/.test(seg)) {
      const n = parseInt(seg, 10);
      if (n === mes || n === año || n === añoShort) { end--; popped++; continue; }
    }
    break;
  }
  return segments.slice(0, end).join("/");
}

function extractDayTokens(raw: string, mes: number, año: number): number[] {
  const stripped = stripTrailingNoiseSegments(raw, mes, año);
  let s = stripped.toLowerCase();
  s = s.replace(/\bal\b/g, ",").replace(/\ba\b/g, ",").replace(/\by\b/g, ",").replace(/\bde\b.*$/g, "");
  return (s.match(/[0-9]+/g) ?? []).map(Number);
}

interface PeriodResult {
  ok: boolean;
  desde?: string;
  hasta?: string;
  anomaly?: boolean;
  reason?: string;
}

function parsePeriod(rawDesde: unknown, rawHasta: unknown, mes: number, año: number): PeriodResult {
  if (rawDesde instanceof Date) {
    const anomaly = Math.abs((rawDesde.getFullYear() - año) * 12 + (rawDesde.getMonth() + 1 - mes)) > 1;
    const hasta = rawHasta instanceof Date ? rawHasta : rawDesde;
    return { ok: true, desde: toDateStr(rawDesde), hasta: toDateStr(hasta), anomaly };
  }

  const s = String(rawDesde ?? "").trim();
  if (!s || s.toLowerCase().startsWith("total")) return { ok: false, reason: "vacío/total" };

  const tokens = extractDayTokens(s, mes, año);
  if (tokens.length === 0) return { ok: false, reason: "sin números reconocibles" };

  const d1 = tokens[0];
  const d2 = tokens[tokens.length - 1];

  const desdeD = new Date(año, mes - 1, d1);
  if (desdeD.getMonth() !== mes - 1 || desdeD.getDate() !== d1) return { ok: false, reason: `día inválido: ${d1}` };

  const hastaDay = (typeof rawHasta === "number" && Number.isFinite(rawHasta)) ? Math.round(rawHasta) : d2;
  const hastaD = new Date(año, mes - 1, hastaDay);
  if (hastaD.getMonth() !== mes - 1 || hastaD.getDate() !== hastaDay || hastaD < desdeD) {
    return { ok: true, desde: toDateStr(desdeD), hasta: toDateStr(desdeD), anomaly: true, reason: `día de cierre inválido: ${hastaDay}` };
  }

  return { ok: true, desde: toDateStr(desdeD), hasta: toDateStr(hastaD), anomaly: false };
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });

  const settlements: Record<string, unknown>[] = [];
  const anomalies: { hoja: string; fila: number; valor: string; motivo?: string }[] = [];
  const noParseadas: { hoja: string; fila: number; valor: string; motivo?: string }[] = [];

  for (const sheetName of wb.SheetNames) {
    if (sheetName.trim().toLowerCase() === "consolidado") continue;
    const my = parseSheetMonth(sheetName);
    if (!my) continue;
    const { mes, año } = my;

    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
    if (rows.length === 0) continue;
    const cols = detectColumns(rows[0]);
    if (cols.desde < 0) continue;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row[cols.desde] == null) continue;
      const rawDesde = row[cols.desde];
      const s = String(rawDesde).trim();
      if (!s || s.toLowerCase().startsWith("total")) continue;
      const rawHasta = cols.hasta >= 0 ? row[cols.hasta] : null;

      const period = parsePeriod(rawDesde, rawHasta, mes, año);
      if (!period.ok) {
        noParseadas.push({ hoja: sheetName, fila: i + 1, valor: s, motivo: period.reason });
        continue;
      }
      if (period.anomaly) {
        anomalies.push({ hoja: sheetName, fila: i + 1, valor: s, motivo: period.reason });
        continue; // no se importa: requiere revisión manual en el archivo fuente
      }

      settlements.push({
        desde: period.desde,
        hasta: period.hasta,
        año, mes,
        fecha_control: null,
        facturado: num(row[cols.facturado]),
        retiro_reserva: num(row[cols.retiro]),
        efectivo: num(row[cols.efectivo]),
        tarjeta: num(row[cols.tarjeta]),
        fadaval: num(row[cols.fabadal]),
        gastos: num(row[cols.gastos]),
        adelanto_sueldos: num(row[cols.adelantos]),
        fondo_apertura: num(row[cols.fondo]),
        cierre_caja: num(row[cols.cierre]),
      });
    }
  }

  if (settlements.length === 0) {
    return NextResponse.json({ error: "No se encontraron períodos para importar en el archivo" }, { status: 400 });
  }

  const sb = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb.from("settlements") as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");

  let inserted = 0;
  let insertError: string | null = null;
  const CHUNK = 500;
  for (let i = 0; i < settlements.length; i += CHUNK) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb.from("settlements") as any).insert(settlements.slice(i, i + CHUNK));
    if (!error) inserted += Math.min(CHUNK, settlements.length - i);
    else insertError = error.message;
  }

  return NextResponse.json({
    ok: true,
    inserted,
    total: settlements.length,
    anomalias: anomalies,
    noParseadas,
    ...(insertError ? { insertError } : {}),
  });
}
