import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

const BANCO_MAP: Record<string, string> = {
  "bbva-xls": "BBVA",
  "bbva-pdf": "BBVA",
  "itau-xls": "Itaú",
  "oca-pdf": "OCA",
  "scotiabank-pdf": "Scotiabank",
};

export async function POST(req: NextRequest) {
  const { banco, mes } = await req.json(); // mes = "YYYY-MM" or null (= all)
  if (!banco) return NextResponse.json({ error: "No banco" }, { status: 400 });

  const bancoName = BANCO_MAP[banco] ?? banco;
  const sb = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (sb.from("bank_statements") as any).delete({ count: "exact" }).eq("banco", bancoName);
  if (mes) {
    query = query.gte("fecha", `${mes}-01`).lte("fecha", `${mes}-31`);
  }

  const { error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: count ?? 0 });
}
