import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

const BANCO_MAP: Record<string, string> = {
  "bbva":               "BBVA",
  "itau":               "Itaú",
  "tarjeta itau":       "Itau-Card",
  "tarjeta scotiabank": "Scotiabank",
  "tarjeta scotia":     "Scotiabank",
  "tarjeta oca":        "OCA",
  "scotiabank":         "Scotiabank",
  "oca":                "OCA",
};

function parseImporte(val: unknown): number | null {
  if (val == null) return null;
  const s = String(val).replace(/,/g, "").trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : Math.abs(n);
}

function excelDateToISO(serial: number): string {
  // Excel date serial to JS date
  const utc = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(utc).toISOString().slice(0, 10);
}

function parseDate(val: unknown): string | null {
  if (val == null) return null;
  if (typeof val === "number") return excelDateToISO(val);
  const s = String(val).trim();
  // Try M/D/YY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3]);
    return `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return null;
}

export interface ReconcilRow {
  id: string;
  fecha: string;
  banco: string;
  descripcion: string | null;
  debito: number | null;
  credito: number | null;
  tipo_propuesto: string;
  cat_negocio: string;
  cat_personal: string;
  match_type: "exact" | "amount_date";
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { raw: true }) as Record<string, unknown>[];

  // Parse classified rows from Excel
  interface ExcelRow {
    banco: string;
    fecha: string;
    importe: number;
    esDebito: boolean;
    tipo: string;
    catNegocio: string;
    catPersonal: string;
  }

  const excelRows: ExcelRow[] = [];
  for (const r of raw) {
    const clasificado = String(r["Clasificado"] ?? "").trim();
    if (clasificado !== "Si") continue;
    const bancoRaw = String(r["Banco"] ?? "").toLowerCase().trim();
    const banco = BANCO_MAP[bancoRaw];
    if (!banco) continue; // skip efectivo, costo mercadería, etc.

    const fecha = parseDate(r["Fecha"]);
    if (!fecha) continue;

    const importe = parseImporte(r["Importe origen"] ?? r["Val Abs"] ?? r["Importe en UYU"]);
    if (!importe || importe === 0) continue;

    const mov = String(r["Movimiento"] ?? "").toLowerCase().trim();
    const esDebito = mov === "salida";

    const tipo = String(r["Tipo"] ?? "").toLowerCase().trim() === "personal" ? "personal" : "negocio";
    const catNegocio  = tipo === "negocio"  ? String(r["Categoria"] ?? "").trim() : "";
    const catPersonal = tipo === "personal" ? String(r["Categoria personal"] ?? r["Categoria"] ?? "").trim() : "";

    excelRows.push({ banco, fecha, importe, esDebito, tipo, catNegocio, catPersonal });
  }

  if (excelRows.length === 0) {
    return NextResponse.json({ error: "No se encontraron filas clasificadas en el Excel" }, { status: 400 });
  }

  // Group by banco+fecha for efficient DB lookup
  const fechasByBanco = new Map<string, Set<string>>();
  for (const r of excelRows) {
    if (!fechasByBanco.has(r.banco)) fechasByBanco.set(r.banco, new Set());
    fechasByBanco.get(r.banco)!.add(r.fecha);
  }

  const sb = createServerClient();
  // Load unclassified rows for those dates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type DBRow = { id: string; banco: string; fecha: string; descripcion: string | null; debito: number | null; credito: number | null; moneda: string };
  const dbRows: DBRow[] = [];

  for (const [banco, fechas] of fechasByBanco.entries()) {
    const arr = Array.from(fechas);
    for (let i = 0; i < arr.length; i += 50) {
      const chunk = arr.slice(i, i + 50);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (sb.from("bank_statements") as any)
        .select("id,banco,fecha,descripcion,debito,credito,moneda")
        .eq("banco", banco)
        .eq("clasificado", "No")
        .in("fecha", chunk);
      if (data) dbRows.push(...(data as DBRow[]));
    }
  }

  // Match Excel rows to DB rows
  const TOLERANCE = 0.05; // 5 cents tolerance for rounding
  const matched: ReconcilRow[] = [];
  const usedIds = new Set<string>();

  for (const ex of excelRows) {
    const candidates = dbRows.filter(db =>
      db.banco === ex.banco &&
      db.fecha === ex.fecha &&
      !usedIds.has(db.id)
    );

    // First try exact match on amount
    let found = candidates.find(db => {
      const dbAmt = ex.esDebito ? (db.debito ?? 0) : (db.credito ?? 0);
      return Math.abs(dbAmt - ex.importe) <= TOLERANCE;
    });

    if (!found) continue;

    usedIds.add(found.id);
    matched.push({
      id: found.id,
      fecha: found.fecha,
      banco: found.banco,
      descripcion: found.descripcion,
      debito: found.debito,
      credito: found.credito,
      tipo_propuesto: ex.tipo,
      cat_negocio: ex.catNegocio,
      cat_personal: ex.catPersonal,
      match_type: "exact",
    });
  }

  return NextResponse.json({
    total_excel: excelRows.length,
    total_matches: matched.length,
    matches: matched,
  });
}
