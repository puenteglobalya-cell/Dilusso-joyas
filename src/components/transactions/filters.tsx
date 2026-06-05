"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { MESES, BANCOS } from "@/lib/utils";

export function TransactionFilters() {
  const router = useRouter();
  const sp = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`?${params.toString()}`);
  }

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="flex flex-wrap gap-3 mb-4">
      <select
        value={sp.get("año") ?? String(currentYear)}
        onChange={(e) => update("año", e.target.value)}
        className="text-sm border rounded-md px-3 py-1.5 bg-white"
      >
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      <select
        value={sp.get("mes") ?? ""}
        onChange={(e) => update("mes", e.target.value)}
        className="text-sm border rounded-md px-3 py-1.5 bg-white"
      >
        <option value="">Todos los meses</option>
        {MESES.map((m, i) => (
          <option key={i + 1} value={i + 1}>{m}</option>
        ))}
      </select>

      <select
        value={sp.get("tipo") ?? ""}
        onChange={(e) => update("tipo", e.target.value)}
        className="text-sm border rounded-md px-3 py-1.5 bg-white"
      >
        <option value="">Negocio + Personal</option>
        <option value="negocio">Negocio</option>
        <option value="personal">Personal</option>
      </select>

      <select
        value={sp.get("banco") ?? ""}
        onChange={(e) => update("banco", e.target.value)}
        className="text-sm border rounded-md px-3 py-1.5 bg-white"
      >
        <option value="">Todos los bancos</option>
        {BANCOS.map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>
    </div>
  );
}
