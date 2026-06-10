import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

interface MatchToApply {
  movId: string;
  categoria: string;
  descripcion: string;
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { matches } = await req.json() as { matches: MatchToApply[] };
  if (!Array.isArray(matches) || matches.length === 0) {
    return NextResponse.json({ ok: true, clasificados: 0 });
  }

  const sb = createServerClient();
  let clasificados = 0;

  for (const { movId, categoria, descripcion } of matches) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb.from("bank_statements") as any)
      .update({
        tipo: "negocio",
        categoria_negocio: categoria,
        clasificado: "Si",
        descripcion,
      })
      .eq("id", movId);
    if (!error) clasificados++;
  }

  return NextResponse.json({ ok: true, clasificados });
}
