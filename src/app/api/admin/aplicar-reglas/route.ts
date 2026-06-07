/**
 * POST /api/admin/aplicar-reglas
 * Applies all clasificacion_reglas to every unclassified bank_statement row.
 * Returns { actualizados } count.
 */
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST() {
  const sb = createServerClient();

  // Fetch all custom rules
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rules, error: rulesError } = await (sb.from("clasificacion_reglas") as any)
    .select("keyword, tipo, cat_negocio, cat_personal");

  if (rulesError) return NextResponse.json({ error: rulesError.message }, { status: 500 });
  if (!rules || rules.length === 0) return NextResponse.json({ ok: true, actualizados: 0 });

  let totalActualizados = 0;

  for (const rule of rules as { keyword: string; tipo: string; cat_negocio: string; cat_personal: string }[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error } = await (sb.from("bank_statements") as any)
      .update({
        clasificado: "Si",
        tipo: rule.tipo,
        categoria_negocio: rule.cat_negocio,
        categoria_personal: rule.cat_personal,
      })
      .eq("clasificado", "No")
      .ilike("descripcion", `%${rule.keyword}%`)
      .select("id", { count: "exact", head: true });

    if (!error) totalActualizados += count ?? 0;
  }

  return NextResponse.json({ ok: true, actualizados: totalActualizados });
}
