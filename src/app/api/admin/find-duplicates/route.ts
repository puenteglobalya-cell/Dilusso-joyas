import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

export interface DupGroup {
  banco: string;
  fecha: string;
  descripcion: string;
  debito: number | null;
  credito: number | null;
  moneda: string;
  ids: string[];
  count: number;
}

export async function GET() {
  const sb = createServerClient();

  // Paginate all rows
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const PAGE = 1000;
  type Row = { id: string; banco: string; fecha: string; descripcion: string | null; debito: number | null; credito: number | null; moneda: string };
  let all: Row[] = [];
  let from = 0;
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from("bank_statements") as any)
      .select("id,banco,fecha,descripcion,debito,credito,moneda")
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all = all.concat(data as Row[]);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // Normalize description: trim + remove non-ASCII (e.g. U+E9D7 from OCA PDFs)
  function norm(s: string | null): string {
    return (s ?? "").trim().replace(/[^\x00-\x7F]/g, "").trim();
  }

  // Group by (banco, fecha, moneda, normDesc, debito, credito)
  const groups = new Map<string, { rows: Row[]; normDesc: string }>();
  for (const row of all) {
    const nd = norm(row.descripcion);
    const key = `${row.banco}|${row.fecha}|${row.moneda}|${nd}|${row.debito ?? ""}|${row.credito ?? ""}`;
    if (!groups.has(key)) groups.set(key, { rows: [], normDesc: nd });
    groups.get(key)!.rows.push(row);
  }

  const dupGroups: DupGroup[] = [];
  for (const { rows, normDesc } of groups.values()) {
    if (rows.length < 2) continue;
    dupGroups.push({
      banco: rows[0].banco,
      fecha: rows[0].fecha,
      descripcion: normDesc || rows[0].descripcion || "",
      debito: rows[0].debito,
      credito: rows[0].credito,
      moneda: rows[0].moneda,
      ids: rows.map(r => r.id),
      count: rows.length,
    });
  }

  dupGroups.sort((a, b) => a.banco.localeCompare(b.banco) || a.fecha.localeCompare(b.fecha));

  return NextResponse.json({ groups: dupGroups, total: dupGroups.reduce((s, g) => s + g.count - 1, 0) });
}
