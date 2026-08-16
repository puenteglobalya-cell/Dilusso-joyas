"use client";
import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";

type Semaforo = "verde" | "amarillo" | "rojo" | "sin_datos";

type CockpitData = {
  luz_1_liquidez: {
    saldo_total_uyu: number;
    costo_fijo_diario_uyu: number;
    dias_cobertura: number | null;
    semaforo: Semaforo;
    saldos_por_cuenta: { banco: string; cuenta: string | null; moneda: string; saldo: number; saldo_uyu: number; fecha: string }[];
  };
  luz_6_punto_equilibrio: {
    ventas_mes_actual_uyu: number;
    meta_acumulada_a_hoy_uyu: number;
    pct_cumplimiento: number | null;
    semaforo: Semaforo;
  };
  contexto: { costo_fijo_mensual_promedio_uyu: number; meses_analizados: number; tc_actual: number | null };
  no_disponible: { luz: string; motivo: string }[];
};

const SEMAFORO_COLOR: Record<Semaforo, string> = {
  verde: "bg-olive/10 border-olive/40 text-green-800",
  amarillo: "bg-yellow-50 border-yellow-300 text-yellow-800",
  rojo: "bg-terracotta/10 border-terracotta/40 text-red-700",
  sin_datos: "bg-surface border-gray-200 text-subtle",
};
const SEMAFORO_DOT: Record<Semaforo, string> = {
  verde: "bg-green-500",
  amarillo: "bg-yellow-400",
  rojo: "bg-red-500",
  sin_datos: "bg-gray-300",
};

function money(n: number) {
  return n.toLocaleString("es-UY", { style: "currency", currency: "UYU", maximumFractionDigits: 0 });
}

export function IndicadoresPanel() {
  const [data, setData] = useState<CockpitData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cockpit");
      const d = await res.json();
      setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!data) return <p className="text-sm text-muted">Cargando…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Indicadores de gestión</h2>
        <button onClick={load} disabled={loading} className="flex items-center gap-1 text-xs text-muted hover:text-ink">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className={`rounded-xl border p-5 ${SEMAFORO_COLOR[data.luz_1_liquidez.semaforo]}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-3 h-3 rounded-full ${SEMAFORO_DOT[data.luz_1_liquidez.semaforo]}`} />
            <h3 className="text-sm font-semibold">Luz 1 — Liquidez operativa</h3>
          </div>
          <p className="text-2xl font-bold">
            {data.luz_1_liquidez.dias_cobertura != null ? `${data.luz_1_liquidez.dias_cobertura} días` : "—"}
          </p>
          <p className="text-xs mt-1 opacity-80">de cobertura de costos fijos con el saldo actual</p>
          <div className="text-xs mt-3 space-y-0.5 opacity-90">
            <p>Saldo total: {money(data.luz_1_liquidez.saldo_total_uyu)}</p>
            <p>Costo fijo diario: {money(data.luz_1_liquidez.costo_fijo_diario_uyu)}</p>
          </div>
        </div>

        <div className={`rounded-xl border p-5 ${SEMAFORO_COLOR[data.luz_6_punto_equilibrio.semaforo]}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-3 h-3 rounded-full ${SEMAFORO_DOT[data.luz_6_punto_equilibrio.semaforo]}`} />
            <h3 className="text-sm font-semibold">Luz 6 — Punto de equilibrio (mes en curso)</h3>
          </div>
          <p className="text-2xl font-bold">
            {data.luz_6_punto_equilibrio.pct_cumplimiento != null ? `${data.luz_6_punto_equilibrio.pct_cumplimiento}%` : "—"}
          </p>
          <p className="text-xs mt-1 opacity-80">de la meta acumulada a hoy para cubrir costos fijos</p>
          <div className="text-xs mt-3 space-y-0.5 opacity-90">
            <p>Ventas del mes: {money(data.luz_6_punto_equilibrio.ventas_mes_actual_uyu)}</p>
            <p>Meta acumulada a hoy: {money(data.luz_6_punto_equilibrio.meta_acumulada_a_hoy_uyu)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-4">
        <p className="text-xs text-subtle">
          Costo fijo mensual promedio ({data.contexto.meses_analizados} meses analizados): <span className="font-medium text-ink">{money(data.contexto.costo_fijo_mensual_promedio_uyu)}</span>
          {data.contexto.tc_actual != null && <> · TC actual: <span className="font-medium text-ink">${data.contexto.tc_actual}</span></>}
        </p>
      </div>

      {data.luz_1_liquidez.saldos_por_cuenta.length > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <h3 className="text-sm font-semibold mb-3">Saldos por cuenta (último conocido)</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-subtle border-b">
                <th className="pb-2 font-medium">Cuenta</th>
                <th className="pb-2 font-medium text-right">Saldo</th>
                <th className="pb-2 font-medium text-right">En UYU</th>
                <th className="pb-2 font-medium text-right">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {data.luz_1_liquidez.saldos_por_cuenta.map((s, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-1.5">{s.banco} {s.cuenta ? `(${s.cuenta})` : ""} — {s.moneda}</td>
                  <td className="py-1.5 text-right">{s.saldo.toLocaleString("es-UY")}</td>
                  <td className="py-1.5 text-right">{money(s.saldo_uyu)}</td>
                  <td className="py-1.5 text-right text-subtle">{s.fecha}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.no_disponible.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-4 bg-surface">
          <p className="text-xs font-medium text-muted mb-2">Luces todavía no disponibles</p>
          {data.no_disponible.map((n, i) => (
            <p key={i} className="text-xs text-subtle mb-1">
              <span className="font-medium">{n.luz}:</span> {n.motivo}
            </p>
          ))}
          <p className="text-xs text-subtle mt-2">
            Luz 4 (stock inmovilizado) y Luz 5 (integridad ERP) están disponibles en la pestaña <span className="font-medium">Productos</span>.
          </p>
        </div>
      )}
    </div>
  );
}
