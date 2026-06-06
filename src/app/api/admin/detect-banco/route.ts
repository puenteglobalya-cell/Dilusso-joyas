/**
 * POST /api/admin/detect-banco
 *
 * Receives a base64-encoded file and returns the detected bank type.
 * Body: { base64: string, filename: string }
 * Response: { banco: string | null, label: string | null }
 */
import { NextRequest, NextResponse } from "next/server";
import { detectXlsBanco } from "@/lib/bank-parsers";

export const runtime = "nodejs";

const BANCO_LABELS: Record<string, string> = {
  "bbva-xls":       "BBVA XLS",
  "bbva-pdf":       "BBVA PDF",
  "itau-xls":       "Itaú XLS",
  "oca-pdf":        "OCA PDF",
  "scotiabank-pdf": "Scotiabank PDF",
  "itau-card-pdf":  "Itaú Tarjeta PDF",
};

function detectFromPdfText(text: string): string | null {
  // Normalize: remove accents and uppercase for robust matching
  const upper = text
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // strip diacritics: Ú→U, Á→A, etc.

  if (upper.includes("SCOTIABANK")) {
    return "scotiabank-pdf";
  }
  if (upper.includes("OCA S.A") || upper.includes("OCA BLUE") || upper.includes("OCA VISA") ||
      (upper.includes("OCA") && (upper.includes("ESTADO DE CUENTA") || upper.includes("LIQUIDACION") || upper.includes("TARJETA OCA")))) {
    return "oca-pdf";
  }
  // Itaú card: "BANCO ITAU" + card keywords, or "LIQUIDACION VISA" alone
  const isItau = upper.includes("BANCO ITAU") || upper.includes("ITAU");
  const isCard = upper.includes("VISA") || upper.includes("TARJETA") || upper.includes("LIQUIDACION") || upper.includes("ESTADO DE CUENTA TARJETA");
  if (isItau && isCard) {
    return "itau-card-pdf";
  }
  if (upper.includes("BBVA") && (upper.includes("PESOS URUGUAYOS") || upper.includes("DOLARES U.S.A") ||
      upper.includes("CUENTAS CORRIENTES") || upper.includes("CAJA DE AHORROS") || upper.includes("CUENTA CORRIENTE"))) {
    return "bbva-pdf";
  }
  if (upper.includes("BANCO ITAU") || upper.includes("ITAU")) {
    return "itau-card-pdf";
  }
  return null;
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { base64?: string; filename?: string };
  if (!body.base64 || !body.filename) {
    return NextResponse.json({ error: "Missing base64 or filename" }, { status: 400 });
  }

  const filename = body.filename.toLowerCase();
  const ext = filename.split(".").pop() ?? "";
  const buf = Buffer.from(body.base64, "base64");

  let banco: string | null = null;

  if (ext === "xls" || ext === "xlsx") {
    const detected = detectXlsBanco(buf.buffer as ArrayBuffer);
    if (detected === "BBVA") banco = "bbva-xls";
    else if (detected === "Itaú") banco = "itau-xls";
  } else if (ext === "pdf") {
    // First try: use pdf-parse to extract real text (handles all PDF encodings)
    try {
      const pdf = require("pdf-parse/lib/pdf-parse");
      const data = await pdf(buf);
      banco = detectFromPdfText(data.text as string);
    } catch {
      // Fallback: scan raw bytes as latin-1
      let raw = "";
      for (let i = 0; i < buf.length; i++) raw += String.fromCharCode(buf[i]);
      banco = detectFromPdfText(raw);
    }

    // Last resort: detect by filename patterns
    if (!banco) {
      if (filename.includes("43185955") || filename.includes("scotia")) banco = "scotiabank-pdf";
      else if (filename.includes("bbva") || filename.includes("15051382")) banco = "bbva-pdf";
      else if (filename.includes("oca")) banco = "oca-pdf";
      else if (filename.includes("365921") || filename.includes("365913") || filename.includes("itau")) banco = "itau-card-pdf";
    }
  }

  return NextResponse.json({
    banco,
    label: banco ? BANCO_LABELS[banco] ?? banco : null,
  });
}
