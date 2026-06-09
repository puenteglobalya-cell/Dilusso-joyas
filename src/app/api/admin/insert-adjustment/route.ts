import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { getTc } from "@/lib/tipo-cambio";
import { clasificar } from "@/lib/clasificador";

export const runtime = "nodejs";

// POST /api/admin/insert-adjustment
// Inserts a single "Ajuste" row to close a continuity gap.
// Body: { banco, moneda, fecha, diff, descripcion? }
// - diff > 0 → we need a credit (missing income) to bring running total up to declared SA
// - diff < 0 → we need a debit (extra expense) to bring running total down to declared SA
// The row is inserted one day before the SA fecha so it belongs to the closing period.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json() as {
    banco: string;
    moneda: string;
    fecha: string; // YYYY-MM-DD of the Saldo anterior row
    diff: number;
    descripcion?: string;
  };

  if (!body.banco || !body.moneda || !body.fecha || body.diff === undefined) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }
  if (Math.abs(body.diff) < 0.001) {
    return NextResponse.json({ error: "La diferencia es cero, no hay nada que ajustar." }, { status: 400 });
  }

  // Place adjustment on the day before the SA fecha
  const d = new Date(body.fecha + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  const adjFecha = d.toISOString().slice(0, 10);

  const descripcion = (body.descripcion?.trim() || "Ajuste de redondeo").slice(0, 200);
  const debito  = body.diff < 0 ? Math.abs(body.diff) : null;
  const credito = body.diff > 0 ? body.diff : null;

  const sb = createServerClient();

  // Compute the running saldo just before this SA to set the adjustment's saldo field.
  // We don't need to be precise — set saldo = null and let the page recompute.
  // But we do need banco field to match.

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: customRules } = await (sb.from("clasificacion_reglas") as any)
    .select("keyword, tipo, cat_negocio, cat_personal");

  const clasi = clasificar(descripcion, customRules ?? []);
  const tc = body.moneda === "USD" ? getTc(adjFecha) : null;
  const importe_uyu = body.moneda === "USD" && tc
    ? ((credito ?? 0) - (debito ?? 0)) * tc
    : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from("bank_statements") as any)
    .insert({
      banco: body.banco,
      fecha: adjFecha,
      descripcion,
      debito,
      credito,
      saldo: null,
      moneda: body.moneda,
      cuenta: null,
      numero: null,
      clasificado: clasi.clasificado,
      tipo: clasi.tipo,
      categoria_negocio: clasi.categoria_negocio,
      categoria_personal: clasi.categoria_personal,
      tc,
      importe_uyu,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id, fecha: adjFecha });
}
