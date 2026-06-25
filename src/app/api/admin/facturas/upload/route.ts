import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

function extractInvoiceData(text: string) {
  const fullText = text;

  // Importe — busca el mayor valor numérico con formato
  const importePatterns = [
    /(?:total|importe|a pagar|monto|subtotal)\D{0,15}[\$U]?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/gi,
    /(?:^|\s)(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)(?:\s|$)/gm,
    /(?:^|\s)(\d{1,3}(?:,\d{3})+(?:\.\d{2})?)(?:\s|$)/gm,
  ];
  let importe: number | null = null;
  for (const pattern of importePatterns) {
    const matches = [...fullText.matchAll(pattern)];
    if (matches.length > 0) {
      const values = matches
        .map(m => parseFloat(m[1].replace(/\./g, "").replace(",", ".")))
        .filter(v => !isNaN(v) && v > 10);
      if (values.length > 0) { importe = Math.max(...values); break; }
    }
  }

  // Fecha
  let fecha: string | null = null;
  const dm = fullText.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (dm) fecha = `${dm[3]}-${dm[2].padStart(2,"0")}-${dm[1].padStart(2,"0")}`;
  else {
    const ym = fullText.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
    if (ym) fecha = `${ym[1]}-${ym[2].padStart(2,"0")}-${ym[3].padStart(2,"0")}`;
  }

  const moneda: "UYU" | "USD" = /USD|U\.S\.|dolar|dólar/i.test(fullText) ? "USD" : "UYU";

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const proveedor = lines.find(l =>
    l.length > 3 && !/^\d/.test(l) && !/^(fecha|date|factura|invoice|rut|nro|no\.|total|importe)/i.test(l)
  ) ?? null;

  return { proveedor, fecha, importe, moneda };
}

async function findMatch(sb: ReturnType<typeof createServerClient>, importe: number, moneda: string, fecha: string | null) {
  const min = importe * 0.95;
  const max = importe * 1.05;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (sb.from("bank_statements") as any)
    .select("id, banco, fecha, descripcion, debito, moneda, tipo, categoria_negocio, categoria_personal")
    .eq("moneda", moneda)
    .gte("debito", min)
    .lte("debito", max)
    .order("fecha", { ascending: false })
    .limit(5);

  if (fecha) {
    const d = new Date(fecha);
    const from = new Date(d); from.setDate(d.getDate() - 5);
    const to = new Date(d);   to.setDate(d.getDate() + 30);
    query = query.gte("fecha", from.toISOString().split("T")[0]).lte("fecha", to.toISOString().split("T")[0]);
  }

  const { data } = await query;
  return data ?? [];
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];
  const tipo = formData.get("tipo") as string;

  if (!files.length) return NextResponse.json({ error: "Sin archivos" }, { status: 400 });
  if (!["negocio", "personal"].includes(tipo)) return NextResponse.json({ error: "tipo inválido" }, { status: 400 });

  const sb = createServerClient();
  const results = [];

  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const pdf = require("pdf-parse/lib/pdf-parse");
      const pdfData = await pdf(buffer);
      const extracted = extractInvoiceData(pdfData.text);

      const now = new Date();
      const año = extracted.fecha ? parseInt(extracted.fecha.split("-")[0]) : now.getFullYear();
      const mes = extracted.fecha ? parseInt(extracted.fecha.split("-")[1]) : now.getMonth() + 1;

      // Upload to Supabase Storage
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${tipo}/${año}/${String(mes).padStart(2,"0")}/${Date.now()}_${safeName}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: uploadError } = await (sb.storage as any).from("facturas").upload(path, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (uploadError) throw new Error(`Storage: ${uploadError.message}`);

      // Auto-match
      const matches = extracted.importe
        ? await findMatch(sb, extracted.importe, extracted.moneda, extracted.fecha)
        : [];
      const autoMatch = matches.length === 1 ? matches[0].id : null;

      // Insert metadata
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: row, error: insertError } = await (sb.from("facturas") as any).insert({
        filename: file.name,
        storage_path: path,
        tipo,
        año,
        mes,
        proveedor: extracted.proveedor,
        fecha_factura: extracted.fecha,
        importe: extracted.importe,
        moneda: extracted.moneda,
        bank_statement_id: autoMatch,
      }).select().single();

      if (insertError) throw new Error(`DB: ${insertError.message}`);

      results.push({ ok: true, filename: file.name, row, matches, autoMatched: !!autoMatch });
    } catch (e) {
      results.push({ ok: false, filename: file.name, error: String(e) });
    }
  }

  return NextResponse.json({ results });
}
