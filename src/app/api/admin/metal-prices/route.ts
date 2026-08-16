import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

const METALES = ["PLATA 925", "ORO 10K", "ORO 18K"] as const;

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from("metal_prices") as any).select("metal, precio_uyu_gramo, updated_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prices: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json() as { metal?: string; precio_uyu_gramo?: number };
  if (!body.metal || !METALES.includes(body.metal as typeof METALES[number])) {
    return NextResponse.json({ error: `Metal inválido. Debe ser: ${METALES.join(", ")}` }, { status: 400 });
  }
  if (!body.precio_uyu_gramo || body.precio_uyu_gramo <= 0) {
    return NextResponse.json({ error: "precio_uyu_gramo debe ser mayor a 0" }, { status: 400 });
  }

  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from("metal_prices") as any)
    .upsert({ metal: body.metal, precio_uyu_gramo: body.precio_uyu_gramo, updated_at: new Date().toISOString() }, { onConflict: "metal" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
