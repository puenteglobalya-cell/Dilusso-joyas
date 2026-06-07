import * as XLSX from "xlsx";

export interface BankRow {
  banco: string;
  cuenta: string;
  fecha: string; // YYYY-MM-DD
  descripcion: string;
  numero: string | null;   // cheque number or document reference
  debito: number | null;
  credito: number | null;
  saldo: number | null;
  moneda: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** DD/MM/YYYY → YYYY-MM-DD */
function isoFromDMY(s: string): string | null {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const y = m[3].length === 2 ? "20" + m[3] : m[3];
  return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** ISO string (YYYY-MM-DD) passthrough */
function isoFromISO(s: string): string | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** US format: "1,234.56" → 1234.56 (BBVA XLS uses this format) */
function parseUS(s: string | number): number | null {
  if (typeof s === "number") return isNaN(s) ? null : s;
  if (!s || String(s).trim() === "") return null;
  const t = String(s).trim().replace(/,/g, ""); // strip thousands commas
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}

/** "1.234,56" or "1234.56" or raw number → number */
function parseUY(s: string | number): number | null {
  if (typeof s === "number") return isNaN(s) ? null : s;
  if (!s || s.trim() === "") return null;
  const t = s.trim();

  if (t.includes(",")) {
    // UY format: dots = thousands separator, comma = decimal
    const clean = t.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(clean);
    return isNaN(n) ? null : n;
  }

  // No comma: check if dot is decimal (≤2 digits after) or thousands (3 digits after)
  const lastDot = t.lastIndexOf(".");
  if (lastDot >= 0) {
    const decimals = t.length - lastDot - 1;
    if (decimals <= 2) {
      // e.g. "700.34" → 700.34 (US decimal from raw XLS number)
      const n = parseFloat(t);
      return isNaN(n) ? null : n;
    }
    // e.g. "26.150" → 26150 (UY thousands, no decimal part)
    const n = parseFloat(t.replace(/\./g, ""));
    return isNaN(n) ? null : n;
  }

  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}

/** Extract all UY-format numbers from end of a string */
function extractTrailingNumbers(s: string): { nums: number[]; rest: string } {
  const pattern = /(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s*$/;
  const nums: number[] = [];
  let str = s.trim();
  let m: RegExpMatchArray | null;
  while ((m = str.match(pattern)) !== null) {
    const n = parseUY(m[1]);
    if (n !== null) nums.unshift(n);
    str = str.slice(0, str.lastIndexOf(m[1])).trim();
    // Remove another trailing number
    const m2 = str.match(pattern);
    if (!m2) break;
    const n2 = parseUY(m2[1]);
    if (n2 !== null) nums.unshift(n2);
    str = str.slice(0, str.lastIndexOf(m2[1])).trim();
    break;
  }
  return { nums, rest: str };
}

// ── BBVA XLS ─────────────────────────────────────────────────────────────────

// Cuentas propias conocidas (para detección de transferencias entre cuentas)
export const CUENTAS_PROPIAS: Record<string, { banco: string; moneda: string; label: string }> = {
  "15051382-USD": { banco: "BBVA", moneda: "USD", label: "BBVA CC USD" },
  "15051382-UYU": { banco: "BBVA", moneda: "UYU", label: "BBVA CC UYU" },
  "365921":       { banco: "Itaú", moneda: "UYU", label: "Itaú 365921 UYU" },
  "365913":       { banco: "Itaú", moneda: "USD", label: "Itaú 365913 USD" },
};

export function detectXlsBanco(buffer: ArrayBuffer): "BBVA" | "Itaú" | "desconocido" {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const all = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  const row4 = ((all[4] ?? []) as string[]).map(c => String(c).toUpperCase());
  if (row4.some(c => c.includes("CUENTAS CORRIENTES"))) return "BBVA";
  const g5 = String(((all[4] ?? []) as string[])[6] ?? "");
  if (/365921|365913|[Dd][oó]lares/.test(g5)) return "Itaú";
  return "desconocido";
}

export function parseBBVAXls(buffer: ArrayBuffer): BankRow[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const all = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" });

  // ── Detectar moneda desde celda C5 (row 4, col 2) ──────────────────────────
  // BBVA XLS usa formato numérico AMERICANO: "1,234.56" (coma=miles, punto=decimal)
  // Celda B5 (row 4, col 1): "15051382 - CUENTAS CORRIENTES - 1 - USD" → USD
  //                          "15051382 - CUENTAS CORRIENTES - 0 - $"   → UYU
  const row4 = (all[4] ?? []) as string[];
  // Buscar en toda la fila 4 la celda que contiene "CUENTAS CORRIENTES"
  const productoCell = row4.map((c) => String(c).toUpperCase()).find((c) => c.includes("CUENTAS CORRIENTES")) ?? "";
  const moneda: string = /USD|US\$/.test(productoCell) ? "USD" : "UYU";

  let cuenta = "";
  const cuentaMatch = productoCell.match(/(\d{6,12})\s*-\s*CUENTAS/);
  if (cuentaMatch) cuenta = cuentaMatch[1];

  // ── Saldo Anterior: buscarlo en filas 2-6 (junto al label "Saldo Anterior") ──
  let saldoAnterior: number | null = null;
  let periodoFecha: string | null = null;

  for (let i = 0; i < Math.min(15, all.length); i++) {
    const r = all[i] as string[];
    const rowText = r.join(" ");
    if (saldoAnterior === null) {
      const saIdx = r.findIndex((c) => String(c).toLowerCase().includes("saldo anterior"));
      if (saIdx >= 0) {
        for (let j = saIdx + 1; j < r.length; j++) {
          // BBVA usa formato US: "144,089.78"
          const v = parseUS(String(r[j] ?? "").trim());
          if (v !== null && v > 0) { saldoAnterior = v; break; }
        }
      }
    }
    if (!periodoFecha) {
      const pm = rowText.match(/(\d{2}\/\d{2}\/\d{4})\s*-/);
      if (pm) periodoFecha = isoFromDMY(pm[1]);
    }
  }

  // ── Encontrar fila de encabezado de tabla ───────────────────────────────────
  const headerIdx = all.findIndex((r) => {
    const row = r as string[];
    return row.some((c) => String(c).toLowerCase().trim() === "fecha");
  });
  if (headerIdx < 0) return [];

  const headerRow = all[headerIdx] as string[];
  const colIdx = (names: string[]) =>
    headerRow.findIndex((c) => names.some((n) => String(c).toLowerCase().trim().includes(n)));

  const iFecha   = colIdx(["fecha"]);
  const iConcepto = colIdx(["concepto"]);
  const iRef     = colIdx(["referencia", "número", "numero", "nro"]);
  const iDebito  = colIdx(["débito", "debito"]);
  const iCredito = colIdx(["crédito", "credito"]);
  const iSaldo   = colIdx(["saldo"]);

  const rows: BankRow[] = [];

  if (saldoAnterior !== null && periodoFecha) {
    rows.push({
      banco: "BBVA", cuenta,
      fecha: periodoFecha,
      descripcion: "Saldo anterior",
      numero: null,
      debito: null, credito: null,
      saldo: saldoAnterior,
      moneda,
    });
  }

  for (let i = headerIdx + 1; i < all.length; i++) {
    const r = all[i] as string[];
    const fechaRaw = iFecha >= 0 ? String(r[iFecha] ?? "").trim() : "";
    if (!fechaRaw) continue;

    const fecha = isoFromISO(fechaRaw) ?? isoFromDMY(fechaRaw);
    if (!fecha) continue;

    const concepto = iConcepto >= 0 ? String(r[iConcepto] ?? "").trim() : "";
    const numeroRaw = iRef >= 0 ? String(r[iRef] ?? "").trim() : "";
    const numero = numeroRaw && numeroRaw !== "0" ? numeroRaw : null;
    // BBVA usa formato US ("1,234.56") — usar parseUS
    const debito  = iDebito  >= 0 ? parseUS(r[iDebito])  : null;
    const credito = iCredito >= 0 ? parseUS(r[iCredito]) : null;
    const saldo   = iSaldo   >= 0 ? parseUS(r[iSaldo])   : null;

    rows.push({ banco: "BBVA", cuenta, fecha, descripcion: concepto, numero, debito, credito, saldo, moneda });
  }

  rows.sort((a, b) => {
    if (a.descripcion === "Saldo anterior") return -1;
    if (b.descripcion === "Saldo anterior") return 1;
    return a.fecha.localeCompare(b.fecha);
  });

  return rows;
}

// ── Itaú XLS ─────────────────────────────────────────────────────────────────

export function parseItauXls(buffer: ArrayBuffer): BankRow[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const all = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" });

  // ── Detectar moneda y cuenta desde celda G5 (row 4, col 6) ─────────────────
  // "365921"              → UYU, cuenta 365921
  // "Dólares\t365913"     → USD, cuenta 365913
  const row4 = (all[4] ?? []) as string[];
  const g5 = String(row4[6] ?? "").trim();
  let cuenta = "";
  let moneda = "UYU";

  // Buscar número de cuenta (6+ dígitos) en la celda
  const nroCuentaMatch = g5.match(/(\d{6,})/);
  if (nroCuentaMatch) cuenta = nroCuentaMatch[1];

  if (/dólar|dollar|usd/i.test(g5) || cuenta === "365913") moneda = "USD";
  if (cuenta === "365921") moneda = "UYU";

  // ── Header row ──────────────────────────────────────────────────────────────
  const headerIdx = all.findIndex((r) => {
    const row = r as string[];
    return row.some((c) => String(c).toLowerCase().trim() === "fecha");
  });
  if (headerIdx < 0) return [];

  const headerRow = all[headerIdx] as string[];
  const colIdx = (names: string[]) =>
    headerRow.findIndex((c) => names.some((n) => String(c).toLowerCase().trim().includes(n)));

  const iFecha   = colIdx(["fecha"]);
  const iConcepto = colIdx(["concepto", "descripci"]);
  const iDebito  = colIdx(["débito", "debito"]);
  const iCredito = colIdx(["crédito", "credito"]);
  const iSaldo   = colIdx(["saldo"]);

  const rows: BankRow[] = [];
  for (let i = headerIdx + 1; i < all.length; i++) {
    const r = all[i] as string[];
    const fechaRaw = iFecha >= 0 ? String(r[iFecha] ?? "").trim() : String(r[1] ?? "").trim();
    if (!fechaRaw) continue;

    const fecha = isoFromDMY(fechaRaw) ?? isoFromISO(fechaRaw);
    if (!fecha) continue;

    const concepto = iConcepto >= 0 ? String(r[iConcepto] ?? "").trim() : String(r[2] ?? "").trim();
    if (concepto.toLowerCase().includes("saldo anterior") || concepto.toLowerCase().includes("saldo final")) continue;

    const debito  = iDebito  >= 0 ? parseUY(r[iDebito])  : parseUY(r[4]);
    const credito = iCredito >= 0 ? parseUY(r[iCredito]) : parseUY(r[5]);
    const saldo   = iSaldo   >= 0 ? parseUY(r[iSaldo])   : parseUY(r[6]);

    if (!concepto && debito === null && credito === null) continue;

    rows.push({ banco: "Itaú", cuenta, fecha, descripcion: concepto, numero: null, debito, credito, saldo, moneda });
  }
  return rows;
}

// ── OCA PDF ──────────────────────────────────────────────────────────────────

export function parseOcaPdf(text: string): BankRow[] {
  const DATE_RE = /(\d{2}\/\d{2}\/\d{4})/g;
  const rows: BankRow[] = [];

  // Extract emission date from header (e.g. "Período: noviembre 2025" or a date near top)
  // OCA PDFs have "Fecha de emisión DD/MM/YYYY" or just a date in header
  let emisionDate: string | null = null;
  const emPat = text.match(/[Ff]echa\s+de\s+emisi[oó]n[^\d]*(\d{2})\/(\d{2})\/(\d{4})/);
  if (emPat) {
    emisionDate = `${emPat[3]}-${emPat[2]}-${emPat[1]}`;
  } else {
    // Fallback: first DD/MM/YYYY date in header area (first 800 chars)
    const headerMatch = text.slice(0, 800).match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (headerMatch) {
      const candidate = `${headerMatch[3]}-${headerMatch[2]}-${headerMatch[1]}`;
      const d = new Date(candidate + "T12:00:00Z");
      if (!isNaN(d.getTime())) emisionDate = candidate;
    }
  }
  const emisionYM = emisionDate?.slice(0, 7) ?? null;

  // Find table start (header may be split across lines)
  const headerMarker = "FechaConceptoDébitoCréditoSaldo";
  const headerMarker2 = "Fecha Concepto";
  const startIdx1 = text.indexOf(headerMarker);
  const startIdx2 = text.indexOf(headerMarker2);
  const startIdx = startIdx1 >= 0 ? startIdx1 + headerMarker.length
    : startIdx2 >= 0 ? startIdx2 + headerMarker2.length
    : 0;
  const tableText = text.slice(startIdx);

  // Split by date — content between dates may span multiple lines
  const parts = tableText.split(DATE_RE).filter(Boolean);

  // Number patterns: "1.234,56" (UY with decimal)
  const NUM_UY = /\d{1,3}(?:\.\d{3})*,\d{2}/g;

  // Extract account number from header area
  const cuentaMatch = text.match(/\b(\d{7,10})\b/);
  const cuenta = cuentaMatch ? cuentaMatch[1] : "OCA";

  let prevSaldo: number | null = null;
  for (let i = 0; i < parts.length; i++) {
    const dateStr = parts[i].trim();
    if (!dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) continue;

    const txFecha = isoFromDMY(dateStr);
    if (!txFecha) continue;
    // Use emission date for installments from prior periods (same logic as Itaú Card)
    const fecha = (emisionDate && emisionYM && txFecha.slice(0, 7) !== emisionYM)
      ? emisionDate
      : txFecha;

    const rawContent = parts[i + 1] ?? "";
    let content = rawContent.replace(/\s+/g, " ").trim();

    // Strip "Saldo final..." suffix (appears at end of last month with no own date)
    const saldoFinalIdx = content.toLowerCase().indexOf("saldo final");
    if (saldoFinalIdx >= 0) content = content.slice(0, saldoFinalIdx).trim();

    if (content.toLowerCase().startsWith("saldo")) {
      const nums = content.match(NUM_UY);
      if (nums) {
        const saldoAnterior = parseUY(nums[nums.length - 1]);
        prevSaldo = saldoAnterior;
        // Insert "Saldo anterior" as an opening balance row
        rows.push({
          banco: "OCA",
          cuenta,
          fecha,
          descripcion: "Saldo anterior", numero: null,
          debito: null,
          credito: null,
          saldo: saldoAnterior,
          moneda: "UYU",
        });
      }
      continue;
    }

    // Extract all UY-format numbers (X.XXX,XX) from content using matchAll to get positions
    const numMatches = [...content.matchAll(new RegExp(NUM_UY.source, "g"))];

    if (numMatches.length < 1) continue;

    const last = numMatches[numMatches.length - 1];
    const secondLast = numMatches.length >= 2 ? numMatches[numMatches.length - 2] : null;

    const saldo = parseUY(last[0]);
    let rawAmountStr = secondLast ? secondLast[0] : null;
    let amount = rawAmountStr ? parseUY(rawAmountStr) : null;

    // Concept = everything before the second-to-last number (or last if only one)
    const numStart = secondLast ? secondLast.index! : last.index!;
    let concepto = content.slice(0, numStart).trim();

    // Fix digit bleed: op numbers like OP264024 concatenated with amount 7.733,73
    // become OP2640247.733,73 — detect by checking if stripping leading digits satisfies balance
    if (rawAmountStr && amount !== null && saldo !== null && prevSaldo !== null) {
      const diff = Math.abs(saldo - prevSaldo);
      if (Math.abs(diff - amount) > 1) {
        // Amount doesn't satisfy balance — try stripping 1, 2, 3 leading chars
        for (let strip = 1; strip <= 4; strip++) {
          const candidate = rawAmountStr.slice(strip);
          if (!/^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(candidate)) continue;
          const val = parseUY(candidate);
          if (val === null) continue;
          if (Math.abs(Math.abs(saldo - prevSaldo) - val) <= 1) {
            // Restore stripped prefix to description
            concepto = (concepto + rawAmountStr.slice(0, strip)).trim();
            amount = val;
            break;
          }
        }
      }
    }

    // Debit/credit from balance direction
    let debito: number | null = null;
    let credito: number | null = null;
    if (amount !== null && saldo !== null && prevSaldo !== null) {
      if (saldo > prevSaldo) credito = amount;
      else debito = amount;
    } else if (amount !== null) {
      if (concepto.toUpperCase().includes("ENT") || concepto.toUpperCase().includes("CREDITO")) {
        credito = amount;
      } else {
        debito = amount;
      }
    }

    prevSaldo = saldo;
    rows.push({ banco: "OCA", cuenta, fecha, descripcion: concepto, numero: null, debito, credito, saldo, moneda: "UYU" });
  }

  return rows;
}

// ── BBVA PDF ─────────────────────────────────────────────────────────────────

export function parseBBVAPdf(text: string): BankRow[] {
  const rows: BankRow[] = [];

  // Account number: label "Cuenta :" is on one line, number on the next
  const lines = text.split("\n");
  let cuenta = "";
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^Cuenta\s*:?\s*$/.test(lines[i].trim())) {
      const next = lines[i + 1].trim();
      if (/^\d{6,12}$/.test(next)) { cuenta = next; break; }
    }
    // Also try inline: "Cuenta : 15051382"
    const inlineM = lines[i].match(/Cuenta\s*:?\s*(\d{6,12})/);
    if (inlineM) { cuenta = inlineM[1]; break; }
  }

  const NUM_PAT = /(\d{1,3}(?:\.\d{3})*,\d{2})/g;
  interface Pending { date: string; moneda: string; parts: string[] }
  const pending: Pending[] = [];
  let currentMoneda = "UYU";

  // Single pass: update moneda when currency header found, collect transactions
  const SKIP = /^(Fecha|Per[ií]odo|P[aá]gina|Cuenta|BBVA|Rogamos|También|casilla|consultar|través|Oficinas|Uruguay|respecto|comisiones|último|Comunicamos)/i;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.includes("PESOS URUGUAYOS")) { currentMoneda = "UYU"; continue; }
    if (trimmed.includes("DOLARES U.S.A.")) { currentMoneda = "USD"; continue; }
    if (trimmed.includes("Fecha  Descripcion")) continue;
    if (SKIP.test(trimmed)) continue;

