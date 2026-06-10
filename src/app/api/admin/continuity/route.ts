import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

const BANCOS = [
  { banco: "BBVA",       moneda: "UYU" as string | null, label: "BBVA UYU" },
  { banco: "BBVA",       moneda: "USD" as string | null, label: "BBVA USD" },
  { banco: "Itaú",       moneda: "UYU" as string | null, label: "Itaú UYU" },
  { banco: "Itaú",       moneda: "USD" as string | null, label: "Itaú USD" },
];

type Row = { fecha: string; descripcion: string | null; debito: number | null; credito: number | null; saldo: number | null; created_at: string | null };

interface GapInfo {
  fecha: string;
  esperado: number;
  recibido: number;
  diff: number;
}

function computeGaps(rows: Row[]): GapInfo[] {
  // Sort SA-first within same date
  const sorted = [...rows].sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
    const aIsSA = a.descripcion === "Saldo anterior" ? 0 : 1;
    const bIsSA = b.descripcion === "Saldo anterior" ? 0 : 1;
    if (aIsSA !== bIsSA) return aIsSA - bIsSA;
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });

  let running: number | null = null;
  const computed: (number | null)[] = sorted.map(row => {
    if (row.descripcion === "Saldo anterior") {
      running = row.saldo;
      return row.saldo;
    }
    if (running === null && row.saldo !== null) {
      running = row.saldo;
      return running;
    }
    if (running !== null) running = running - (row.debito ?? 0) + (row.credito ?? 0);
    return running;
  });

  const gaps: GapInfo[] = [];
  // carry: overstatement of the running total when the declared SA saldo
  // already includes same-date movements that sort after the SA row.
  let carry = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].descripcion !== "Saldo anterior") continue;
    let prevComputed: number | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (sorted[j].descripcion !== "Saldo anterior") { prevComputed = computed[j]; break; }
    }
    const declared = sorted[i].saldo;
    if (prevComputed === null || declared === null) { carry = 0; continue; }
    const adjusted = prevComputed - carry;
    carry = 0;
    if (Math.abs(declared - adjusted) > 1) {
      let sumSameDate = 0;
      for (let k = i + 1; k < sorted.length && sorted[k].fecha === sorted[i].fecha; k++) {
        if (sorted[k].descripcion === "Saldo anterior") break;
        sumSameDate += (sorted[k].credito ?? 0) - (sorted[k].debito ?? 0);
      }
      if (Math.abs(declared - (adjusted + sumSameDate)) <= 1) { carry = sumSameDate; continue; }
      gaps.push({ fecha: sorted[i].fecha, esperado: adjusted, recibido: declared, diff: declared - adjusted });
    }
  }
  return gaps;
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const sb = createServerClient();
  const PAGE = 1000;

  const results: { label: string; gaps: GapInfo[] }[] = [];

  for (const b of BANCOS) {
    let rows: Row[] = [];
    let from = 0;
    while (true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (sb.from("bank_statements") as any)
        .select("fecha,descripcion,debito,credito,saldo,created_at")
        .eq("banco", b.banco)
        .range(from, from + PAGE - 1);
      if (b.moneda) query = query.eq("moneda", b.moneda);
      const { data, error } = await query;
      if (error || !data || data.length === 0) break;
      rows = rows.concat(data as Row[]);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    results.push({ label: b.label, gaps: computeGaps(rows) });
  }

  return NextResponse.json({ results });
}
