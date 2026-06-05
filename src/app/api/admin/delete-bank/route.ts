import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { banco } = await req.json();
  if (!banco) return NextResponse.json({ error: "No banco" }, { status: 400 });

  const sb = createServerClient();
  // Map parser key to banco name in DB
  const BANCO_MAP: Record<string, string> = {
    "bbva-xls": "BBVA",
    "bbva-pdf": "BBVA",
    "itau-xls": "Itaú",
    "oca-pdf": "OCA",
    "scotiabank-pdf": "Scotiabank",
  };
  const bancoName = BANCO_MAP[banco] ?? banco;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error, count } = await (sb.from("bank_statements") as any)
    .delete({ count: "exact" })
    .eq("banco", bancoName);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: count ?? 0 });
}
