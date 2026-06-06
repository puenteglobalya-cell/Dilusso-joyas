/** Tipo de cambio USD/UYU por mes. Actualizar con valores de investing.com */

const TC_POR_MES: Record<string, number> = {
  "2025-01": 42.42,
  "2025-02": 42.37,
  "2025-03": 41.97,
  "2025-04": 41.59,
  "2025-05": 41.32,
  "2025-06": 40.68,
  "2025-07": 40.50,
  "2025-08": 39.91,
  "2025-09": 39.43,
  "2025-10": 39.44,
  "2025-11": 39.56,
  "2025-12": 39.70,
  "2026-01": 41.50,
  "2026-02": 41.50,
  "2026-03": 41.50,
  "2026-04": 41.50,
  "2026-05": 41.50,
  "2026-06": 41.50,
};

export const TC_DEFAULT = 41.50;

/** Retorna el TC para una fecha YYYY-MM-DD */
export function getTc(fecha: string): number {
  const mes = fecha.slice(0, 7); // "YYYY-MM"
  return TC_POR_MES[mes] ?? TC_DEFAULT;
}

/** Agrega o actualiza un TC para un mes */
export function setTc(mes: string, tc: number) {
  TC_POR_MES[mes] = tc;
}
