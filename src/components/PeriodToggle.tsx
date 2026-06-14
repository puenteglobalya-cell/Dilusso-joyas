"use client";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

export function PeriodToggle() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const current = searchParams.get("periodo") ?? "12m";

  function select(val: string) {
    const params = new URLSearchParams(searchParams.toString());
    // Remove mes/año filters when switching period mode
    params.delete("mes");
    params.delete("año");
    if (val === "12m") {
      params.delete("periodo");
    } else {
      params.set("periodo", val);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const options: { value: string; label: string }[] = [
    { value: "12m", label: "Últimos 12m" },
    { value: "año", label: "Año 2026" },
  ];

  return (
    <div className="inline-flex rounded-xl overflow-hidden" style={{ border: "1px solid #E6E1DA", background: "#FCFBFA" }}>
      {options.map(opt => {
        const active = current === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => select(opt.value)}
            className="px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: active ? "#C5A059" : "transparent",
              color: active ? "#fff" : "#8C857B",
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
