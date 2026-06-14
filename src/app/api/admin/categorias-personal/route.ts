import { createServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb.from("bank_statements") as any)
    .select("categoria_personal")
    .eq("tipo", "personal")
    .not("categoria_personal", "is", null)
    .order("categoria_personal");

  const counts: Record<string, number> = {};
  for (const r of (data ?? [])) {
    counts[r.categoria_personal] = (counts[r.categoria_personal] ?? 0) + 1;
  }

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([categoria, n]) => ({ categoria, n }));

  return NextResponse.json(sorted);
}
