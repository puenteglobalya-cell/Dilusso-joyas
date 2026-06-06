/**
 * PATCH /api/admin/clasificar-row
 * Updates classification for a single bank_statement row.
 * Optionally saves keyword to clasificacion_reglas table.
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
    // optional: save keyword to dictionary
    guardar_regla?: { keyword: string };
  };

  if (!body.id) return NextResponse.json({ error: "No id" }, { status: 400 });

  const sb = createServerClient();

  // Update the row
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

  // Optionally save keyword to dictionary
  if (body.guardar_regla?.keyword) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from("clasificacion_reglas") as any).upsert({
      keyword: body.guardar_regla.keyword,
      tipo: body.tipo,
      cat_negocio: body.categoria_negocio,
      cat_personal: body.categoria_personal,
    }, { onConflict: "keyword" });
  }

  return NextResponse.json({ ok: true });
}
