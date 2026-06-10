"use client";
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";

interface DataPoint {
  label: string;
  negocio: number;
  personal: number;
  ingresos: number;
}

function fmt(v: number) {
  return new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU", maximumFractionDigits: 0 }).format(v);
}

export function DashboardChart({ data }: { data: DataPoint[] }) {
  if (!data.length) {
    return <p className="text-sm text-slate-400 text-center py-8">Sin datos aún</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
        <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 2" />
        <Tooltip formatter={(value) => fmt(Number(value))} />
        <Legend />
        <Bar dataKey="ingresos" name="Ingresos negocio" fill="#22c55e" opacity={0.85} radius={[4, 4, 0, 0]} />
        <Bar dataKey="negocio" name="Gastos negocio" fill="#1e293b" opacity={0.85} radius={[4, 4, 0, 0]} />
        <Bar dataKey="personal" name="Gastos personales" fill="#94a3b8" opacity={0.85} radius={[4, 4, 0, 0]} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
