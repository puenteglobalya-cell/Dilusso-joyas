"use client";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

const CURRENT_YEAR = new Date().getFullYear();
// Mostrar desde 2024 hasta el año actual
const YEARS = Array.from({ length: CURRENT_YEAR - 2023 }, (_, i) => CURRENT_YEAR - i);

export function PeriodToggle() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const current = searchParams.get("periodo") ?? "12m";
  const currentAño = searchParams.get("año") ? parseInt(searchParams.get("año")!) : CURRENT_YEAR;

  function selectPeriodo(val: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("mes");
    params.delete("año");
    if (val === "12m") {
      params.delete("periodo");
    } else {
      params.set("periodo", val);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function selectAño(año: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("mes");
    params.set("periodo", "año");
    params.set("año", String(año));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Toggle últimos 12m */}
      <div className="inline-flex rounded-xl overflow-hidden" style={{ border: "1px solid #E6E1DA", background: "#FCFBFA" }}>
        <button
          onClick={() => selectPeriodo("12m")}
          className="px-3 py-1.5 text-xs font-medium transition-colors"
          style={{
            background: current === "12m" ? "#C5A059" : "transparent",
            color: current === "12m" ? "#fff" : "#8C857B",
            cursor: "pointer",
          }}
        >
          Últimos 12m
        </button>
      </div>

      {/* Selector de año */}
      <div className="inline-flex rounded-xl overflow-hidden" style={{ border: "1px solid #E6E1DA", background: "#FCFBFA" }}>
        {YEARS.map(año => {
          const active = current === "año" && currentAño === año;
          return (
            <button
              key={año}
              onClick={() => selectAño(año)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: active ? "#C5A059" : "transparent",
                color: active ? "#fff" : "#8C857B",
                cursor: "pointer",
                borderLeft: año !== YEARS[YEARS.length - 1] ? "1px solid #E6E1DA" : undefined,
              }}
            >
              {año}
            </button>
          );
        })}
      </div>
    </div>
  );
}
