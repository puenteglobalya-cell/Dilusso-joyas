import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

// DELETE specific IDs (keeps one per group — caller passes the IDs to delete)
export async function POST(req: NextRequest) {
  const { ids } = await req.json() as { ids: string[] };
  if (!ids || ids.length === 0) return NextResponse.json({ deleted: 0 });

  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error, count } = await (sb.from("bank_statements") as any)
    .delete({ count: "exact" })
    .in("id", ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: count ?? ids.length });
}
