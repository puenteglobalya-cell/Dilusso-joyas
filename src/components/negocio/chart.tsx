"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useState } from "react";

interface DataPoint { name: string; value: number }

interface Props {
  data: DataPoint[];
  onBarClick?: (cat: string) => void;
}

export function NegocioChart({ data, onBarClick }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <ResponsiveContainer width="100%" height={Math.max(240, data.length * 32)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onClick={onBarClick ? (e: any) => {
          const name = e?.activePayload?.[0]?.payload?.name as string | undefined;
          if (name) onBarClick(name);
        } : undefined}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
        <Tooltip formatter={(v) => new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU", maximumFractionDigits: 0 }).format(Number(v))} />
        <Bar dataKey="value" name="Gasto" radius={[0, 4, 4, 0]}
          cursor={onBarClick ? "pointer" : undefined}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onMouseEnter={(d: any) => setHovered(d.name ?? null)}
          onMouseLeave={() => setHovered(null)}
        >
          {data.map(d => (
            <Cell key={d.name} fill={hovered === d.name ? "#3b82f6" : "#1e293b"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
