import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

const BANCO_MAP: Record<string, { banco: string; moneda?: string }> = {
  "bbva-xls":       { banco: "BBVA" },
  "bbva-xls-uyu":   { banco: "BBVA", moneda: "UYU" },
  "bbva-xls-usd":   { banco: "BBVA", moneda: "USD" },
  "bbva-pdf":       { banco: "BBVA" },
  "itau-xls":       { banco: "Itaú" },
  "itau-xls-uyu":   { banco: "Itaú", moneda: "UYU" },
  "itau-xls-usd":   { banco: "Itaú", moneda: "USD" },
  "oca-pdf":        { banco: "OCA" },
  "scotiabank-pdf": { banco: "Scotiabank" },
  "itau-card-pdf":  { banco: "Itau-Card" },
};

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { banco, mes } = await req.json();
  if (!banco) return NextResponse.json({ error: "No banco" }, { status: 400 });

  const cfg = BANCO_MAP[banco] ?? { banco };
  const sb = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (sb.from("bank_statements") as any).delete({ count: "exact" }).eq("banco", cfg.banco);
  if (cfg.moneda) query = query.eq("moneda", cfg.moneda);
  if (mes) query = query.gte("fecha", `${mes}-01`).lte("fecha", `${mes}-31`);

  const { error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: count ?? 0 });
}
