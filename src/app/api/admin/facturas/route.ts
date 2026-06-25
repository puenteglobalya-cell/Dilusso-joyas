import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo");
  const sb = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (sb.from("facturas") as any)
    .select(`id, created_at, filename, storage_path, tipo, año, mes, proveedor, fecha_factura, importe, moneda, notas,
      bank_statement_id,
      bank_statements:bank_statement_id (id, banco, fecha, descripcion, debito, moneda, tipo)`)
    .order("año", { ascending: false })
    .order("mes", { ascending: false })
    .order("created_at", { ascending: false });

  if (tipo) query = query.eq("tipo", tipo);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ facturas: data ?? [] });
}
