/**
 * PATCH /api/admin/clasificar-row
 * Updates classification for a single row AND always bulk-updates all
 * unclassified rows with the same descripcion (exact match).
 * Optionally also saves a keyword to clasificacion_reglas dictionary.
 * Writes an audit entry to clasificacion_log (best-effort).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json() as {
    id: string;
    descripcion?: string;
    clasificado: string;
    tipo: string;
    categoria_negocio: string;
    categoria_personal: string;
    guardar_regla?: { keyword: string };
    usuario_email?: string;
    // Previous values for audit log
    prev_tipo?: string | null;
    prev_cat_negocio?: string | null;
    prev_cat_personal?: string | null;
  };

  if (!body.id) return NextResponse.json({ error: "No id" }, { status: 400 });

  const sb = createServerClient();

  // Fetch current row for audit (if prev values not supplied)
  let prevTipo = body.prev_tipo ?? null;
  let prevCatNeg = body.prev_cat_negocio ?? null;
  let prevCatPer = body.prev_cat_personal ?? null;
  let rowBanco = "";
  let rowFecha = "";

  if (!body.prev_tipo) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: curr } = await (sb.from("bank_statements") as any)
      .select("tipo, categoria_negocio, categoria_personal, banco, fecha")
      .eq("id", body.id)
      .single();
    if (curr) {
      prevTipo = curr.tipo;
      prevCatNeg = curr.categoria_negocio;
      prevCatPer = curr.categoria_personal;
      rowBanco = curr.banco;
      rowFecha = curr.fecha;
    }
  }

  const update = {
    clasificado: body.clasificado,
    tipo: body.tipo,
    categoria_negocio: body.categoria_negocio,
    categoria_personal: body.categoria_personal,
  };

  // Update the target row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from("bank_statements") as any)
    .update(update)
    .eq("id", body.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let actualizados = 0;
  let reglaError: string | null = null;

  // Always bulk-update all unclassified rows with the same descripcion
  if (body.descripcion && body.clasificado === "Si") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (sb.from("bank_statements") as any)
      .update(update)
      .eq("clasificado", "No")
      .eq("descripcion", body.descripcion)
      .select("id", { count: "exact", head: true });
    actualizados = count ?? 0;
  }

  // Optionally save keyword to dictionary + also apply by keyword (broader match)
  if (body.guardar_regla?.keyword) {
    const keyword = body.guardar_regla.keyword;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: re } = await (sb.from("clasificacion_reglas") as any).upsert({
      keyword,
      tipo: body.tipo,
      cat_negocio: body.categoria_negocio,
      cat_personal: body.categoria_personal,
    }, { onConflict: "keyword" });
    if (re) reglaError = re.message;

    // Apply keyword match (catches variations beyond exact description)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: kwCount } = await (sb.from("bank_statements") as any)
      .update(update)
      .eq("clasificado", "No")
      .ilike("descripcion", `%${keyword}%`)
      .select("id", { count: "exact", head: true });
    actualizados += kwCount ?? 0;
  }

  // Write audit log (best-effort — silently ignore if table doesn't exist yet)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from("clasificacion_log") as any).insert({
      bank_statement_id: body.id,
      banco: rowBanco || null,
      fecha: rowFecha || null,
      descripcion: body.descripcion ?? null,
      tipo_anterior: prevTipo,
      tipo_nuevo: body.tipo,
      cat_negocio_anterior: prevCatNeg,
      cat_negocio_nueva: body.categoria_negocio,
      cat_personal_anterior: prevCatPer,
      cat_personal_nueva: body.categoria_personal,
      usuario_email: body.usuario_email ?? null,
      bulk_count: actualizados,
    });
  } catch {
    // Table may not exist yet — non-fatal
  }

  return NextResponse.json({ ok: true, actualizados, ...(reglaError ? { reglaError } : {}) });
}
