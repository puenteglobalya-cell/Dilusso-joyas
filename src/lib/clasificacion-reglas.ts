/**
 * Motor de clasificación por reglas.
 * Evalúa una fila de bank_statements contra todas las reglas activas
 * y devuelve la primera que coincide.
 */
import { createServerClient } from "./supabase";

export interface Regla {
  id: string;
  activa: boolean;
  keyword: string | null;
  banco: string | null;
  importe_min: number | null;
  importe_max: number | null;
  dia_mes_min: number | null;
  dia_mes_max: number | null;
  moneda: string | null;
  tipo: "negocio" | "personal";
  categoria_negocio: string | null;
  categoria_personal: string | null;
  descripcion_regla: string | null;
  factura_id: string | null;
}

export interface BankRow {
  id: string;
  banco: string;
  fecha: string;
  descripcion: string | null;
  debito: number | null;
  moneda: string;
}

export function evaluarRegla(regla: Regla, row: BankRow): boolean {
  const debito = row.debito ?? 0;
  const dia = parseInt(row.fecha.split("-")[2]);
  const desc = (row.descripcion ?? "").toLowerCase();

  if (regla.moneda && regla.moneda !== row.moneda) return false;
  if (regla.banco && regla.banco !== row.banco) return false;
  if (regla.importe_min !== null && debito < regla.importe_min) return false;
  if (regla.importe_max !== null && debito > regla.importe_max) return false;
  if (regla.dia_mes_min !== null && dia < regla.dia_mes_min) return false;
  if (regla.dia_mes_max !== null && dia > regla.dia_mes_max) return false;
  if (regla.keyword && !desc.includes(regla.keyword.toLowerCase())) return false;

  return true;
}

export async function aplicarReglasAMovimiento(rowId: string): Promise<{ aplicada: boolean; regla?: Regla }> {
  const sb = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row } = await (sb.from("bank_statements") as any)
    .select("id, banco, fecha, descripcion, debito, moneda, clasificado")
    .eq("id", rowId).single();

  if (!row || row.clasificado === "Si") return { aplicada: false };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: reglas } = await (sb.from("clasificacion_reglas") as any)
    .select("*").eq("activa", true).order("created_at", { ascending: true });

  for (const regla of (reglas ?? []) as Regla[]) {
    if (evaluarRegla(regla, row)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb.from("bank_statements") as any).update({
        tipo: regla.tipo,
        categoria_negocio: regla.categoria_negocio,
        categoria_personal: regla.categoria_personal,
        clasificado: "Si",
      }).eq("id", rowId);
      return { aplicada: true, regla };
    }
  }

  return { aplicada: false };
}
