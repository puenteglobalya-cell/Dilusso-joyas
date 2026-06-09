import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

// GET /api/admin/preview-regla?keyword=xxx
// Returns count of unclassified rows matching ILIKE %keyword%
export async function GET(req: NextRequest) {
  const kw = req.nextUrl.searchParams.get("keyword")?.trim();
  if (!kw || kw.length < 2) return NextResponse.json({ count: 0 });

  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error } = await (sb.from("bank_statements") as any)
    .select("id", { count: "exact", head: true })
    .eq("clasificado", "No")
    .ilike("descripcion", `%${kw}%`);

  if (error) return NextResponse.json({ count: 0 });
  return NextResponse.json({ count: count ?? 0 });
}
