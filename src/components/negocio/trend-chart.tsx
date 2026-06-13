"use client";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";

export interface MonthMetrics {
  label: string;
  ingresos: number;
  egresos: number;
  resultado: number;
  margenNeto: number;
}

function fmt(v: number) {
  return new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU", maximumFractionDigits: 0 }).format(v);
}

export function NegocioTrendChart({ data }: { data: MonthMetrics[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(0)}%`} domain={[-100, 100]} />
        <ReferenceLine yAxisId="left" y={0} stroke="#94a3b8" strokeDasharray="4 2" />
        <Tooltip
          formatter={(value, name) => {
            if (name === "Margen neto") return [`${Number(value).toFixed(1)}%`, name];
            return [fmt(Number(value)), name];
          }}
        />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="left" dataKey="ingresos" name="Ingresos" fill="#0ea5e9" opacity={0.85} radius={[3, 3, 0, 0]} />
        <Bar yAxisId="left" dataKey="egresos" name="Egresos" fill="#fb7185" opacity={0.85} radius={[3, 3, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="margenNeto" name="Margen neto" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
