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
        <CartesianGrid strokeDasharray="3 3" stroke="#E6E1DA" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8C857B" }} />
        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#8C857B" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#8C857B" }} tickFormatter={(v) => `${v.toFixed(0)}%`} domain={[-100, 100]} />
        <ReferenceLine yAxisId="left" y={0} stroke="#E6E1DA" strokeDasharray="4 2" />
        <Tooltip
          contentStyle={{ border: "1px solid #E6E1DA", borderRadius: 12, background: "#fff", color: "#2E2B2A" }}
          formatter={(value, name) => {
            if (name === "Margen neto") return [`${Number(value).toFixed(1)}%`, name];
            return [fmt(Number(value)), name];
          }}
        />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 12, color: "#8C857B" }} />
        <Bar yAxisId="left" dataKey="ingresos" name="Lo que entró" fill="#586E50" opacity={0.85} radius={[3, 3, 0, 0]} />
        <Bar yAxisId="left" dataKey="egresos" name="Lo que se gastó" fill="#946E61" opacity={0.85} radius={[3, 3, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="margenNeto" name="Margen neto" stroke="#C5A059" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
