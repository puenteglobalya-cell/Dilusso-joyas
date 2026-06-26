import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

// Bancos conocidos — palabras clave en el texto del PDF
const BANCO_KEYWORDS: Record<string, string[]> = {
  "BBVA":       ["bbva"],
  "Itaú":       ["itaú", "itau", "itaú"],
  "Scotiabank": ["scotiabank", "scotia"],
  "OCA":        ["oca"],
  "Santander":  ["santander"],
  "BROU":       ["brou", "banco república", "republica"],
  "HSBC":       ["hsbc"],
  "Citibank":   ["citibank", "citi"],
};

// Palabras que indican que es un comprobante bancario, no una factura comercial
const COMPROBANTE_KEYWORDS = [
  "comprobante", "transferencia", "orden de pago", "débito automático",
  "pago realizado", "operación", "nro. de operación", "número de operación",
  "transacción", "acreditación", "extracto",
];

interface Extracted {
  proveedor: string | null;
  fecha: string | null;
  importe: number | null;
  moneda: "UYU" | "USD";
  esComprobante: boolean;
  bancoDet: string | null;   // banco detectado en el PDF
  concepto: string | null;   // concepto/descripción de la transferencia
}

function extractData(text: string): Extracted {
  const lower = text.toLowerCase();
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // ¿Es comprobante bancario?
  const esComprobante = COMPROBANTE_KEYWORDS.some(kw => lower.includes(kw));

  // Banco en el documento
  let bancoDet: string | null = null;
  for (const [banco, kws] of Object.entries(BANCO_KEYWORDS)) {
    if (kws.some(kw => lower.includes(kw))) { bancoDet = banco; break; }
  }

  // Concepto/descripción (comprobante)
  let concepto: string | null = null;
  if (esComprobante) {
    const concLines = lines.filter(l =>
      /concepto|descripci[oó]n|motivo|referencia/i.test(l)
    );
    if (concLines.length > 0) {
      // Tomar la línea siguiente al label
      const idx = lines.indexOf(concLines[0]);
      concepto = lines[idx + 1] ?? (concLines[0].replace(/^[^:]+:\s*/i, "").trim() || null);
    }
    // Fallback: buscar línea con palabras de descripción inline
    if (!concepto) {
      const m = text.match(/(?:concepto|descripci[oó]n|motivo)[:\s]+([^\n]{3,60})/i);
      if (m) concepto = m[1].trim();
    }
  }

  // Importe
  const importePatterns = [
    /(?:total|importe|monto|a pagar|subtotal|importe transferido|monto transferido)\D{0,15}[\$U]?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/gi,
    /(?:^|\s)(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)(?:\s|$)/gm,
    /(?:^|\s)(\d{1,3}(?:,\d{3})+(?:\.\d{2})?)(?:\s|$)/gm,
  ];
  let importe: number | null = null;
  for (const pattern of importePatterns) {
    const ms = [...text.matchAll(pattern)];
    const vals = ms.map(m => parseFloat(m[1].replace(/\./g, "").replace(",", "."))).filter(v => !isNaN(v) && v > 10);
    if (vals.length > 0) { importe = Math.max(...vals); break; }
  }

  // Fecha
  let fecha: string | null = null;
  const dm = text.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (dm) fecha = `${dm[3]}-${dm[2].padStart(2,"0")}-${dm[1].padStart(2,"0")}`;
  else {
    const ym = text.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
    if (ym) fecha = `${ym[1]}-${ym[2].padStart(2,"0")}-${ym[3].padStart(2,"0")}`;
  }

  const moneda: "UYU" | "USD" = /USD|U\.S\.|dolar|dólar/i.test(text) ? "USD" : "UYU";

  // Proveedor (para facturas) o nombre del banco emisor (para comprobantes)
  const proveedor = esComprobante
    ? (bancoDet ? `Comprobante ${bancoDet}` : "Comprobante bancario")
    : (lines.find(l => l.length > 3 && !/^\d/.test(l) && !/^(fecha|date|factura|invoice|rut|nro|no\.|total|importe)/i.test(l)) ?? null);

  return { proveedor, fecha, importe, moneda, esComprobante, bancoDet, concepto };
}

async function findMatch(
  sb: ReturnType<typeof createServerClient>,
  extracted: Extracted,
) {
  const { importe, moneda, fecha, esComprobante, bancoDet, concepto } = extracted;
  if (!importe) return [];

  const min = importe * 0.95;
  const max = importe * 1.05;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (sb.from("bank_statements") as any)
    .select("id, banco, fecha, descripcion, debito, moneda, tipo, categoria_negocio, categoria_personal")
    .eq("moneda", moneda)
    .gte("debito", min)
    .lte("debito", max)
    .order("fecha", { ascending: false })
    .limit(10);

  // Para comprobante bancario: filtrar por banco si lo detectamos
  if (esComprobante && bancoDet) {
    query = query.eq("banco", bancoDet);
  }

  if (fecha) {
    const d = new Date(fecha);
    const from = new Date(d); from.setDate(d.getDate() - 5);
    // Comprobante: mismo día ±3; factura: hasta 30 días después
    const to = new Date(d); to.setDate(d.getDate() + (esComprobante ? 3 : 30));
    query = query.gte("fecha", from.toISOString().split("T")[0]).lte("fecha", to.toISOString().split("T")[0]);
  }

  const { data } = await query;
  let results: typeof data = data ?? [];

  // Si hay concepto, ordenar por similitud de descripción (simple: coincidencia de palabras)
  if (concepto && results.length > 1) {
    const words = concepto.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    results = results
      .map((r: { descripcion: string | null }) => ({
        ...r,
        _score: words.filter(w => (r.descripcion ?? "").toLowerCase().includes(w)).length,
      }))
      .sort((a: { _score: number }, b: { _score: number }) => b._score - a._score);
  }

  return results;
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
      const extracted = extractData(pdfData.text);

      const now = new Date();
      const año = extracted.fecha ? parseInt(extracted.fecha.split("-")[0]) : now.getFullYear();
      const mes = extracted.fecha ? parseInt(extracted.fecha.split("-")[1]) : now.getMonth() + 1;

      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${tipo}/${año}/${String(mes).padStart(2,"0")}/${Date.now()}_${safeName}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: uploadError } = await (sb.storage as any).from("facturas").upload(path, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (uploadError) throw new Error(`Storage: ${uploadError.message}`);

      const matches = await findMatch(sb, extracted);
      const autoMatch = matches.length === 1 ? matches[0].id : null;

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
        notas: extracted.esComprobante && extracted.concepto ? `Concepto: ${extracted.concepto}` : null,
      }).select().single();

      if (insertError) throw new Error(`DB: ${insertError.message}`);

      results.push({
        ok: true,
        filename: file.name,
        row,
        matches,
        autoMatched: !!autoMatch,
        esComprobante: extracted.esComprobante,
        bancoDet: extracted.bancoDet,
        concepto: extracted.concepto,
      });
    } catch (e) {
      results.push({ ok: false, filename: file.name, error: String(e) });
    }
  }

  return NextResponse.json({ results });
}
