import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const sb = createServerClient();
  const PAGE = 1000;
  let rows: unknown[] = [];
  let from = 0;
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from("bank_statements") as any)
      .select("id,banco,fecha,descripcion,debito,credito,importe_uyu,moneda,nota")
      .eq("clasificado", "No")
      .neq("descripcion", "Saldo anterior")
      .order("fecha", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    rows = rows.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return NextResponse.json({ rows, total: rows.length });
}