    const dm = trimmed.match(/^(\d{1,2})\/(\d{2})\/(\d{2,4})\s/);
    if (dm) {
      const y = dm[3].length === 2 ? "20" + dm[3] : dm[3];
      const fecha = `${y}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
      pending.push({ date: fecha, moneda: currentMoneda, parts: [trimmed.slice(dm[0].length)] });
    } else if (pending.length > 0) {
      pending[pending.length - 1].parts.push(trimmed);
    }
  }

  // Process each transaction grouped by moneda (track prevSaldo per moneda)
  const prevSaldoMap: Record<string, number | null> = { UYU: null, USD: null };

  for (const tx of pending) {
    const combined = tx.parts.join(" ").trim();
    const allNums = [...combined.matchAll(NUM_PAT)].map(m => m[1]);
    if (allNums.length === 0) continue;

    const saldo = parseUY(allNums[allNums.length - 1]);
    const amount = allNums.length >= 2 ? parseUY(allNums[allNums.length - 2]) : null;

    // Concept: everything before first number, strip embedded "fecha valor"
    const firstNumIdx = combined.search(NUM_PAT);
    let concepto = combined.slice(0, firstNumIdx).trim();
    concepto = concepto.replace(/\s+\d{1,2}\/\d{2}\/\d{2,4}\s*$/, "").trim();
    if (!concepto) { prevSaldoMap[tx.moneda] = saldo; continue; } // saldo anterior

    const chequeMatch = concepto.match(/CLEARING\s+(\d{6,})/i) ?? concepto.match(/CHEQUE.*?(\d{6,})/i);
    const numero = chequeMatch ? chequeMatch[1] : null;

    let debito: number | null = null;
    let credito: number | null = null;
    const prevSaldo = prevSaldoMap[tx.moneda];

    if (amount !== null && saldo !== null && prevSaldo !== null) {
      const diff = Math.round((saldo - prevSaldo) * 100) / 100;
      if (diff >= 0) credito = amount;
      else debito = amount;
    }

    prevSaldoMap[tx.moneda] = saldo;
    rows.push({ banco: "BBVA", cuenta, fecha: tx.date, descripcion: concepto, numero, debito, credito, saldo, moneda: tx.moneda });
  }

  return rows;
}

// ── Scotiabank PDF ────────────────────────────────────────────────────────────

const _SCOTIABANK_IGNORAR = [
  "TOTAL Tarjeta", "Total Transacciones", "IVA sobre",
  "CARGO COMPRA EN EL EXTERI",
];

export function parseScotiabankPdf(text: string): BankRow[] {
  const rows: BankRow[] = [];

  // Account number: first 8-digit sequence starting with "4318"
  const cuentaMatch = text.match(/\b(4318\d{4})\b/);
  const cuenta = cuentaMatch ? cuentaMatch[1] : "43185955";

  // Emission date: Scotiabank encodes it as account+DDMMYYYY on line 3
  // e.g. "4318595513062025" = account(43185955) + date(13062025)
  let emisionDate: string | null = null;
  const encodedMatch = text.match(/\b4318\d{4}(\d{2})(\d{2})(\d{4})\b/);
  if (encodedMatch) {
    emisionDate = `${encodedMatch[3]}-${encodedMatch[2]}-${encodedMatch[1]}`;
  } else {
    // Fallback: find "Fecha de emisión" and get the date that precedes it
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const emIdx = lines.findIndex(l => l.includes("Fecha de emisi"));
    if (emIdx > 0) {
      const m = lines[emIdx - 1].match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
      if (m) {
        const y = m[3].length === 2 ? "20" + m[3] : m[3];
        emisionDate = `${y}-${m[2]}-${m[1]}`;
      }
    }
  }
  const emisionYM = emisionDate ? emisionDate.slice(0, 7) : null;

  const lines = text.split("\n");

  for (const line of lines) {
    // Skip totals lines
    if (line.trimStart().startsWith("**")) continue;

    const trimmed = line.trim();
    if (!trimmed) continue;
    if (_SCOTIABANK_IGNORAR.some(ign => trimmed.toUpperCase().includes(ign.toUpperCase()))) continue;

    // Date is the first 8 chars: DD/MM/YY (NO space after — glued to description)
    const dateMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{2,4})/);
    if (!dateMatch) continue;

    const y = dateMatch[3].length === 2 ? "20" + dateMatch[3] : dateMatch[3];
    const txDate = `${y}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;
    const fecha = (emisionDate && emisionYM && txDate.slice(0, 7) !== emisionYM)
      ? emisionDate
      : txDate;

    // Rest: everything after the date — preserve original spacing for column detection
    // Find position of date in original (unstripped) line
    const lineOffset = line.indexOf(trimmed);
    const rest = line.slice(lineOffset + dateMatch[0].length);

    // Find the last number in the rest and how much whitespace precedes it
    const numPattern = /(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})/g;
    const allMatches = [...rest.matchAll(numPattern)];
    if (allMatches.length === 0) continue;

