import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

const BANCOS = [
  { banco: "BBVA",       moneda: "UYU", label: "BBVA UYU" },
  { banco: "BBVA",       moneda: "USD", label: "BBVA USD" },
  { banco: "Itaú",       moneda: "UYU", label: "Itaú UYU" },
  { banco: "Itaú",       moneda: "USD", label: "Itaú USD" },
  { banco: "OCA",        moneda: null,  label: "OCA" },
  { banco: "Scotiabank", moneda: null,  label: "Scotiabank" },
  { banco: "Itau-Card",  moneda: null,  label: "Itaú Tarjeta" },
];

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const sb = createServerClient();

  // Supabase PostgREST has a server-side max_rows limit (typically 1000).
  // Paginate to collect all rows regardless of that limit.
  const PAGE = 1000;
  let rows: { banco: string; moneda: string; fecha: string; cuenta: string | null }[] = [];
  let from = 0;
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from("bank_statements") as any)
      .select("banco, moneda, fecha, cuenta")
      .order("fecha", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    rows = rows.concat(data as { banco: string; moneda: string; fecha: string; cuenta: string | null }[]);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // Build set of "banco|moneda|YYYY-MM" loaded
  const loaded = new Set(rows.map(r => `${r.banco}|${r.moneda}|${r.fecha.slice(0, 7)}`));

  // All months from earliest row to current month
  const allMonths: string[] = [];
  if (rows.length > 0) {
    const earliest = rows[0].fecha.slice(0, 7);
    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let cur = earliest;
    while (cur <= current) {
      allMonths.push(cur);
      const [y, m] = cur.split("-").map(Number);
      const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
      cur = next;
    }
  }

  const result = BANCOS.map(b => {
    const months = allMonths.map(ym => {
      const key = `${b.banco}|${b.moneda ?? ""}|${ym}`;
      const keyAny = rows.some(r => r.banco === b.banco && (b.moneda ? r.moneda === b.moneda : true) && r.fecha.slice(0, 7) === ym);
      return { ym, loaded: b.moneda ? loaded.has(key) : keyAny };
    });
    const cuentas = [...new Set(
      rows
        .filter(r => r.banco === b.banco && (b.moneda ? r.moneda === b.moneda : true) && r.cuenta)
        .map(r => r.cuenta as string)
    )].sort();
    return { label: b.label, months, cuentas };
  });

  return NextResponse.json({ months: allMonths, bancos: result });
}
