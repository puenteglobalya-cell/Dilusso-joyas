import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

interface Cheque {
  id: string; numero: string; fecha_cobro: string | null; proveedor: string | null;
  tipo_mercaderia: string | null; monto_uyu: number | null; monto_usd: number | null;
  banco: string | null; nota: string | null;
}
interface BSRow { id: string; numero: string | null; fecha: string; descripcion: string | null; debito: number | null; moneda: string }

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cheques, error: chErr } = await (sb.from("cheques") as any)
    .select("*").order("numero").order("fecha_cobro");
  if (chErr) {
    return NextResponse.json({ error: `${chErr.message}. ¿Ejecutaste la migración de cheques?` }, { status: 500 });
  }

  // All bank movements that carry a cheque number (BBVA fills `numero`)
  const PAGE = 1000;
  let movs: BSRow[] = [];
  let from = 0;
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (sb.from("bank_statements") as any)
      .select("id, numero, fecha, descripcion, debito, moneda")
      .not("numero", "is", null)
      .neq("numero", "")
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    movs = movs.concat(data as BSRow[]);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // Match by number suffix in either direction (the registry keeps the
  // termination; the statement may store a longer or shorter reference)
  // plus amount within $1 in the right currency.
  const results = (cheques as Cheque[]).map(ch => {
    const monto = ch.monto_uyu ?? ch.monto_usd;
    const monedaEsperada = ch.monto_usd != null && ch.monto_uyu == null ? "USD" : "UYU";
    const candidates = movs.filter(m => {
      const mn = (m.numero ?? "").replace(/\D/g, "").replace(/^0+/, "");
      const cn = ch.numero.replace(/^0+/, "");
      if (!mn || !cn) return false;
      return mn === cn || mn.endsWith(cn) || cn.endsWith(mn);
    });
    const match = candidates.find(m =>
      monto != null && m.debito != null && Math.abs(m.debito - monto) < 1 && m.moneda === monedaEsperada
    ) ?? null;
    const matchNumOnly = !match && candidates.length > 0 ? candidates[0] : null;
    return {
      ...ch,
      match: match ? { id: match.id, fecha: match.fecha, descripcion: match.descripcion, debito: match.debito, moneda: match.moneda } : null,
      matchParcial: matchNumOnly ? { id: matchNumOnly.id, fecha: matchNumOnly.fecha, descripcion: matchNumOnly.descripcion, debito: matchNumOnly.debito, moneda: matchNumOnly.moneda } : null,
    };
  });

  return NextResponse.json({ cheques: results });
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from("cheques") as any).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
