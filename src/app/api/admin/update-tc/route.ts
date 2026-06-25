/**
 * POST /api/admin/update-tc
 * Body: { mes: "YYYY-MM", tc: number }
 * Updates the exchange rate for a month and re-calculates importe_uyu for USD rows of that month.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { mes, tc } = await req.json() as { mes: string; tc: number };

  if (!mes || !tc || tc <= 0) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const sb = createServerClient();

  // Fetch all USD rows for this month
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: usdRows, error: fetchErr } = await (sb.from("bank_statements") as any)
    .select("id, credito, debito")
    .eq("moneda", "USD")
    .gte("fecha", `${mes}-01`)
    .lte("fecha", `${mes}-31`);

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  let updated = 0;
  for (const row of (usdRows ?? []) as { id: string; credito: number | null; debito: number | null }[]) {
    const importe_uyu = ((row.credito ?? 0) - (row.debito ?? 0)) * tc;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb.from("bank_statements") as any)
      .update({ tc, importe_uyu })
      .eq("id", row.id);
    if (!error) updated++;
  }

  return NextResponse.json({ ok: true, updated });
}
