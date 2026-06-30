import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { date, rate, source } = await req.json();
  const sb = createServerClient();

  // No hay constraint único en "date", así que hacemos upsert manual.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (sb.from("exchange_rates") as any)
    .select("id")
    .eq("date", date)
    .maybeSingle();

  const error = existing
    ? (await (sb.from("exchange_rates") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .update({ fecha: date, usd_uyu: rate, rate, source })
        .eq("id", existing.id)).error
    : (await (sb.from("exchange_rates") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .insert({ date, fecha: date, usd_uyu: rate, rate, source })).error;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
