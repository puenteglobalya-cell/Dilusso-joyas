import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from("vendor_dictionary") as any).upsert(
    { keyword: body.keyword, tipo: body.tipo, categoria: body.categoria, banco: body.banco ?? null, notes: body.notes ?? null },
    { onConflict: "keyword" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb.from("vendor_dictionary") as any).delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
