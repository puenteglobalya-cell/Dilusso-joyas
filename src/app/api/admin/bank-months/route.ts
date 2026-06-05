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

export async function GET(req: NextRequest) {
  const banco = req.nextUrl.searchParams.get("banco");
  if (!banco) return NextResponse.json({ months: [] });

  const bancoName = BANCO_MAP[banco] ?? banco;
  const sb = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb.from("bank_statements") as any)
    .select("fecha")
    .eq("banco", bancoName)
    .order("fecha", { ascending: true });

  const months = [...new Set(((data ?? []) as { fecha: string }[]).map((r) => r.fecha.slice(0, 7)))].sort();
  return NextResponse.json({ months });
}
