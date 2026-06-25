import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const importe = parseFloat(searchParams.get("importe") ?? "0");
  const moneda = searchParams.get("moneda") ?? "UYU";
  const fecha = searchParams.get("fecha");

  if (!importe) return NextResponse.json({ matches: [] });

  const sb = createServerClient();
  const min = importe * 0.95;
  const max = importe * 1.05;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (sb.from("bank_statements") as any)
    .select("id, banco, fecha, descripcion, debito, moneda, tipo, categoria_negocio, categoria_personal")
    .eq("moneda", moneda)
    .gte("debito", min)
    .lte("debito", max)
    .order("fecha", { ascending: false })
    .limit(10);

  if (fecha) {
    const d = new Date(fecha);
    const from = new Date(d); from.setDate(d.getDate() - 5);
    const to = new Date(d);   to.setDate(d.getDate() + 30);
    query = query.gte("fecha", from.toISOString().split("T")[0]).lte("fecha", to.toISOString().split("T")[0]);
  }

  const { data } = await query;
  return NextResponse.json({ matches: data ?? [] });
}
