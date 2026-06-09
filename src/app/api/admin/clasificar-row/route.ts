/**
 * PATCH /api/admin/clasificar-row
 * Updates classification for a single row AND always bulk-updates all
 * unclassified rows with the same descripcion (exact match).
 * Optionally also saves a keyword to clasificacion_reglas dictionary.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  const body = await req.json() as {
    id: string;
    descripcion?: string;
    clasificado: string;
    tipo: string;
    categoria_negocio: string;
    categoria_personal: string;
    guardar_regla?: { keyword: string };
  };

  if (!body.id) return NextResponse.json({ error: "No id" }, { status: 400 });

  const sb = createServerClient();

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

  return NextResponse.json({ ok: true, actualizados, ...(reglaError ? { reglaError } : {}) });
}
