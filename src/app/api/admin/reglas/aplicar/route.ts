/**
 * POST /api/admin/reglas/aplicar
 * Aplica todas las reglas activas a movimientos sin clasificar.
 * Útil para correr después de importar un extracto.
 */
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { evaluarRegla, Regla, BankRow } from "@/lib/clasificacion-reglas";

export const runtime = "nodejs";

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const sb = createServerClient();

  // Traer todas las reglas activas
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: reglas } = await (sb.from("clasificacion_reglas") as any)
    .select("*").eq("activa", true).order("created_at", { ascending: true });

  if (!reglas?.length) return NextResponse.json({ ok: true, aplicados: 0 });

  // Traer todos los movimientos sin clasificar (en lotes)
  let aplicados = 0;
  let from = 0;
  const PAGE = 500;

  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows } = await (sb.from("bank_statements") as any)
      .select("id, banco, fecha, descripcion, debito, moneda")
      .eq("clasificado", "No")
      .range(from, from + PAGE - 1);

    if (!rows?.length) break;

    for (const row of rows as BankRow[]) {
      for (const regla of reglas as Regla[]) {
        if (evaluarRegla(regla, row)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (sb.from("bank_statements") as any).update({
            tipo: regla.tipo,
            categoria_negocio: regla.categoria_negocio,
            categoria_personal: regla.categoria_personal,
            clasificado: "Si",
          }).eq("id", row.id);
          aplicados++;
          break; // primera regla que matchea gana
        }
      }
    }

    if (rows.length < PAGE) break;
    from += PAGE;
  }

  return NextResponse.json({ ok: true, aplicados });
}
