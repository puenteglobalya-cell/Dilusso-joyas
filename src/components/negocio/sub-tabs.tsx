"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const SUBTABS = [
  { id: "", label: "Resumen" },
  { id: "productos", label: "Productos" },
  { id: "indicadores", label: "Indicadores" },
  { id: "segmentos", label: "Lado A / Lado B" },
];

export function NegocioSubTabs() {
  const searchParams = useSearchParams();
  const activeSub = searchParams.get("sub") ?? "";

  function hrefFor(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("sub", id); else params.delete("sub");
    const qs = params.toString();
    return qs ? `/negocio?${qs}` : "/negocio";
  }

  return (
    <div className="flex gap-1 border-b mb-6" style={{ borderColor: "#E6E1DA" }}>
      {SUBTABS.map(t => (
        <Link
          key={t.id}
          href={hrefFor(t.id)}
          className="px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors"
          style={activeSub === t.id
            ? { borderColor: "#C5A059", color: "#2E2B2A" }
            : { borderColor: "transparent", color: "#8C857B" }
          }
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
