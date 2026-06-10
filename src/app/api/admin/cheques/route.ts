import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

interface Cheque {
  id: string; numero: string; fecha_cobro: string | null; proveedor: string | null;
  tipo_mercaderia: string | null; monto_uyu: number | null; monto_usd: number | null;
  banco: string | null; nota: string | null;
}
interface BSRow { id: string; numero: string | null; fecha: string; descripcion: string | null; debito: number | null; moneda: string; clasificado: string | null }

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
      .select("id, numero, fecha, descripcion, debito, moneda, clasificado")
      .not("numero", "is", null)
      .neq("numero", "")
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    movs = movs.concat(data as BSRow[]);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // Match by number suffix in either direction (the registry keeps the
  // termination; the statement may store a longer or shorter reference),
  // amount within $1 in the right currency, and movement date on/after
  // the cheque's fecha de cobro (a diferido can't clear earlier).
  // Build set of movIds already claimed by a full match (to avoid double-assigning)
  // We do two passes: first pass finds all exact matches, second pass uses fallbacks
  const claimedByNum = new Set<string>();

  // Pass 1: collect all numero+monto+fecha matches
  const pass1 = (cheques as Cheque[]).map(ch => {
    const monto = ch.monto_uyu ?? ch.monto_usd;
    const monedaEsperada = ch.monto_usd != null && ch.monto_uyu == null ? "USD" : "UYU";
    const cn = ch.numero.replace(/^0+/, "");

    const montoOk = (m: BSRow) =>
      monto != null && m.debito != null && Math.abs(m.debito - monto) < 1 && m.moneda === monedaEsperada;
    const fechaOk = (m: BSRow) => !ch.fecha_cobro || m.fecha >= ch.fecha_cobro;

    const candidates = movs
      .filter(m => {
        const mn = (m.numero ?? "").replace(/\D/g, "").replace(/^0+/, "");
        return mn === cn || mn.endsWith(cn) || cn.endsWith(mn);
      })
      .sort((a, b) => {
        const aEx = (a.numero ?? "").replace(/\D/g, "").replace(/^0+/, "") === cn ? 0 : 1;
        const bEx = (b.numero ?? "").replace(/\D/g, "").replace(/^0+/, "") === cn ? 0 : 1;
        return aEx - bEx;
      });

    const match = candidates.find(m => montoOk(m) && fechaOk(m)) ?? null;
    if (match) claimedByNum.add(match.id);
    return { ch, match, candidates, montoOk, fechaOk, monedaEsperada, monto };
  });

  // Pass 2: for unmatched cheques, try fallback by monto+moneda within ±60 days
  const results = pass1.map(({ ch, match, candidates, montoOk, fechaOk, monedaEsperada, monto }) => {
    let finalMatch = match;
    let matchParcial: (BSRow & { motivo: string }) | null = null;

    if (!finalMatch) {
      // Fallback: monto+moneda match in a ±60 day window, not already claimed
      if (monto != null && ch.fecha_cobro) {
        const d0 = new Date(ch.fecha_cobro);
        const dMin = new Date(d0); dMin.setDate(dMin.getDate() - 5);
        const dMax = new Date(d0); dMax.setDate(dMax.getDate() + 60);
        const dMinStr = dMin.toISOString().slice(0, 10);
        const dMaxStr = dMax.toISOString().slice(0, 10);
        const byAmount = movs.find(m =>
          !claimedByNum.has(m.id) &&
          m.debito != null && Math.abs(m.debito - monto) < 1 &&
          m.moneda === monedaEsperada &&
          m.fecha >= dMinStr && m.fecha <= dMaxStr
        );
        if (byAmount) {
          finalMatch = byAmount;
          claimedByNum.add(byAmount.id);
        }
      }

      // If still no match, show best partial from numero candidates
      if (!finalMatch && candidates.length > 0) {
        const conMonto = candidates.find(montoOk);
        matchParcial = conMonto
          ? { ...conMonto, motivo: `cobrado el ${conMonto.fecha} antes de la fecha de cobro ${ch.fecha_cobro}` }
          : { ...candidates[0], motivo: "monto difiere" };
      }
    }

    return {
      ...ch,
      match: finalMatch ? { id: finalMatch.id, fecha: finalMatch.fecha, descripcion: finalMatch.descripcion, debito: finalMatch.debito, moneda: finalMatch.moneda, clasificado: finalMatch.clasificado } : null,
      matchParcial: matchParcial ? { id: matchParcial.id, fecha: matchParcial.fecha, descripcion: matchParcial.descripcion, debito: matchParcial.debito, moneda: matchParcial.moneda, motivo: matchParcial.motivo } : null,
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
