import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireUser } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo") as "negocio" | "personal" | null;
  const categoria = searchParams.get("categoria");
  const mes = searchParams.get("mes"); // YYYY-MM, optional

  if (!tipo || !categoria) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const col = tipo === "negocio" ? "categoria_negocio" : "categoria_personal";
  const sb = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (sb.from("bank_statements") as any)
    .select("id,banco,fecha,descripcion,debito,credito,importe_uyu,moneda,nota")
    .eq("tipo", tipo)
    .eq(col, categoria)
    .neq("descripcion", "Saldo anterior")
    .order("fecha", { ascending: false })
    .limit(500);

  if (mes) {
    const [y, m] = mes.split("-").map(Number);
    const nextM = m === 12 ? 1 : m + 1;
    const nextY = m === 12 ? y + 1 : y;
    q = q
      .gte("fecha", `${y}-${String(m).padStart(2, "0")}-01`)
      .lt("fecha", `${nextY}-${String(nextM).padStart(2, "0")}-01`);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
