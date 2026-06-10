import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

interface Cheque {
  id: string; numero: string; fecha_cobro: string | null; proveedor: string | null;
  tipo_mercaderia: string | null; monto_uyu: number | null; monto_usd: number | null;
}
interface BSRow { id: string; numero: string | null; fecha: string; debito: number | null; moneda: string; clasificado: string | null }

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const sb = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cheques, error: chErr } = await (sb.from("cheques") as any)
    .select("id, numero, fecha_cobro, proveedor, tipo_mercaderia, monto_uyu, monto_usd");
  if (chErr) return NextResponse.json({ error: chErr.message }, { status: 500 });

  const PAGE = 1000;
  let movs: BSRow[] = [];
  let from = 0;
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (sb.from("bank_statements") as any)
      .select("id, numero, fecha, debito, moneda, clasificado")
      .not("numero", "is", null).neq("numero", "")
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    movs = movs.concat(data as BSRow[]);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const idsToClassify: { id: string; categoria: string; descripcion: string }[] = [];

  for (const ch of (cheques as Cheque[])) {
    const monto = ch.monto_uyu ?? ch.monto_usd;
    const monedaEsperada = ch.monto_usd != null && ch.monto_uyu == null ? "USD" : "UYU";
    const match = movs.find(m => {
      const mn = (m.numero ?? "").replace(/\D/g, "").replace(/^0+/, "");
      const cn = ch.numero.replace(/^0+/, "");
      if (!mn || !cn) return false;
      const numOk = mn === cn || mn.endsWith(cn) || cn.endsWith(mn);
      const montoOk = monto != null && m.debito != null && Math.abs(m.debito - monto) < 1 && m.moneda === monedaEsperada;
      const fechaOk = !ch.fecha_cobro || m.fecha >= ch.fecha_cobro;
      return numOk && montoOk && fechaOk;
    });
    // Classify regardless of current clasificado value (null or "No")
    if (match && match.clasificado === "Si") continue;
    if (!match) continue;

    const proveedor = (ch.proveedor ?? "").trim();
    const descripcion = proveedor
      ? `${proveedor} - Cheque ${ch.numero}`
      : `Cheque ${ch.numero}`;

    idsToClassify.push({
      id: match.id,
      categoria: (ch.tipo_mercaderia ?? "Mercadería").trim(),
      descripcion,
    });
  }

  if (idsToClassify.length === 0) {
    return NextResponse.json({ ok: true, clasificados: 0 });
  }

  let clasificados = 0;
  for (const { id, categoria, descripcion } of idsToClassify) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb.from("bank_statements") as any)
      .update({
        tipo: "negocio",
        categoria_negocio: categoria,
        clasificado: "Si",
        descripcion,
      })
      .eq("id", id);
    if (!error) clasificados++;
  }

  return NextResponse.json({ ok: true, clasificados });
}
