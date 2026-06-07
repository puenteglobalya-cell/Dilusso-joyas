import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

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
  const sb = createServerClient();
  // Fetch distinct banco+moneda+month combinations — avoids the 1000-row default limit
  // that caused 2026 months to appear missing when total rows exceeded 1000.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb.from("bank_statements") as any)
    .select("banco, moneda, fecha")
    .order("fecha", { ascending: true })
    .limit(100000);

  const rows = (data ?? []) as { banco: string; moneda: string; fecha: string }[];

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
    return { label: b.label, months };
  });

  return NextResponse.json({ months: allMonths, bancos: result });
}
