import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

// Maps admin selector key → { banco, moneda? }
const BANCO_MAP: Record<string, { banco: string; moneda?: string }> = {
  "bbva-xls-uyu":    { banco: "BBVA", moneda: "UYU" },
  "bbva-xls-usd":    { banco: "BBVA", moneda: "USD" },
  "bbva-xls":        { banco: "BBVA" },
  "bbva-pdf":        { banco: "BBVA" },
  "itau-xls-uyu":    { banco: "Itaú", moneda: "UYU" },
  "itau-xls-usd":    { banco: "Itaú", moneda: "USD" },
  "itau-xls":        { banco: "Itaú" },
  "oca-pdf":         { banco: "OCA" },
  "scotiabank-pdf":  { banco: "Scotiabank" },
  "itau-card-pdf":   { banco: "Itau-Card" },
};

export async function GET(req: NextRequest) {
  const banco = req.nextUrl.searchParams.get("banco");
  if (!banco) return NextResponse.json({ months: [] });

  const cfg = BANCO_MAP[banco] ?? { banco };
  const sb = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (sb.from("bank_statements") as any)
    .select("fecha, moneda")
    .eq("banco", cfg.banco)
    .order("fecha", { ascending: true });

  if (cfg.moneda) query = query.eq("moneda", cfg.moneda);

  const { data } = await query;

  // Return months with their moneda for display
  const raw = (data ?? []) as { fecha: string; moneda: string }[];
  const months = [...new Set(raw.map((r) => r.fecha.slice(0, 7)))].sort();
  return NextResponse.json({ months });
}