    const lastMatch = allMatches[allMatches.length - 1];
    const lastMatchIdx = lastMatch.index!;

    // Count whitespace chars immediately before this number
    let wsCount = 0;
    for (let i = lastMatchIdx - 1; i >= 0; i--) {
      if (rest[i] === " " || rest[i] === "\t") wsCount++;
      else break;
    }

    // Determine currency: 15+ spaces before last number → USD, else UYU
    const moneda = wsCount >= 15 ? "USD" : "UYU";

    const rawAmount = lastMatch[1];
    const amount = parseUY(rawAmount);
    if (amount === null) continue;

    // Description: everything before the last number, clean cuota notation (06/06, C04/10, 07/10)
    let concepto = rest.slice(0, lastMatchIdx).trim();
    concepto = concepto.replace(/\s*C?\d{1,2}\/\d{1,2}\s*$/, "").trim();
    if (!concepto || concepto.length < 2) continue;

    // Payments ("PAGO") are credits; negative sign also indicates payment
    const isPayment = concepto.toUpperCase().includes("PAGO") || amount < 0;
    const absAmount = Math.abs(amount);
    if (absAmount === 0) continue;

    rows.push({
      banco: "Scotiabank",
      cuenta,
      fecha,
      descripcion: concepto,
      numero: null,
      debito: isPayment ? null : absAmount,
      credito: isPayment ? absAmount : null,
      saldo: null,
      moneda,
    });
  }

  return rows;
}

