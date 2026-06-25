import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from("notas") as any)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { contenido, categoria } = await req.json();
  if (!contenido?.trim()) return NextResponse.json({ error: "Contenido requerido" }, { status: 400 });
  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from("notas") as any)
    .insert({ contenido: contenido.trim(), categoria: categoria ?? "general" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id, resuelta, contenido } = await req.json();
  if (!id) return NextResponse.json({ error: "No id" }, { status: 400 });
  const sb = createServerClient();
  const updates: Record<string, unknown> = {};
  if (resuelta !== undefined) updates.resuelta = resuelta;
  if (contenido !== undefined) updates.contenido = contenido;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from("notas") as any).update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await req.json();
  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb.from("notas") as any).delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
