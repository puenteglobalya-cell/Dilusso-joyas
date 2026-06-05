import * as XLSX from "xlsx";

export interface ParsedTransaction {
  banco: string;
  fecha: string;
  detalle: string;
  movimiento: "salida" | "ingreso";
  importe_origen: number;
  moneda: string;
}

// ─── BBVA ────────────────────────────────────────────────────────────────────
// Expected columns: Fecha | Descripción | Débito | Crédito | Saldo
function parseBBVA(rows: unknown[][]): ParsedTransaction[] {
  const results: ParsedTransaction[] = [];
  const dataStart = rows.findIndex((r) => String(r[0]).toLowerCase().includes("fecha"));
  for (let i = dataStart + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;
    const fecha = parseExcelDate(row[0]);
    const detalle = String(row[1] ?? "").trim();
    const debito = parseNumber(row[2]);
    const credito = parseNumber(row[3]);
    if (!fecha || (!debito && !credito)) continue;
    results.push({
      banco: "BBVA",
      fecha,
      detalle,
      movimiento: debito ? "salida" : "ingreso",
      importe_origen: debito || credito || 0,
      moneda: "UYU",
    });
  }
  return results;
}

// ─── ITAÚ ─────────────────────────────────────────────────────────────────────
// Expected columns: Fecha | Descripción | Débito | Crédito | Saldo
function parseItau(rows: unknown[][]): ParsedTransaction[] {
  const results: ParsedTransaction[] = [];
  const dataStart = rows.findIndex((r) => String(r[0]).toLowerCase().includes("fecha"));
  for (let i = dataStart + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;
    const fecha = parseExcelDate(row[0]);
    const detalle = String(row[1] ?? "").trim();
    const debito = parseNumber(row[2]);
    const credito = parseNumber(row[3]);
    if (!fecha || (!debito && !credito)) continue;
    results.push({
      banco: "Itaú",
      fecha,
      detalle,
      movimiento: debito ? "salida" : "ingreso",
      importe_origen: debito || credito || 0,
      moneda: "UYU",
    });
  }
  return results;
}

// ─── OCA ──────────────────────────────────────────────────────────────────────
// Expected columns: Fecha | Comercio | Importe | Moneda
function parseOCA(rows: unknown[][]): ParsedTransaction[] {
  const results: ParsedTransaction[] = [];
  const dataStart = rows.findIndex((r) => String(r[0]).toLowerCase().includes("fecha"));
  for (let i = dataStart + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;
    const fecha = parseExcelDate(row[0]);
    const detalle = String(row[1] ?? "").trim();
    const importe = parseNumber(row[2]);
    const moneda = String(row[3] ?? "UYU").trim().toUpperCase();
    if (!fecha || !importe) continue;
    results.push({
      banco: "OCA",
      fecha,
      detalle,
      movimiento: "salida",
      importe_origen: Math.abs(importe),
      moneda,
    });
  }
  return results;
}

// ─── Tarjeta Itaú ─────────────────────────────────────────────────────────────
function parseTarjetaItau(rows: unknown[][]): ParsedTransaction[] {
  const results: ParsedTransaction[] = [];
  const dataStart = rows.findIndex((r) => String(r[0]).toLowerCase().includes("fecha"));
  for (let i = dataStart + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;
    const fecha = parseExcelDate(row[0]);
    const detalle = String(row[1] ?? "").trim();
    const importe = parseNumber(row[2]);
    const moneda = String(row[3] ?? "UYU").trim().toUpperCase();
    if (!fecha || !importe) continue;
    results.push({
      banco: "Tarjeta Itaú",
      fecha,
      detalle,
      movimiento: "salida",
      importe_origen: Math.abs(importe),
      moneda,
    });
  }
  return results;
}

