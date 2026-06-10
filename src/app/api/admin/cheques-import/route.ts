import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

interface ParsedCheque {
  numero: string;
  fecha_cobro: string | null;
  proveedor: string | null;
  tipo_mercaderia: string | null;
  monto_uyu: number | null;
  monto_usd: number | null;
  banco: string | null;
  nota: string | null;
}

// "1.000,00" | "4052,0" | "24.424,00" → number
function parseMonto(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = parseFloat(t.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}

// Tolerant DD/MM/YYYY parser — handles "28/2/2026", "31//05/206" returns null on garbage
function parseFecha(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\/+(\d{1,2})\/+(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const day = Number(d), mon = Number(mo);
  if (day < 1 || day > 31 || mon < 1 || mon > 12) return null;
  return `${y}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseLines(text: string): { rows: ParsedCheque[]; errores: string[] } {
  const rows: ParsedCheque[] = [];
  const errores: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r/g, "");
    if (!line.trim()) continue;
    const cols = line.split("\t").map(c => c.trim());
    // Skip header row
    if (/numero de cheque|número de cheque/i.test(cols[0] ?? "")) continue;
    const numero = (cols[0] ?? "").replace(/\D/g, "");
    if (!numero) continue;

    const fecha = parseFecha(cols[1] ?? "");
    if ((cols[1] ?? "").trim() && !fecha) errores.push(`Cheque ${numero}: fecha inválida "${cols[1]}"`);

    const montoUYU = parseMonto(cols[4] ?? "");
    const montoUSD = parseMonto(cols[5] ?? "");
    // Column 6 sometimes carries free text instead of a bank name (e.g. "error en el importa…")
    const col6 = (cols[6] ?? "").trim();
    const esBanco = /^(bbva|ita[uú]|oca|scotia)/i.test(col6);

    rows.push({
      numero,
      fecha_cobro: fecha,
      proveedor: cols[2] || null,
      tipo_mercaderia: cols[3] || null,
      monto_uyu: montoUYU,
      monto_usd: montoUSD,
      banco: esBanco ? col6 : null,
      nota: !esBanco && col6 ? col6 : null,
    });
  }
  return { rows, errores };
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { text } = await req.json();
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Pegá el contenido de la planilla (separado por tabs)" }, { status: 400 });
  }

  const { rows, errores } = parseLines(text);
  if (rows.length === 0) {
    return NextResponse.json({ error: "No se encontraron cheques en el texto pegado" }, { status: 400 });
  }

  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: exErr } = await (sb.from("cheques") as any)
    .select("numero, fecha_cobro, monto_uyu, monto_usd");
  if (exErr) {
    return NextResponse.json({ error: `Error leyendo cheques existentes: ${exErr.message}. ¿Ejecutaste la migración?` }, { status: 500 });
  }

  const key = (c: { numero: string; fecha_cobro: string | null; monto_uyu: number | null; monto_usd: number | null }) =>
    `${c.numero}|${c.fecha_cobro ?? ""}|${c.monto_uyu ?? ""}|${c.monto_usd ?? ""}`;
  const existingKeys = new Set((existing ?? []).map(key));

  const nuevos: ParsedCheque[] = [];
  let skipped = 0;
  for (const r of rows) {
    const k = key(r);
    if (existingKeys.has(k)) { skipped++; continue; }
    existingKeys.add(k); // also dedupe within the paste itself
    nuevos.push(r);
  }

  let inserted = 0;
  if (nuevos.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insErr } = await (sb.from("cheques") as any).insert(nuevos);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    inserted = nuevos.length;
  }

  return NextResponse.json({ ok: true, parsed: rows.length, inserted, skipped, errores });
}
