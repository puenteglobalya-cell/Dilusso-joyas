import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { normalizeDesc, hasNonAscii } from "@/lib/normalize";

export const runtime = "nodejs";

export interface DupGroup {
  banco: string;
  fecha: string;
  descripcion: string;
  debito: number | null;
  credito: number | null;
  moneda: string;
  ids: string[];
  dirty: boolean[];
  count: number;
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const sb = createServerClient();

  const PAGE = 1000;
  type Row = { id: string; banco: string; fecha: string; descripcion: string | null; debito: number | null; credito: number | null; moneda: string };
  let all: Row[] = [];
  let from = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: totalCount, error: countError } = await (sb.from("bank_statements") as any)
    .select("id", { count: "exact", head: true });

  if (countError) {
    return NextResponse.json({ error: `Error al contar filas: ${countError.message}` }, { status: 500 });
  }

  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from("bank_statements") as any)
      .select("id,banco,fecha,descripcion,debito,credito,moneda")
      .range(from, from + PAGE - 1);

    if (error) {
      return NextResponse.json({ error: `Error al leer página ${from}: ${error.message}` }, { status: 500 });
    }
    if (!data || data.length === 0) break;
    all = all.concat(data as Row[]);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  if (totalCount !== null && all.length < totalCount) {
    return NextResponse.json(
      { error: `Lectura incompleta: se leyeron ${all.length} de ${totalCount} filas. Reintentá.` },
      { status: 500 }
    );
  }

  const groups = new Map<string, { rows: Row[] }>();
  for (const row of all) {
    const nd = normalizeDesc(row.descripcion);
    const key = `${row.banco}|${row.fecha}|${row.moneda}|${nd}|${row.debito ?? ""}|${row.credito ?? ""}`;
    if (!groups.has(key)) groups.set(key, { rows: [] });
    groups.get(key)!.rows.push(row);
  }

  const dupGroups: DupGroup[] = [];
  for (const { rows } of groups.values()) {
    if (rows.length < 2) continue;

    // Sort: clean descriptions first so "conservar" defaults to the clean one
    const sorted = [...rows].sort((a, b) => {
      const aDirty = hasNonAscii(a.descripcion) ? 1 : 0;
      const bDirty = hasNonAscii(b.descripcion) ? 1 : 0;
      return aDirty - bDirty;
    });

    dupGroups.push({
      banco: sorted[0].banco,
      fecha: sorted[0].fecha,
      descripcion: normalizeDesc(sorted[0].descripcion) || sorted[0].descripcion || "",
      debito: sorted[0].debito,
      credito: sorted[0].credito,
      moneda: sorted[0].moneda,
      ids: sorted.map(r => r.id),
      dirty: sorted.map(r => hasNonAscii(r.descripcion)),
      count: sorted.length,
    });
  }

  dupGroups.sort((a, b) => a.banco.localeCompare(b.banco) || a.fecha.localeCompare(b.fecha));

  return NextResponse.json({
    groups: dupGroups,
    total: dupGroups.reduce((s, g) => s + g.count - 1, 0),
  });
}
