/**
 * PATCH /api/admin/clasificar-row
 * Updates classification for a single bank_statement row.
 * When guardar_regla is provided, also bulk-updates all unclassified rows
 * whose descripcion contains the keyword.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  const body = await req.json() as {
    id: string;
    clasificado: string;
    tipo: string;
    categoria_negocio: string;
    categoria_personal: string;
    guardar_regla?: { keyword: string };
  };

  if (!body.id) return NextResponse.json({ error: "No id" }, { status: 400 });

  const sb = createServerClient();

  // Update the single row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from("bank_statements") as any)
    .update({
      clasificado: body.clasificado,
      tipo: body.tipo,
      categoria_negocio: body.categoria_negocio,
      categoria_personal: body.categoria_personal,
    })
    .eq("id", body.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let reglaError: string | null = null;
  let actualizados = 0;

  if (body.guardar_regla?.keyword) {
    const keyword = body.guardar_regla.keyword;

    // Save to dictionary
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: re } = await (sb.from("clasificacion_reglas") as any).upsert({
      keyword,
      tipo: body.tipo,
      cat_negocio: body.categoria_negocio,
      cat_personal: body.categoria_personal,
    }, { onConflict: "keyword" });
    if (re) reglaError = re.message;

    // Bulk-update all unclassified rows that match the keyword (case-insensitive via ilike)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error: bulkError } = await (sb.from("bank_statements") as any)
      .update({
        clasificado: body.clasificado,
        tipo: body.tipo,
        categoria_negocio: body.categoria_negocio,
        categoria_personal: body.categoria_personal,
      })
      .eq("clasificado", "No")
      .ilike("descripcion", `%${keyword}%`)
      .select("id", { count: "exact", head: true });

    if (bulkError) reglaError = (reglaError ? reglaError + "; " : "") + bulkError.message;
    else actualizados = count ?? 0;
  }

  return NextResponse.json({ ok: true, actualizados, ...(reglaError ? { reglaError } : {}) });
}
