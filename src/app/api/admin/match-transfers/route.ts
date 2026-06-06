/**
 * POST /api/admin/match-transfers
 * Detecta transferencias entre cuentas propias.
 * Dos movimientos hacen par si:
 *   - Distinto banco
 *   - Fecha ±2 días
 *   - Un lado es salida, el otro es entrada
 *   - Misma moneda con monto igual (tolerancia $1), O
 *     Distinta moneda con montos equivalentes al TC ±20%
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getTc } from "@/lib/tipo-cambio";

export const runtime = "nodejs";

const BANCOS_PROPIOS = ["BBVA", "Itaú", "OCA", "Scotiabank", "Itau-Card"];
const TOLERANCE_SAME = 0.01;   // 1% para misma moneda
const TOLERANCE_CROSS = 0.20;  // 20% para cruce de monedas

function toUYU(importe: number, moneda: string, fecha: string): number {
  if (moneda === "UYU") return importe;
  return importe * getTc(fecha);
}

function esPar(a: DbRow, b: DbRow): boolean {
  // Distinto banco
  if (a.banco === b.banco) return false;

  const aImp = (a.credito ?? 0) - (a.debito ?? 0); // signed
  const bImp = (b.credito ?? 0) - (b.debito ?? 0);

  if (Math.abs(aImp) < 0.01 || Math.abs(bImp) < 0.01) return false;

  // Deben ser opuestos en signo (uno entra, otro sale)
  if (aImp * bImp >= 0) return false;

  // Fecha ±2 días
  const dA = new Date(a.fecha).getTime();
  const dB = new Date(b.fecha).getTime();
  if (Math.abs(dA - dB) > 2 * 86_400_000) return false;

  const absA = Math.abs(aImp);
  const absB = Math.abs(bImp);

  if (a.moneda === b.moneda) {
    // Misma moneda: diferencia proporcional ≤ 1%
    const pct = Math.abs(absA - absB) / Math.max(absA, absB);
    return pct <= TOLERANCE_SAME;
  }

  // Distinta moneda: convertir ambos a UYU y verificar ±20%
  const aUYU = toUYU(absA, a.moneda, a.fecha);
  const bUYU = toUYU(absB, b.moneda, b.fecha);
  const pct = Math.abs(aUYU - bUYU) / Math.max(aUYU, bUYU);
  return pct <= TOLERANCE_CROSS;
}

type DbRow = {
  id: string; banco: string; fecha: string; moneda: string;
  debito: number | null; credito: number | null;
  descripcion: string | null;
};

export async function POST(_req: NextRequest) {
  const sb = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from("bank_statements") as any)
    .select("id, banco, fecha, moneda, debito, credito, descripcion")
    .in("banco", BANCOS_PROPIOS)
    .neq("descripcion", "Saldo anterior");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as DbRow[];

  // Indexar por fecha aproximada para reducir comparaciones O(n²) → solo ±2 días
  const byDate: Record<string, DbRow[]> = {};
  for (const r of rows) {
    const d = new Date(r.fecha);
    for (let delta = -2; delta <= 2; delta++) {
      const key = new Date(d.getTime() + delta * 86_400_000).toISOString().slice(0, 10);
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(r);
    }
  }

  const toUpdate = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const a = rows[i];
    const candidates = byDate[a.fecha] ?? [];
    for (const b of candidates) {
      if (b.id <= a.id) continue; // evitar comparar dos veces
      if (esPar(a, b)) {
        toUpdate.add(a.id);
        toUpdate.add(b.id);
      }
    }
  }

  const ids = [...toUpdate];
  let updated = 0;
  const CHUNK = 100;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
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

  return NextResponse.json({ ok: true, pares: ids.length / 2, updated });
}
