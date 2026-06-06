/**
 * POST /api/admin/match-transfers
 * Detecta transferencias entre cuentas propias:
 * busca pares de movimientos en distintos bancos con mismo monto y fecha próxima (±2 días)
 * y los marca como tipo="traspaso" / cat_negocio="Transferencia entre cuentas propias".
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

// Bancos/cuentas propios conocidos
const BANCOS_PROPIOS = ["BBVA", "Itaú", "OCA", "Scotiabank", "Itau-Card"];

export async function POST(_req: NextRequest) {
  const sb = createServerClient();

  // Traer todos los movimientos de cuentas propias sin clasificar como traspaso
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from("bank_statements") as any)
    .select("id, banco, fecha, moneda, debito, credito, descripcion, categoria_negocio")
    .in("banco", BANCOS_PROPIOS)
    .neq("descripcion", "Saldo anterior");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type DbRow = {
    id: string; banco: string; fecha: string; moneda: string;
    debito: number | null; credito: number | null;
    descripcion: string | null; categoria_negocio: string | null;
  };

  const rows = (data ?? []) as DbRow[];

  // Agrupar por moneda para comparar solo dentro de la misma moneda
  const byMoneda: Record<string, DbRow[]> = {};
  for (const r of rows) {
    if (!byMoneda[r.moneda]) byMoneda[r.moneda] = [];
    byMoneda[r.moneda].push(r);
  }

  const toUpdate: string[] = [];

  for (const monedaRows of Object.values(byMoneda)) {
    for (let i = 0; i < monedaRows.length; i++) {
      const a = monedaRows[i];
      const aImporte = (a.credito ?? 0) - (a.debito ?? 0); // signed
      if (aImporte === 0) continue;

      for (let j = i + 1; j < monedaRows.length; j++) {
        const b = monedaRows[j];
        if (a.banco === b.banco) continue; // misma entidad → no es transferencia entre bancos distintos

        const bImporte = (b.credito ?? 0) - (b.debito ?? 0);

        // Un lado es salida (negativo) y el otro es entrada (positivo) con mismo monto absoluto
        if (Math.abs(aImporte + bImporte) > 1) continue; // no son espejo
        if (Math.abs(aImporte) < 1) continue; // monto despreciable

        // Fechas cercanas (±2 días)
        const dA = new Date(a.fecha).getTime();
        const dB = new Date(b.fecha).getTime();
        if (Math.abs(dA - dB) > 2 * 86400_000) continue;

        toUpdate.push(a.id, b.id);
      }
    }
  }

  const uniqueIds = [...new Set(toUpdate)];

  let updated = 0;
  const CHUNK = 100;
  for (let i = 0; i < uniqueIds.length; i += CHUNK) {
    const chunk = uniqueIds.slice(i, i + CHUNK);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upErr } = await (sb.from("bank_statements") as any)
      .update({
        tipo: "traspaso",
        categoria_negocio: "Transferencia entre cuentas propias",
        categoria_personal: "",
        clasificado: "Si",
      })
      .in("id", chunk);
    if (!upErr) updated += chunk.length;
  }

  return NextResponse.json({ ok: true, pares: uniqueIds.length / 2, updated });
}
