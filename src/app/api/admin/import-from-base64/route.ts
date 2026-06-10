/**
 * POST /api/admin/import-from-base64
 *
 * Accepts a base64-encoded file (PDF or XLS) and a bank type, then runs
 * the same import pipeline as /api/admin/import-bank.
 *
 * Body: { base64: string, filename: string, banco: string }
 * banco values: "bbva-xls" | "itau-xls" | "oca-pdf" | "bbva-pdf" | "scotiabank-pdf" | "itau-card-pdf"
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { parseBBVAXls, parseItauXls, parseOcaPdf, parseBBVAPdf, parseScotiabankPdf, parseItauCardPdf, detectXlsBanco, BankRow } from "@/lib/bank-parsers";
import { clasificar } from "@/lib/clasificador";
import { getTc } from "@/lib/tipo-cambio";
import { normalizeDesc } from "@/lib/normalize";

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json() as { base64?: string; filename?: string; banco?: string };

  if (!body.base64) return NextResponse.json({ error: "No base64" }, { status: 400 });
  if (!body.banco)  return NextResponse.json({ error: "No banco" }, { status: 400 });

  // Validate base64 size before decoding
  const estimatedBytes = Math.floor(body.base64.length * 0.75);
  if (estimatedBytes > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `Archivo demasiado grande (${(estimatedBytes / 1024 / 1024).toFixed(1)} MB). Máximo permitido: 20 MB.` },
      { status: 413 }
    );
  }

  const rawBuffer = Buffer.from(body.base64, "base64");

  // Validate magic bytes for PDFs and XLS files
  const isPdfMagic = rawBuffer.slice(0, 4).toString("hex") === "25504446"; // %PDF
  const isXlsMagic = rawBuffer.slice(0, 8).toString("hex") === "d0cf11e0a1b11ae1"; // OLE2 (xls)
  const isXlsxMagic = rawBuffer.slice(0, 4).toString("hex") === "504b0304"; // ZIP (xlsx)
  const needsPdf = ["oca-pdf", "bbva-pdf", "scotiabank-pdf", "itau-card-pdf"].includes(body.banco);
  const needsXls = ["bbva-xls", "itau-xls"].includes(body.banco);
  if (needsPdf && !isPdfMagic) {
    return NextResponse.json({ error: "El archivo no es un PDF válido." }, { status: 400 });
  }
  if (needsXls && !isXlsMagic && !isXlsxMagic) {
    return NextResponse.json({ error: "El archivo no es un Excel válido (.xls/.xlsx)." }, { status: 400 });
  }

  const buffer = rawBuffer.buffer as ArrayBuffer;
  const banco = body.banco;
  let rows: BankRow[] = [];

  // Validate XLS files match selected bank
  if (banco === "bbva-xls" || banco === "itau-xls") {
    const detected = detectXlsBanco(buffer);
    const expected = banco === "bbva-xls" ? "BBVA" : "Itaú";
    if (detected !== "desconocido" && detected !== expected) {
      return NextResponse.json(
        { error: `Archivo incorrecto: detectado como ${detected} pero seleccionaste ${expected}.` },
        { status: 400 }
      );
    }
  }

  try {
    switch (banco) {
      case "bbva-xls":  rows = parseBBVAXls(buffer); break;
      case "itau-xls":  rows = parseItauXls(buffer); break;
      case "oca-pdf": {
        const pdf = require("pdf-parse/lib/pdf-parse");
        const data = await pdf(Buffer.from(buffer));
        rows = parseOcaPdf(data.text);
        break;
      }
      case "bbva-pdf": {
        const pdf = require("pdf-parse/lib/pdf-parse");
        const data = await pdf(Buffer.from(buffer));
        rows = parseBBVAPdf(data.text);
        break;
      }
      case "scotiabank-pdf": {
        const pdf = require("pdf-parse/lib/pdf-parse");
        const data = await pdf(Buffer.from(buffer));
        rows = parseScotiabankPdf(data.text);
        break;
      }
      case "itau-card-pdf": {
        const pdf = require("pdf-parse/lib/pdf-parse");
        const data = await pdf(Buffer.from(buffer));
        rows = parseItauCardPdf(data.text);
        break;
      }
      default:
        return NextResponse.json({ error: `Banco desconocido: ${banco}` }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: `Error al parsear: ${e instanceof Error ? e.message : e}` }, { status: 500 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, warning: "No se encontraron movimientos en el archivo" });
  }

  // Validate account number matches known accounts
  const CUENTAS_CONOCIDAS: Record<string, string[]> = {
    "BBVA":       ["15051382"],
    "Itaú":       ["365913", "365921"],
    "Itau-Card":  ["tarjeta"],
    "OCA":        ["4154265"],
    "Scotiabank": ["43185955"],
  };
  const cuentaArchivo = rows.find(r => r.cuenta && r.cuenta !== "")?.cuenta ?? null;
  if (cuentaArchivo) {
    const cuentasValidas = CUENTAS_CONOCIDAS[rows[0].banco] ?? [];
    if (cuentasValidas.length > 0 && !cuentasValidas.includes(cuentaArchivo)) {
      return NextResponse.json({
        error: `Cuenta incorrecta: el archivo tiene cuenta "${cuentaArchivo}" pero para ${rows[0].banco} se esperan: ${cuentasValidas.join(", ")}. ¿Subiste el extracto equivocado?`,
      }, { status: 400 });
    }
  }

  const sb = createServerClient();

  type ExRow = { fecha: string; descripcion: string | null; debito: number | null; credito: number | null; saldo: number | null; moneda: string; cuenta: string | null };
  function dedupKey(r: ExRow | typeof rows[0]) {
    return `${r.fecha}|${r.moneda}|${"cuenta" in r ? r.cuenta ?? "" : ""}|${normalizeDesc(r.descripcion)}|${r.debito ?? ""}|${r.credito ?? ""}`;
  }

  // Paginate to avoid Supabase 1000-row limit when loading existing rows for dedup
  const PAGE = 1000;
  let existing: ExRow[] = [];
  let from = 0;
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from("bank_statements") as any)
      .select("fecha, descripcion, debito, credito, saldo, moneda, cuenta")
      .eq("banco", rows[0].banco)
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    existing = existing.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const existingKeys = new Set(existing.map(dedupKey));
  const newRows = rows.filter(r => !existingKeys.has(dedupKey(r)));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: customRules } = await (sb.from("clasificacion_reglas") as any)
    .select("keyword, tipo, cat_negocio, cat_personal");

  const enriched = newRows.map(r => {
    const isSaldoAnterior = r.descripcion === "Saldo anterior";
    const clasi = isSaldoAnterior
      ? { clasificado: "No" as const, tipo: "", categoria_negocio: "", categoria_personal: "" }
      : clasificar(r.descripcion ?? "", customRules ?? []);
    const tc = r.moneda === "USD" ? getTc(r.fecha) : null;
    const importe_uyu = r.moneda === "USD" && tc ? ((r.credito ?? 0) - (r.debito ?? 0)) * tc : null;
    return { ...r, clasificado: clasi.clasificado, tipo: clasi.tipo, categoria_negocio: clasi.categoria_negocio, categoria_personal: clasi.categoria_personal, tc, importe_uyu };
  });

  let inserted = 0;
  let insertError: string | null = null;
  const CHUNK = 500;
  for (let i = 0; i < enriched.length; i += CHUNK) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb.from("bank_statements") as any).insert(enriched.slice(i, i + CHUNK));
    if (!error) inserted += Math.min(CHUNK, enriched.length - i);
    else insertError = error.message;
  }

  return NextResponse.json({ ok: true, inserted, parsed: rows.length, skipped: rows.length - newRows.length, banco, filename: body.filename ?? "", ...(insertError ? { insertError } : {}) });
}
