"use client";
import { formatUYU } from "@/lib/utils";

interface Grupo { label: string; valor: number; pct: number; meta?: number; color?: string }

interface Props {
  ingresos: number;
  gastosPorGrupo: Record<string, number>;
  ingresosPorGrupo: Record<string, number>;
  mesLabel: string;
}

function PctBar({ pct, meta, color = "#C5A059" }: { pct: number; meta?: number; color?: string }) {
  const over = meta !== undefined && pct > meta;
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#F5F0E8" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: over ? "#946E61" : color }} />
      </div>
      <span className="text-[11px] tabular-nums w-10 text-right font-medium" style={{ color: over ? "#946E61" : "#8C857B" }}>
        {pct.toFixed(1)}%
      </span>
      {meta !== undefined && (
        <span className="text-[10px]" style={{ color: "#A3907A" }}>/ {meta}%</span>
      )}
    </div>
  );
}

export function MetricasCecilia({ ingresos, gastosPorGrupo, ingresosPorGrupo, mesLabel }: Props) {
  const totalGastos = Object.values(gastosPorGrupo).reduce((s, v) => s + v, 0);
  const neto = ingresos - totalGastos;
  const retencion = ingresos > 0 ? (neto / ingresos) * 100 : 0;

  const ingresoTotal = ingresos + (ingresosPorGrupo["B. INGRESO PASIVO"] ?? 0) + (ingresosPorGrupo["C. INGRESO DE CARTERA"] ?? 0);

  const grupos: Grupo[] = [
    { label: "Hogar / Vivienda", valor: gastosPorGrupo["HOGAR"] ?? 0, pct: ingresoTotal > 0 ? ((gastosPorGrupo["HOGAR"] ?? 0) / ingresoTotal) * 100 : 0, meta: 33 },
    { label: "Alimentos", valor: gastosPorGrupo["ALIMENTOS"] ?? 0, pct: ingresoTotal > 0 ? ((gastosPorGrupo["ALIMENTOS"] ?? 0) / ingresoTotal) * 100 : 0 },
    { label: "Transporte", valor: gastosPorGrupo["TRANSPORTE"] ?? 0, pct: ingresoTotal > 0 ? ((gastosPorGrupo["TRANSPORTE"] ?? 0) / ingresoTotal) * 100 : 0 },
    { label: "Entretenimiento", valor: gastosPorGrupo["ENTRETENIMIENTO"] ?? 0, pct: ingresoTotal > 0 ? ((gastosPorGrupo["ENTRETENIMIENTO"] ?? 0) / ingresoTotal) * 100 : 0 },
    { label: "Vacaciones", valor: gastosPorGrupo["VACACIONES"] ?? 0, pct: ingresoTotal > 0 ? ((gastosPorGrupo["VACACIONES"] ?? 0) / ingresoTotal) * 100 : 0 },
    { label: "Salud", valor: gastosPorGrupo["SALUD"] ?? 0, pct: ingresoTotal > 0 ? ((gastosPorGrupo["SALUD"] ?? 0) / ingresoTotal) * 100 : 0 },
    { label: "Ropa", valor: gastosPorGrupo["ROPA"] ?? 0, pct: ingresoTotal > 0 ? ((gastosPorGrupo["ROPA"] ?? 0) / ingresoTotal) * 100 : 0 },
    { label: "Cuidado personal", valor: gastosPorGrupo["CUIDADO PERSONAL"] ?? 0, pct: ingresoTotal > 0 ? ((gastosPorGrupo["CUIDADO PERSONAL"] ?? 0) / ingresoTotal) * 100 : 0 },
    { label: "Educación / Hijos", valor: gastosPorGrupo["EDUCACION"] ?? 0, pct: ingresoTotal > 0 ? ((gastosPorGrupo["EDUCACION"] ?? 0) / ingresoTotal) * 100 : 0 },
    { label: "Seguros", valor: gastosPorGrupo["SEGUROS"] ?? 0, pct: ingresoTotal > 0 ? ((gastosPorGrupo["SEGUROS"] ?? 0) / ingresoTotal) * 100 : 0 },
    { label: "Servicios", valor: gastosPorGrupo["SERVICIOS"] ?? 0, pct: ingresoTotal > 0 ? ((gastosPorGrupo["SERVICIOS"] ?? 0) / ingresoTotal) * 100 : 0 },
    { label: "Impuestos", valor: gastosPorGrupo["IMPUESTOS"] ?? 0, pct: ingresoTotal > 0 ? ((gastosPorGrupo["IMPUESTOS"] ?? 0) / ingresoTotal) * 100 : 0 },
    { label: "Deudas repagadas", valor: gastosPorGrupo["DEUDAS"] ?? 0, pct: ingresoTotal > 0 ? ((gastosPorGrupo["DEUDAS"] ?? 0) / ingresoTotal) * 100 : 0 },
  ].filter(g => g.valor > 0);

  return (
    <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #E6E1DA", borderLeft: "4px solid #C5A059" }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8C857B" }}>Análisis · Cecilia</p>
          <p className="text-xs mt-0.5" style={{ color: "#A3907A" }}>{mesLabel}</p>
        </div>
      </div>

      {/* Retention KPI */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-xl p-3 col-span-1" style={{ background: retencion >= 20 ? "#EEF3EB" : "#F5EAE7" }}>
          <p className="text-[10px] font-medium mb-1" style={{ color: "#8C857B" }}>¿Cuánto retiene?</p>
          <p className="text-xl font-bold" style={{ color: retencion >= 20 ? "#586E50" : "#946E61" }}>{retencion.toFixed(1)}%</p>
          <p className="text-[10px] mt-0.5" style={{ color: "#A3907A" }}>del ingreso total</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: "#F5F0E8" }}>
          <p className="text-[10px] font-medium mb-1" style={{ color: "#8C857B" }}>Lo que entró</p>
          <p className="text-sm font-bold" style={{ color: "#586E50" }}>{formatUYU(ingresoTotal)}</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: "#F5F0E8" }}>
          <p className="text-[10px] font-medium mb-1" style={{ color: "#8C857B" }}>Te quedó</p>
          <p className="text-sm font-bold" style={{ color: neto >= 0 ? "#586E50" : "#946E61" }}>{formatUYU(neto)}</p>
        </div>
      </div>

      {/* Ingreso pasivo */}
      {(ingresosPorGrupo["B. INGRESO PASIVO"] ?? 0) > 0 && (
        <div className="rounded-xl px-3 py-2.5 mb-4 flex items-center justify-between" style={{ background: "#EEF3EB", border: "1px solid #D0DBC8" }}>
          <p className="text-xs" style={{ color: "#586E50" }}>Ingreso pasivo</p>
          <p className="text-sm font-semibold" style={{ color: "#586E50" }}>{formatUYU(ingresosPorGrupo["B. INGRESO PASIVO"])}</p>
        </div>
      )}

      {/* Groups breakdown */}
      <p className="text-[10px] uppercase tracking-wider mb-3" style={{ color: "#A3907A" }}>Gastos por grupo</p>
      <div className="space-y-3">
        {grupos.map(g => (
          <div key={g.label}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: "#2E2B2A" }}>{g.label}</span>
              <span className="text-xs tabular-nums font-medium" style={{ color: "#946E61" }}>{formatUYU(g.valor)}</span>
            </div>
            <PctBar pct={g.pct} meta={g.meta} />
          </div>
        ))}
      </div>
    </div>
  );
}
