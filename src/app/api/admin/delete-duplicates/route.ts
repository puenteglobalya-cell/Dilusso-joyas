import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { normalizeDesc } from "@/lib/normalize";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { ids } = await req.json() as { ids: string[] };
  if (!ids || ids.length === 0) return NextResponse.json({ deleted: 0 });

  const sb = createServerClient();

  // Server-side validation: verify each ID really has a duplicate before deleting
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: toDelete, error: fetchError } = await (sb.from("bank_statements") as any)
    .select("id, banco, fecha, moneda, descripcion, debito, credito")
    .in("id", ids);

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!toDelete || toDelete.length === 0) return NextResponse.json({ deleted: 0 });

  type Row = { id: string; banco: string; fecha: string; moneda: string; descripcion: string | null; debito: number | null; credito: number | null };
  const rows = toDelete as Row[];

  // Fetch all peers in one query per unique (banco, fecha) combo
  const combos = [...new Set(rows.map(r => `${r.banco}||${r.fecha}`))];
  const peerMap = new Map<string, Row[]>();
  for (const combo of combos) {
    const [banco, fecha] = combo.split("||");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: peers } = await (sb.from("bank_statements") as any)
      .select("id, banco, fecha, moneda, descripcion, debito, credito")
      .eq("banco", banco)
      .eq("fecha", fecha);
    peerMap.set(combo, (peers ?? []) as Row[]);
  }

  const verifiedIds: string[] = [];
  for (const row of rows) {
    const nd = normalizeDesc(row.descripcion);
    const peers = peerMap.get(`${row.banco}||${row.fecha}`) ?? [];
    const hasDup = peers.some(p =>
      p.id !== row.id &&
      p.moneda === row.moneda &&
      normalizeDesc(p.descripcion) === nd &&
      (p.debito ?? null) === (row.debito ?? null) &&
      (p.credito ?? null) === (row.credito ?? null)
    );
    if (hasDup) verifiedIds.push(row.id);
  }

  if (verifiedIds.length === 0) {
    return NextResponse.json(
      { error: "Ninguno de los IDs tiene un duplicado confirmado en la base. Quizás ya fueron borrados." },
      { status: 400 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error, count } = await (sb.from("bank_statements") as any)
    .delete({ count: "exact" })
    .in("id", verifiedIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: count ?? verifiedIds.length });
}