// ─── Scotiabank ───────────────────────────────────────────────────────────────
function parseScotiabank(rows: unknown[][]): ParsedTransaction[] {
  const results: ParsedTransaction[] = [];
  const dataStart = rows.findIndex((r) => String(r[0]).toLowerCase().includes("fecha"));
  for (let i = dataStart + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;
    const fecha = parseExcelDate(row[0]);
    const detalle = String(row[1] ?? "").trim();
    const debito = parseNumber(row[2]);
    const credito = parseNumber(row[3]);
    if (!fecha || (!debito && !credito)) continue;
    results.push({
      banco: "Scotiabank",
      fecha,
      detalle,
      movimiento: debito ? "salida" : "ingreso",
      importe_origen: debito || credito || 0,
      moneda: "UYU",
    });
  }
  return results;
}

// ─── GENERIC PARSER ───────────────────────────────────────────────────────────
// Auto-detect columns from header row
export function parseGeneric(rows: unknown[][], banco: string): ParsedTransaction[] {
  if (rows.length < 2) return [];
  const headerRow = rows.findIndex((r) => r.some((c) => c != null));
  const headers = rows[headerRow].map((h) => String(h ?? "").toLowerCase().trim());

  const idx = {
    fecha: headers.findIndex((h) => h.includes("fecha") || h.includes("date")),
    detalle: headers.findIndex((h) => h.includes("detalle") || h.includes("descripci") || h.includes("concepto") || h.includes("comercio")),
    debito: headers.findIndex((h) => h.includes("déb") || h.includes("deb") || h.includes("salida") || h.includes("cargo")),
    credito: headers.findIndex((h) => h.includes("créd") || h.includes("cred") || h.includes("ingreso") || h.includes("abono")),
    importe: headers.findIndex((h) => h.includes("importe") || h.includes("monto") || h.includes("amount")),
    moneda: headers.findIndex((h) => h.includes("moneda") || h.includes("currency") || h.includes("curr")),
  };

  const results: ParsedTransaction[] = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => c == null)) continue;
    const fecha = idx.fecha >= 0 ? parseExcelDate(row[idx.fecha]) : null;
    if (!fecha) continue;
    const detalle = idx.detalle >= 0 ? String(row[idx.detalle] ?? "").trim() : "";
    const debito = idx.debito >= 0 ? parseNumber(row[idx.debito]) : 0;
    const credito = idx.credito >= 0 ? parseNumber(row[idx.credito]) : 0;
    const importe = idx.importe >= 0 ? parseNumber(row[idx.importe]) : null;
    const moneda = idx.moneda >= 0 ? String(row[idx.moneda] ?? "UYU").trim().toUpperCase() : "UYU";
    const amount = importe ?? debito ?? credito ?? 0;
    if (!amount) continue;
    results.push({
      banco,
      fecha,
      detalle,
      movimiento: importe != null ? (importe < 0 ? "salida" : "ingreso") : debito ? "salida" : "ingreso",
      importe_origen: Math.abs(amount),
      moneda,
    });
  }
  return results;
}

// ─── MAIN ENTRY POINT ─────────────────────────────────────────────────────────
export function parseExtracto(
  buffer: ArrayBuffer,
  banco: string
): ParsedTransaction[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false });

  const bancoNorm = banco.toLowerCase().replace(/\s+/g, "");
  if (bancoNorm.includes("bbva")) return parseBBVA(rows);
  if (bancoNorm.includes("itau") && !bancoNorm.includes("tarjeta")) return parseItau(rows);
  if (bancoNorm === "oca") return parseOCA(rows);
  if (bancoNorm.includes("tarjetaitau")) return parseTarjetaItau(rows);
  if (bancoNorm.includes("scotia")) return parseScotiabank(rows);
  return parseGeneric(rows, banco);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function parseNumber(val: unknown): number | null {
  if (val == null || val === "" || val === "-") return null;
  const n = Number(String(val).replace(/[^0-9.,-]/g, "").replace(",", "."));
  return isNaN(n) ? null : Math.abs(n);
}

function parseExcelDate(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    return val.toISOString().split("T")[0];
  }
  const str = String(val).trim();
  // dd/mm/yyyy or dd-mm-yyyy
  const m1 = str.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  // yyyy-mm-dd
  const m2 = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  // dd.mm.yyyy
  const m3 = str.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m3) return `${m3[3]}-${m3[2]}-${m3[1]}`;
  return null;
}
