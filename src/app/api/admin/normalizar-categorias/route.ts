import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { CATEGORIAS_PERSONAL, CATEGORIA_NORMALIZAR } from "@/lib/categorias-personal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const sb = createServerClient();
  const results: { step: string; ok: boolean; detail?: string }[] = [];

  // 1. Seed categories table with canonical names
  try {
    for (const name of CATEGORIAS_PERSONAL) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb.from("categories") as any)
        .upsert({ name, type: "personal" }, { onConflict: "name,type" });
    }
    results.push({ step: "Seed categories table", ok: true, detail: `${CATEGORIAS_PERSONAL.length} categorías canónicas` });
  } catch (e) {
    results.push({ step: "Seed categories table", ok: false, detail: String(e) });
  }

  // 2. Check current state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentCats } = await (sb.from("bank_statements") as any)
    .select("categoria_personal")
    .eq("tipo", "personal")
    .not("categoria_personal", "is", null);

  const counts: Record<string, number> = {};
  for (const r of (currentCats ?? [])) {
    counts[r.categoria_personal] = (counts[r.categoria_personal] ?? 0) + 1;
  }

  // 3. Normalize bank_statements.categoria_personal
  const updateResults: string[] = [];
  for (const [oldName, newName] of Object.entries(CATEGORIA_NORMALIZAR)) {
    if (!counts[oldName]) continue; // skip if no rows with this name
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (sb.from("bank_statements") as any)
        .update({ categoria_personal: newName })
        .eq("categoria_personal", oldName);
      if (error) {
        updateResults.push(`ERROR ${oldName}: ${error.message}`);
      } else {
        updateResults.push(`${oldName} → ${newName}: ${counts[oldName]} filas`);
      }
    } catch (e) {
      updateResults.push(`EXCEPCION ${oldName}: ${String(e)}`);
    }
  }

  const estadoActual = Object.entries(counts).map(([cat, n]) => `${cat}: ${n}`).join(", ");
  results.push({ step: "Estado actual categorías", ok: true, detail: estadoActual });
  results.push({ step: "Normalizar banco_statements", ok: true, detail: updateResults.length > 0 ? updateResults.join(" | ") : "Sin cambios (ya normalizado)" });

  return NextResponse.json({ ok: true, results });
}