// ── Itaú Tarjeta (Credit Card PDF) ───────────────────────────────────────────
const _ITAU_CARD_INGRESO = ["PAGOS", "REVERSAL", "DEV.", "DEVOLUCION", "REVERSION"];
const _ITAU_CARD_IGNORAR = [
  "SALDO DEL ESTADO", "** TOTAL", "TOTAL TRANSACCIONES",
  "SALDO CONTADO", "UD. HA GENERADO", "FECHA DETALLE", "En este mes",
];

export function parseItauCardPdf(text: string): BankRow[] {
  const rows: BankRow[] = [];

  function isValidDate(iso: string): boolean {
    const d = new Date(iso + "T12:00:00Z");
    return !isNaN(d.getTime()) && d.toISOString().startsWith(iso);
  }

  function buildIso(dd: string, mm: string, yy: string): string | null {
    const y = yy.length === 2 ? "20" + yy : yy.slice(-4);
    const iso = `${y}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    return isValidDate(iso) ? iso : null;
  }

  // Extract emission date — look for "Fecha de emisión" label first,
  // then fall back to the FIRST valid date in the header (top of page)
  let emisionDate: string | null = null;
  const emPat1 = text.match(/[Ff]echa\s+de\s+emisi.n[\s\S]{0,30}?(\d{2})\/(\d{2})\/(\d{2,4})/);
  if (emPat1) {
    emisionDate = buildIso(emPat1[1], emPat1[2], emPat1[3]);
  }
  if (!emisionDate) {
    // Fallback: scan first 600 chars, take the FIRST valid date (emission date appears first)
    const headerDates = text.slice(0, 600).match(/(\d{2})\/(\d{2})\/(\d{2,4})/g) ?? [];
    for (const raw of headerDates) {
      const m = raw.match(/(\d{2})\/(\d{2})\/(\d{2,4})/)!;
      const candidate = buildIso(m[1], m[2], m[3]);
      if (candidate) { emisionDate = candidate; break; }
    }
  }
  const emisionYM = emisionDate ? emisionDate.slice(0, 7) : null;

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (_ITAU_CARD_IGNORAR.some((ign) => trimmed.toUpperCase().includes(ign.toUpperCase()))) continue;

    // Match lines with leading spaces then: DD MM YY rest (date with spaces between components)
    const m = trimmed.match(/^(\d{2})\s(\d{2})\s(\d{2})\s+(.+)$/);
    if (!m) continue;

    const [, d, mo, y2, rest] = m;
    const txDate = buildIso(d, mo, y2);
    if (!txDate) continue; // skip lines with invalid dates (e.g. day 31 in Feb)
    // Use emission date for installments from prior periods
    const fecha = (emisionDate && emisionYM && txDate.slice(0, 7) !== emisionYM)
      ? emisionDate
      : txDate;

    // Strip leading card number like "9008 "
    let detail = rest;
    if (/^\d{4}\s/.test(detail)) detail = detail.slice(5);
    // detail still has original spacing for whitespace-column detection

    // Match UY numbers: optional minus, digits (with optional dot-thousands), comma+2decimals
    // \d[\d.]* allows 4+ digit numbers without thousands separator (e.g. 1267,00)
    const numPat = /(-?\d[\d.]*,\d{2})/g;
    const allMatches = [...detail.matchAll(numPat)];
    if (allMatches.length === 0) continue;

    // Build concept: everything before the first number, strip cuota notation X/ Y or X/Y
    const firstMatch = allMatches[0];
    let concepto = detail.slice(0, firstMatch.index!).trim();
    concepto = concepto.replace(/\s+C?\d+\/\s*\d+\s*$/, "").replace(/\s{2,}/g, " ").trim();
    if (!concepto || concepto.length < 2) continue;

    // Determine currency and amount using whitespace-position rules on last two numbers
    let moneda: string;
    let importe: number;

    if (allMatches.length >= 2) {
      const secondLastMatch = allMatches[allMatches.length - 2];
      const lastMatch = allMatches[allMatches.length - 1];
      const v1 = Math.abs(parseUY(secondLastMatch[1]) ?? 0); // Importe $ (UYU column)
      const v2 = Math.abs(parseUY(lastMatch[1]) ?? 0);       // Importe U$S column

      // Count whitespace before last number to detect USD-only single entry
      let wsBeforeLast = 0;
      for (let i = lastMatch.index! - 1; i >= 0; i--) {
        if (detail[i] === " " || detail[i] === "\t") wsBeforeLast++;
        else break;
      }

      if (v1 > 0 && v2 > 0) {
        const bigSmall = Math.max(v1, v2) / Math.min(v1, v2);
        if (bigSmall < 3) {
          // Both amounts close to each other → USD transaction
          // Use Importe U$S (last column = v2) — actual USD cost
          moneda = "USD"; importe = v2;
        } else if (bigSmall >= 30 && bigSmall <= 65) {
          // TC conversion: larger is UYU, smaller is USD
          moneda = "UYU"; importe = Math.max(v1, v2);
        } else {
          // Unclear: take larger as UYU
          moneda = "UYU"; importe = Math.max(v1, v2);
        }
      } else {
        // One of them is zero
        moneda = "UYU"; importe = v1 > 0 ? v1 : v2;
      }
    } else {
      // Single amount → always UYU (USD transactions always have 2 amounts)
      moneda = "UYU";
      importe = Math.abs(parseUY(allMatches[0][1]) ?? 0);
    }

    if (importe === 0) continue;

    const isIngreso = _ITAU_CARD_INGRESO.some((kw) => concepto.toUpperCase().includes(kw));

    rows.push({
      banco: "Itau-Card",
      cuenta: "tarjeta",
      fecha,
      descripcion: concepto,
      numero: null,
      debito: isIngreso ? null : importe,
      credito: isIngreso ? importe : null,
      saldo: null,
      moneda,
    });
  }

  return rows;
}
