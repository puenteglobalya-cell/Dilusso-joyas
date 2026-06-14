import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET: reclassify all "Insumos Relojes" rows → tipo=negocio, categoria_negocio=Insumos/Materiales
export async function GET() {
  const sb = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from("bank_statements") as any)
    .update({
      clasificado: "Si",
      tipo: "negocio",
      categoria_negocio: "Insumos/Materiales",
      categoria_personal: null,
    })
    .ilike("descripcion", "%insumos relojes%")
    .select("id, fecha, descripcion, debito");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    actualizados: data?.length ?? 0,
    rows: (data ?? []).map((r: { fecha: string; descripcion: string; debito: number }) => ({
      fecha: r.fecha,
      descripcion: r.descripcion,
      debito: r.debito,
    })),
  });
}
