import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

// POST /api/admin/bulk-classify
// Body: { ids: string[], tipo, categoria_negocio, categoria_personal, usuario_email? }
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json() as {
    ids: string[];
    tipo: string;
    categoria_negocio: string;
    categoria_personal: string;
    usuario_email?: string;
  };

  if (!body.ids?.length) return NextResponse.json({ error: "No ids" }, { status: 400 });
  if (!body.tipo) return NextResponse.json({ error: "Tipo requerido" }, { status: 400 });

  const sb = createServerClient();
  const update = {
    clasificado: "Si",
    tipo: body.tipo,
    categoria_negocio: body.categoria_negocio ?? "",
    categoria_personal: body.categoria_personal ?? "",
  };

  // Fetch previous values for audit log
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prevRows } = await (sb.from("bank_statements") as any)
    .select("id, banco, fecha, descripcion, tipo, categoria_negocio, categoria_personal")
    .in("id", body.ids);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error } = await (sb.from("bank_statements") as any)
    .update(update)
    .in("id", body.ids)
    .select("id", { count: "exact", head: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Write audit log entries (best-effort — ignore errors)
  if (prevRows?.length) {
    const logEntries = prevRows.map((r: { id: string; banco: string; fecha: string; descripcion: string | null; tipo: string | null; categoria_negocio: string | null; categoria_personal: string | null }) => ({
      bank_statement_id: r.id,
      banco: r.banco,
      fecha: r.fecha,
      descripcion: r.descripcion,
      tipo_anterior: r.tipo,
      tipo_nuevo: body.tipo,
      cat_negocio_anterior: r.categoria_negocio,
      cat_negocio_nueva: body.categoria_negocio,
      cat_personal_anterior: r.categoria_personal,
      cat_personal_nueva: body.categoria_personal,
      usuario_email: body.usuario_email ?? null,
      bulk_count: 0,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from("clasificacion_log") as any).insert(logEntries).then(() => {}).catch(() => {});
  }

  return NextResponse.json({ ok: true, updated: count ?? body.ids.length });
}
