/**
 * POST /api/admin/match-factura
 * Accepts a PDF invoice, extracts text, finds amount + date + vendor,
 * then searches bank_statements for matching transactions (±3 days, ±1% amount).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

interface ExtractedInvoice {
  proveedor: string | null;
  fecha: string | null;       // YYYY-MM-DD
  importe: number | null;
  moneda: "UYU" | "USD";
  rawText: string;
}

function extractInvoiceData(text: string): ExtractedInvoice {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const fullText = text;

  // --- IMPORTE ---
  // Busca patrones como: $ 1.234,56 / $1234.56 / 1.234,56 / Total: 1234
  const importePatterns = [
    // Total / importe final
    /(?:total|importe|a pagar|monto|subtotal)\D{0,10}[\$U]?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/gi,
    // Número grande standalone con separadores
    /(?:^|\s)(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)(?:\s|$)/gm,
    // Formato anglosajón
    /(?:^|\s)(\d{1,3}(?:,\d{3})+(?:\.\d{2})?)(?:\s|$)/gm,
  ];

  let importe: number | null = null;
  for (const pattern of importePatterns) {
    const matches = [...fullText.matchAll(pattern)];
    if (matches.length > 0) {
      // Tomar el mayor valor encontrado (suele ser el total)
      const values = matches
        .map(m => {
          const raw = m[1].replace(/\./g, "").replace(",", ".");
          return parseFloat(raw);
        })
        .filter(v => !isNaN(v) && v > 0);
      if (values.length > 0) {
        importe = Math.max(...values);
        break;
      }
    }
  }

  // --- FECHA ---
  // Busca DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
  const fechaPatterns = [
    /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/,
    /(\d{4})[\/\-](\d{2})[\/\-](\d{2})/,
  ];
  let fecha: string | null = null;
  for (const pattern of fechaPatterns) {
    const m = fullText.match(pattern);
    if (m) {
      if (m[3] && m[3].length === 4) {
        // DD/MM/YYYY
        fecha = `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
      } else {
        // YYYY-MM-DD
        fecha = `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;
      }
      break;
    }
  }

  // --- MONEDA ---
  const moneda: "UYU" | "USD" = /USD|U\.S\.|dolar|dólar/i.test(fullText) ? "USD" : "UYU";

  // --- PROVEEDOR ---
  // Tomar la primera línea no vacía que no sea solo números/fechas
  const proveedor = lines.find(l =>
    l.length > 3 &&
    !/^\d/.test(l) &&
    !/^(fecha|date|factura|invoice|rut|nro|no\.)/i.test(l)
  ) ?? null;

  return { proveedor, fecha, importe, moneda, rawText: text.substring(0, 2000) };
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const buffer = await file.arrayBuffer();
  const pdf = require("pdf-parse/lib/pdf-parse");
  const data = await pdf(Buffer.from(buffer));
  const extracted = extractInvoiceData(data.text);

  if (!extracted.importe) {
    return NextResponse.json({ extracted, matches: [], error: "No se pudo extraer importe del PDF" });
  }

  // Search bank_statements: same moneda, amount ±5%, date ±10 days (or same month if no date)
  const sb = createServerClient();
  const min = extracted.importe * 0.95;
  const max = extracted.importe * 1.05;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (sb.from("bank_statements") as any)
    .select("id, banco, fecha, descripcion, debito, credito, importe_uyu, moneda, tipo, categoria_negocio, categoria_personal, clasificado")
    .eq("moneda", extracted.moneda)
    .gte("debito", min)
    .lte("debito", max)
    .order("fecha", { ascending: false })
    .limit(20);

  // Narrow by date range if we have a date
  if (extracted.fecha) {
    const d = new Date(extracted.fecha);
    const from = new Date(d); from.setDate(d.getDate() - 10);
    const to = new Date(d);   to.setDate(d.getDate() + 10);
    query = query.gte("fecha", from.toISOString().split("T")[0])
                 .lte("fecha", to.toISOString().split("T")[0]);
  }

  const { data: matches, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ extracted, matches: matches ?? [] });
}
