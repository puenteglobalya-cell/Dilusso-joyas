"use client";
import { useState, useCallback } from "react";
import { NegocioHeatmap } from "@/components/negocio/heatmap";
import { NegocioChart } from "@/components/negocio/chart";
import { CategoryDrawer, type DrilldownTarget } from "@/components/CategoryDrawer";

interface HeatmapProps {
  cats: string[];
  months: string[];
  data: Record<string, Record<string, number>>;
  tipo: "negocio" | "personal";
}

interface ChartProps {
  data: { name: string; value: number }[];
  tipo: "negocio" | "personal";
}

export function DrillableHeatmap({ cats, months, data, tipo }: HeatmapProps) {
  const [target, setTarget] = useState<DrilldownTarget | null>(null);
  const open = useCallback((cat: string, mes?: string) => setTarget({ tipo, categoria: cat, mes }), [tipo]);
  const close = useCallback(() => setTarget(null), []);
  return (
    <>
      <NegocioHeatmap cats={cats} months={months} data={data} onCellClick={open} />
      <CategoryDrawer target={target} onClose={close} />
    </>
  );
}

export function DrillableChart({ data, tipo }: ChartProps) {
  const [target, setTarget] = useState<DrilldownTarget | null>(null);
  const open = useCallback((cat: string) => setTarget({ tipo, categoria: cat }), [tipo]);
  const close = useCallback(() => setTarget(null), []);
  return (
    <>
      <NegocioChart data={data} onBarClick={open} />
      <CategoryDrawer target={target} onClose={close} />
    </>
  );
}
