import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { parseBBVAXls, parseItauXls, parseOcaPdf, parseBBVAPdf, parseScotiabankPdf, BankRow } from "@/lib/bank-parsers";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const banco = formData.get("banco") as string | null;

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!banco) return NextResponse.json({ error: "No banco" }, { status: 400 });

  const buffer = await file.arrayBuffer();
  let rows: BankRow[] = [];

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

  // Fetch existing rows for this banco to deduplicate
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (sb.from("bank_statements") as any)
    .select("fecha, descripcion, debito, credito, saldo")
    .eq("banco", rows[0].banco);

  const existingKeys = new Set(
    ((existing ?? []) as { fecha: string; descripcion: string | null; debito: number | null; credito: number | null; saldo: number | null }[])
      .map((r) => `${r.fecha}|${r.descripcion ?? ""}|${r.debito ?? ""}|${r.credito ?? ""}|${r.saldo ?? ""}`)
  );

  const newRows = rows.filter(
    (r) => !existingKeys.has(`${r.fecha}|${r.descripcion ?? ""}|${r.debito ?? ""}|${r.credito ?? ""}|${r.saldo ?? ""}`)
  );

  let inserted = 0;
  const CHUNK = 500;
  for (let i = 0; i < newRows.length; i += CHUNK) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb.from("bank_statements") as any).insert(newRows.slice(i, i + CHUNK));
    if (!error) inserted += Math.min(CHUNK, newRows.length - i);
    else console.error("insert error:", error);
  }

  return NextResponse.json({ ok: true, inserted, parsed: rows.length, skipped: rows.length - newRows.length });
}
