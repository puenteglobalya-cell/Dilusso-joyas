import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

// GET /api/buscar?q=texto&banco=BBVA&desde=2025-01-01&hasta=2025-12-31&tipo=negocio
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const banco = req.nextUrl.searchParams.get("banco");
  const desde = req.nextUrl.searchParams.get("desde");
  const hasta = req.nextUrl.searchParams.get("hasta");
  const tipo = req.nextUrl.searchParams.get("tipo");

  if (!q || q.length < 2) return NextResponse.json({ rows: [] });

  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (sb.from("bank_statements") as any)
    .select("id,banco,fecha,descripcion,debito,credito,moneda,tipo,categoria_negocio,categoria_personal,clasificado")
    .ilike("descripcion", `%${q}%`)
    .neq("descripcion", "Saldo anterior")
    .order("fecha", { ascending: false })
    .limit(200);

  if (banco) query = query.eq("banco", banco);
  if (tipo) query = query.eq("tipo", tipo);
  if (desde) query = query.gte("fecha", desde);
  if (hasta) query = query.lte("fecha", hasta);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}
