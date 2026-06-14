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

  // 2. Normalize bank_statements.categoria_personal
  const updateResults: string[] = [];
  for (const [oldName, newName] of Object.entries(CATEGORIA_NORMALIZAR)) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (sb.from("bank_statements") as any)
        .update({ categoria_personal: newName })
        .eq("categoria_personal", oldName)
        .select("id");
      if (error) {
        updateResults.push(`ERROR ${oldName}: ${error.message}`);
      } else if (data && data.length > 0) {
        updateResults.push(`${oldName} → ${newName}: ${data.length} filas`);
      }
    } catch (e) {
      updateResults.push(`EXCEPCION ${oldName}: ${String(e)}`);
    }
  }
  results.push({ step: "Normalizar banco_statements", ok: true, detail: updateResults.length > 0 ? updateResults.join(" | ") : "Sin cambios" });

  return NextResponse.json({ ok: true, results });
}
