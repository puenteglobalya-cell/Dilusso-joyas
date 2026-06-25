import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const sb = createServerClient();
  const cat_negocio = body.tipo === "negocio" ? (body.categoria ?? "") : "";
  const cat_personal = body.tipo === "personal" ? (body.categoria ?? "") : "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from("clasificacion_reglas") as any).upsert(
    { keyword: body.keyword, tipo: body.tipo, cat_negocio, cat_personal },
    { onConflict: "keyword" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb.from("clasificacion_reglas") as any).delete().eq("keyword", body.keyword);
  return NextResponse.json({ ok: true });
}
