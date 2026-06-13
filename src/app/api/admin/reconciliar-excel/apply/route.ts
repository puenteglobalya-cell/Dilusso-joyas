import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import type { ReconcilRow } from "../route";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { matches }: { matches: ReconcilRow[] } = await req.json();
  if (!matches?.length) return NextResponse.json({ error: "No matches" }, { status: 400 });

  const sb = createServerClient();
  let updated = 0;
  const errors: string[] = [];

  const CHUNK = 100;
  for (let i = 0; i < matches.length; i += CHUNK) {
    const chunk = matches.slice(i, i + CHUNK);
    for (const m of chunk) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (sb.from("bank_statements") as any)
        .update({
          clasificado: "Si",
          tipo: m.tipo_propuesto,
          categoria_negocio:  m.cat_negocio  || null,
          categoria_personal: m.cat_personal || null,
        })
        .eq("id", m.id)
        .eq("clasificado", "No");
      if (error) errors.push(error.message);
      else updated++;
    }
  }

  return NextResponse.json({ ok: true, updated, errors: errors.length ? errors.slice(0, 5) : undefined });
}
