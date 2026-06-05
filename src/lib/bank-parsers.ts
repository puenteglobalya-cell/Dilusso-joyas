import * as XLSX from "xlsx";

export interface BankRow {
  banco: string;
  cuenta: string;
  fecha: string; // YYYY-MM-DD
  descripcion: string;
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

/** "1.234,56" or "1234.56" → number */
function parseUY(s: string): number | null {
  if (!s || s.trim() === "") return null;
  // remove thousands dots, replace decimal comma
  const clean = s.trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(clean);
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

export function parseBBVAXls(buffer: ArrayBuffer): BankRow[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const all = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" });

  // Detect account from row 4: "15051382 - CUENTAS CORRIENTES - 0 - $"
  let cuenta = "";
  for (let i = 3; i < 6; i++) {
    const r = all[i] as string[];
    const match = (r[1] ?? "").toString().match(/(\d{6,12})\s*-/);
    if (match) { cuenta = match[1]; break; }
  }

  // Header row has "Fecha" in col 0
  const headerIdx = all.findIndex((r) => String((r as string[])[0]).toLowerCase().trim() === "fecha");
  if (headerIdx < 0) return [];

  const rows: BankRow[] = [];
  let prevSaldo: number | null = null;

  for (let i = headerIdx + 1; i < all.length; i++) {
    const r = all[i] as string[];
    const fechaRaw = String(r[0] ?? "").trim();
    if (!fechaRaw) continue;

    const fecha = isoFromISO(fechaRaw) ?? isoFromDMY(fechaRaw);
    if (!fecha) continue;

    const concepto = String(r[1] ?? "").trim();
    const debitoRaw = String(r[3] ?? "").trim();
    const creditoRaw = String(r[4] ?? "").trim();
    const saldoRaw = String(r[5] ?? "").trim();

    const debito = parseUY(debitoRaw);
    const credito = parseUY(creditoRaw);
    const saldo = parseUY(saldoRaw);

    // Determine sign from balance change if columns are ambiguous
    let finalDebito = debito;
    let finalCredito = credito;
    if (debito === null && credito === null && saldo !== null && prevSaldo !== null) {
      const diff = saldo - prevSaldo;
      if (diff > 0) finalCredito = diff;
      else finalDebito = Math.abs(diff);
    }

    prevSaldo = saldo;
    rows.push({ banco: "BBVA", cuenta, fecha, descripcion: concepto, debito: finalDebito, credito: finalCredito, saldo, moneda: "UYU" });
  }
  return rows;
}

// ── Itaú XLS ─────────────────────────────────────────────────────────────────

export function parseItauXls(buffer: ArrayBuffer): BankRow[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const all = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" });

  // Row 4 (index 4): cuenta 365921
  let cuenta = "";
  const cuentaRow = all[4] as string[];
  if (cuentaRow) cuenta = String(cuentaRow[6] ?? "").trim();

  // Header row: col B="Fecha", col D="Débito", col E="Crédito"
  const headerIdx = all.findIndex((r) => {
    const row = r as string[];
    return String(row[1]).toLowerCase().includes("fecha") && String(row[4]).toLowerCase().includes("bito");
  });
  if (headerIdx < 0) return [];

  const rows: BankRow[] = [];
  for (let i = headerIdx + 1; i < all.length; i++) {
    const r = all[i] as string[];
    const fechaRaw = String(r[1] ?? "").trim();
    if (!fechaRaw) continue;

    const fecha = isoFromDMY(fechaRaw) ?? isoFromISO(fechaRaw);
    if (!fecha) continue;

    const concepto = String(r[2] ?? "").trim();
    if (concepto.toLowerCase().includes("saldo anterior")) continue;

    const debito = parseUY(String(r[4] ?? "").trim());
    const credito = parseUY(String(r[5] ?? "").trim());
    const saldo = parseUY(String(r[6] ?? "").trim());

    rows.push({ banco: "Itaú", cuenta, fecha, descripcion: concepto, debito, credito, saldo, moneda: "UYU" });
  }
  return rows;
}

// ── OCA PDF ──────────────────────────────────────────────────────────────────

export function parseOcaPdf(text: string): BankRow[] {
  const DATE_RE = /(\d{2}\/\d{2}\/\d{4})/g;
  const rows: BankRow[] = [];

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

    const fecha = isoFromDMY(dateStr);
    if (!fecha) continue;

    const rawContent = parts[i + 1] ?? "";
    const content = rawContent.replace(/\s+/g, " ").trim();

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
          descripcion: "Saldo anterior",
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
    rows.push({ banco: "OCA", cuenta, fecha, descripcion: concepto, debito, credito, saldo, moneda: "UYU" });
  }

  return rows;
}

// ── BBVA PDF ─────────────────────────────────────────────────────────────────

export function parseBBVAPdf(text: string): BankRow[] {
  const rows: BankRow[] = [];

  // Split into sections by currency
  const sections: Array<{ moneda: string; text: string }> = [];
  const usdIdx = text.indexOf("DOLARES U.S.A.");
  const puyIdx = text.indexOf("PESOS URUGUAYOS");

  if (usdIdx >= 0 && puyIdx >= 0) {
    const firstIdx = Math.min(usdIdx, puyIdx);
    const secondIdx = Math.max(usdIdx, puyIdx);
    const first = usdIdx < puyIdx ? "USD" : "UYU";
    const second = usdIdx < puyIdx ? "UYU" : "USD";
    // Find next section boundaries (next occurrence of header patterns)
    const nextAfterFirst = text.indexOf(first === "USD" ? "PESOS URUGUAYOS" : "DOLARES U.S.A.", firstIdx + 1);
    sections.push({ moneda: first, text: text.slice(firstIdx, nextAfterFirst > 0 ? nextAfterFirst : undefined) });
    sections.push({ moneda: second, text: text.slice(secondIdx) });
  } else if (usdIdx >= 0) {
    sections.push({ moneda: "USD", text: text.slice(usdIdx) });
  } else if (puyIdx >= 0) {
    sections.push({ moneda: "UYU", text: text.slice(puyIdx) });
  }

  // Extract account number
  const cuentaMatch = text.match(/Cuenta\s*:\s*(\d{6,12})/);
  const cuenta = cuentaMatch ? cuentaMatch[1] : "15051382";

  const DATE_LINE = /^\s*(\d{1,2})\/(\d{2})\/(\d{2,4})\s+(.+?)(?:\s+(\d{1,2}\/\d{2}\/\d{2,4}))?\s+([\d.,]+)\s+([\d.,]+)\s*$/;
  const DATE_LINE_ONE = /^\s*(\d{1,2})\/(\d{2})\/(\d{2,4})\s+(.+?)\s+([\d.,]+)\s*$/;

  for (const section of sections) {
    let prevSaldo: number | null = null;
    const lines = section.text.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Try to match date at start
      const dateMatch = trimmed.match(/^(\d{1,2})\/(\d{2})\/(\d{2,4})\b/);
      if (!dateMatch) continue;

      const y = dateMatch[3].length === 2 ? "20" + dateMatch[3] : dateMatch[3];
      const fecha = `${y}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;

      const rest = trimmed.slice(dateMatch[0].length).trim();

      // Extract trailing numbers
      const numPattern = /(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g;
      const allNums = [...rest.matchAll(numPattern)].map((m) => m[1]);

      if (allNums.length === 0) continue;

      const saldo = parseUY(allNums[allNums.length - 1]);
      const amount = allNums.length >= 2 ? parseUY(allNums[allNums.length - 2]) : null;

      // Concept: everything before first number, removing fecha valor if present
      const firstNumIdx = rest.indexOf(allNums[0]);
      let concepto = rest.slice(0, firstNumIdx).trim();
      // Remove "fecha valor" date if at end of concept
      concepto = concepto.replace(/\s+\d{1,2}\/\d{2}\/\d{2,4}\s*$/, "").trim();

      let debito: number | null = null;
      let credito: number | null = null;

      if (amount !== null && saldo !== null) {
        if (prevSaldo !== null) {
          const diff = saldo - prevSaldo;
          if (diff > 0) credito = amount;
          else debito = amount;
        } else if (allNums.length >= 2) {
          // First transaction: can't determine direction, use columns
          debito = null;
          credito = null;
        }
      }

      prevSaldo = saldo;
      rows.push({ banco: "BBVA", cuenta, fecha, descripcion: concepto, debito, credito, saldo, moneda: section.moneda });
    }
  }

  return rows;
}

// ── Scotiabank PDF ────────────────────────────────────────────────────────────

export function parseScotiabankPdf(text: string): BankRow[] {
  const rows: BankRow[] = [];

  // Find the transactions header line
  const headerIdx = text.indexOf("Fecha");
  const tableText = headerIdx >= 0 ? text.slice(headerIdx) : text;

  // Each line: DD/MM/YY DETAIL MONTO_ORIGEN IMPORTE_$ IMPORTE_U$S
  const lines = tableText.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const dateMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{2,4})\b/);
    if (!dateMatch) continue;

    const y = dateMatch[3].length === 2 ? "20" + dateMatch[3] : dateMatch[3];
    const fecha = `${y}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;

    const rest = trimmed.slice(dateMatch[0].length).trim();

    // Extract all numbers from rest
    const numPattern = /(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})/g;
    const allNums = [...rest.matchAll(numPattern)].map((m) => m[1]);

    if (allNums.length === 0) continue;

    // Last two numbers are Importe$ and ImporteU$S (one may be absent)
    // Second-to-last may be Monto origen
    // For simplicity: use last $ amount as debito (credit card = expense)
    const firstNumIdx = rest.indexOf(allNums[0]);
    const concepto = rest.slice(0, firstNumIdx).trim();

    // The $ amount (second-to-last or last if only one currency)
    const importePesos = allNums.length >= 2 ? parseUY(allNums[allNums.length - 2]) : parseUY(allNums[0]);
    const importeUsd = allNums.length >= 1 ? parseUY(allNums[allNums.length - 1]) : null;

    // Negative = payment/abono, positive = purchase
    const isPayment = concepto.toUpperCase().includes("PAGO") || (importePesos !== null && importePesos < 0);
    const absImportePesos = importePesos !== null ? Math.abs(importePesos) : null;
    const absImporteUsd = importeUsd !== null ? Math.abs(importeUsd) : null;

    // Store in pesos row
    if (absImportePesos && absImportePesos > 0) {
      rows.push({
        banco: "Scotiabank",
        cuenta: "43185955",
        fecha,
        descripcion: concepto,
        debito: isPayment ? null : absImportePesos,
        credito: isPayment ? absImportePesos : null,
        saldo: null,
        moneda: "UYU",
      });
    }

    // Store USD row separately if has USD amount
    if (absImporteUsd && absImporteUsd > 0 && allNums.length >= 2) {
      rows.push({
        banco: "Scotiabank",
        cuenta: "43185955",
        fecha,
        descripcion: concepto,
        debito: isPayment ? null : absImporteUsd,
        credito: isPayment ? absImporteUsd : null,
        saldo: null,
        moneda: "USD",
      });
    }
  }

  return rows;
}
