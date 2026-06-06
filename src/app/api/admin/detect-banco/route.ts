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

export async function POST(req: NextRequest) {
  const body = await req.json() as { base64?: string; filename?: string };
  if (!body.base64 || !body.filename) {
    return NextResponse.json({ error: "Missing base64 or filename" }, { status: 400 });
  }

  const filename = body.filename.toLowerCase();
  const ext = filename.split(".").pop() ?? "";
  const buffer = Buffer.from(body.base64, "base64").buffer as ArrayBuffer;

  let banco: string | null = null;

  if (ext === "xls" || ext === "xlsx") {
    const detected = detectXlsBanco(buffer);
    if (detected === "BBVA") banco = "bbva-xls";
    else if (detected === "Itaú") banco = "itau-xls";
  } else if (ext === "pdf") {
    // Read PDF as latin-1 text and look for bank markers
    const bytes = new Uint8Array(buffer);
    let text = "";
    for (let i = 0; i < bytes.length; i++) {
      text += String.fromCharCode(bytes[i]);
    }
    const upper = text.toUpperCase();

    if (upper.includes("SCOTIABANK URUGUAY")) {
      banco = "scotiabank-pdf";
    } else if (upper.includes("OCA S.A") || upper.includes("OCA BLUE") || (upper.includes("OCA") && upper.includes("ESTADO DE CUENTA"))) {
      banco = "oca-pdf";
    } else if (upper.includes("BANCO ITA") && upper.includes("VISA")) {
      banco = "itau-card-pdf";
    } else if (upper.includes("BBVA") && (upper.includes("PESOS URUGUAYOS") || upper.includes("DOLARES U.S.A") || upper.includes("CUENTAS CORRIENTES") || upper.includes("CAJA DE AHORROS"))) {
      banco = "bbva-pdf";
    } else if (upper.includes("BANCO ITA")) {
      banco = "itau-card-pdf";
    }
  }

  return NextResponse.json({
    banco,
    label: banco ? BANCO_LABELS[banco] ?? banco : null,
  });
}
