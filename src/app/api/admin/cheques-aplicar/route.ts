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

  let body: { matches?: MatchToApply[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body inválido" }, { status: 400 });
  }

  const matches = body.matches ?? [];

  if (matches.length === 0) {
    return NextResponse.json({ ok: true, clasificados: 0, debug: "no matches received" });
  }

  const sb = createServerClient();
  const resultados: { id: string; ok: boolean; error?: string }[] = [];

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
    resultados.push({ id: movId, ok: !error, error: error?.message });
  }

  const clasificados = resultados.filter(r => r.ok).length;
  const errores = resultados.filter(r => !r.ok);

  return NextResponse.json({
    ok: true,
    clasificados,
    total: matches.length,
    errores: errores.length > 0 ? errores : undefined,
  });
}
