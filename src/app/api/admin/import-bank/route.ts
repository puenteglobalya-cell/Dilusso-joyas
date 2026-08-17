import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { parseBBVAXls, parseItauXls, parseOcaPdf, parseBBVAPdf, parseScotiabankPdf, parseItauCardPdf, detectXlsBanco, BankRow } from "@/lib/bank-parsers";
import { clasificar } from "@/lib/clasificador";
import { getTc, fetchTcMap } from "@/lib/tipo-cambio";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const banco = formData.get("banco") as string | null;

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!banco) return NextResponse.json({ error: "No banco" }, { status: 400 });

  const buffer = await file.arrayBuffer();
  let rows: BankRow[] = [];

  // Validate XLS files match selected bank
  if (banco === "bbva-xls" || banco === "itau-xls") {
    const detected = detectXlsBanco(buffer);
    const expected = banco === "bbva-xls" ? "BBVA" : "Itaú";
    if (detected !== "desconocido" && detected !== expected) {
      return NextResponse.json(
        { error: `Archivo incorrecto: detectado como ${detected} pero seleccionaste ${expected}. Por favor seleccioná el banco correcto.` },
        { status: 400 }
      );
    }
  }

  try {
    switch (banco) {
      case "bbva-xls":
        rows = parseBBVAXls(buffer);
        break;
      case "itau-xls":
        rows = parseItauXls(buffer);
        break;
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

  const sb = createServerClient();

  // Deduplication — key includes moneda y cuenta para separar correctamente
  // bloques USD/UYU de BBVA e Itaú
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (sb.from("bank_statements") as any)
    .select("fecha, descripcion, debito, credito, saldo, moneda, cuenta")
    .eq("banco", rows[0].banco);

  type ExRow = { fecha: string; descripcion: string | null; debito: number | null; credito: number | null; saldo: number | null; moneda: string; cuenta: string | null };
  function dedupKey(r: ExRow | typeof rows[0]) {
    // Incluye saldo: dos movimientos con igual fecha/descripción/importe pero
    // saldo resultante distinto son transacciones reales distintas (ej. dos
    // cheques idénticos el mismo día), no duplicados.
    return `${r.fecha}|${r.moneda}|${"cuenta" in r ? r.cuenta ?? "" : ""}|${r.descripcion ?? ""}|${r.debito ?? ""}|${r.credito ?? ""}|${r.saldo ?? ""}`;
  }

  const existingKeys = new Set(((existing ?? []) as ExRow[]).map(dedupKey));
  const newRows = rows.filter((r) => !existingKeys.has(dedupKey(r)));

  // Fetch custom rules from DB and merge into classifier
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: customRules } = await (sb.from("clasificacion_reglas") as any)
    .select("keyword, tipo, cat_negocio, cat_personal");

  // Apply auto-classification and TC conversion
  const tcMap = await fetchTcMap(sb);
  const enriched = newRows.map((r) => {
    const isSaldoAnterior = r.descripcion === "Saldo anterior";
    const clasi = isSaldoAnterior
      ? { clasificado: "No" as const, tipo: "", categoria_negocio: "", categoria_personal: "" }
      : clasificar(r.descripcion ?? "", customRules ?? []);
    const tc = r.moneda === "USD" ? getTc(r.fecha, tcMap) : null;
    const importe_uyu = r.moneda === "USD" && tc
      ? ((r.credito ?? 0) - (r.debito ?? 0)) * tc
      : null;

    return {
      ...r,
      clasificado: clasi.clasificado,
      tipo: clasi.tipo,
      categoria_negocio: clasi.categoria_negocio,
      categoria_personal: clasi.categoria_personal,
      tc,
      importe_uyu,
    };
  });

  let inserted = 0;
  const CHUNK = 500;
  for (let i = 0; i < enriched.length; i += CHUNK) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb.from("bank_statements") as any).insert(enriched.slice(i, i + CHUNK));
    if (!error) inserted += Math.min(CHUNK, enriched.length - i);
    else console.error("insert error:", error);
  }

  return NextResponse.json({ ok: true, inserted, parsed: rows.length, skipped: rows.length - newRows.length });
}
