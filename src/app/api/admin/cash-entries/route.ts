import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from("cash_entries") as any)
    .select("id, fecha, descripcion, monto, movimiento, tipo, categoria_negocio, categoria_personal, notas, created_at")
    .order("fecha", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json() as {
    fecha?: string; descripcion?: string; monto?: number;
    movimiento?: string; tipo?: string; categoria_negocio?: string; categoria_personal?: string; notas?: string;
  };

  if (!body.fecha) return NextResponse.json({ error: "Falta fecha" }, { status: 400 });
  if (!body.descripcion) return NextResponse.json({ error: "Falta descripción" }, { status: 400 });
  if (!body.monto || body.monto <= 0) return NextResponse.json({ error: "Monto debe ser mayor a 0" }, { status: 400 });
  if (body.movimiento !== "salida" && body.movimiento !== "ingreso") {
    return NextResponse.json({ error: "movimiento debe ser 'salida' o 'ingreso'" }, { status: 400 });
  }

  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from("cash_entries") as any).insert({
    fecha: body.fecha,
    descripcion: body.descripcion,
    monto: body.monto,
    movimiento: body.movimiento,
    tipo: body.tipo === "personal" ? "personal" : "negocio",
    categoria_negocio: body.categoria_negocio ?? "",
    categoria_personal: body.categoria_personal ?? "",
    notas: body.notas ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from("cash_entries") as any).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
