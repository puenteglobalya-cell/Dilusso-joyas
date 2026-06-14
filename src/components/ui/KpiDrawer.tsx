"use client";
import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { formatUYU } from "@/lib/utils";

export interface KpiDetail {
  label: string;
  value: number;
  sub?: string;
  pct?: number;
}

interface Props {
  title: string;
  value: string;
  valueColor?: string;
  valueClass?: string;
  detail?: KpiDetail[];
  detailTitle?: string;
  href?: string;
  className?: string;
}

export function KpiCard({ title, value, valueColor, valueClass, detail, detailTitle, href, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const hasDetail = detail && detail.length > 0;
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const card = (
    <div
      className={`bg-white rounded-2xl p-4 transition-all ${hasDetail ? "cursor-pointer" : ""} ${className}`}
      style={{
        border: "1px solid #E6E1DA",
        borderLeft: "4px solid #C5A059",
        boxShadow: "0 1px 3px 0 rgba(0,0,0,0.04)",
      }}
      onClick={hasDetail ? () => setOpen(true) : undefined}
      title={hasDetail ? `Ver detalle de ${title}` : undefined}
      onMouseEnter={e => { if (hasDetail) (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px 0 rgba(197,160,89,0.12)"; }}
      onMouseLeave={e => { if (hasDetail) (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px 0 rgba(0,0,0,0.04)"; }}
    >
      <p className="text-xs font-medium mb-1 uppercase tracking-wide" style={{ color: "#8C857B" }}>{title}</p>
      <p className={`text-lg font-bold ${valueClass ?? ""}`} style={valueColor ? { color: valueColor } : undefined}>{value}</p>
      {hasDetail && <p className="text-[10px] mt-1 font-medium" style={{ color: "#C5A059", opacity: 0.8 }}>Ver detalle →</p>}
    </div>
  );

  if (href && !hasDetail) {
    return <a href={href} className="block hover:scale-[1.02] transition-transform">{card}</a>;
  }

  return (
    <>
      {card}

      {open && (
        <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[1px]" onClick={() => setOpen(false)} />
      )}

      <div
        ref={drawerRef}
        className={`fixed top-0 right-0 h-full w-[380px] max-w-full bg-white shadow-2xl z-50 flex flex-col
          transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #E6E1DA" }}>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#8C857B" }}>{title}</p>
            <p className={`text-2xl font-bold mt-0.5 ${valueClass ?? ""}`} style={valueColor ? { color: valueColor } : undefined}>{value}</p>
          </div>
          <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg transition-colors" style={{ background: "#F5F0E8" }}>
            <X className="w-4 h-4" style={{ color: "#8C857B" }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {detailTitle && <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#8C857B" }}>{detailTitle}</p>}
          {detail && detail.length > 0 && (() => {
            const total = detail.reduce((s, d) => s + d.value, 0);
            return (
              <div className="space-y-2">
                {detail.map((d, i) => {
                  const pct = d.pct ?? (total > 0 ? Math.round((d.value / total) * 1000) / 10 : 0);
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-sm mb-0.5">
                        <span className="font-medium truncate pr-2 flex-1" style={{ color: "#2E2B2A" }}>{d.label}</span>
                        <span className="tabular-nums shrink-0" style={{ color: "#946E61" }}>{formatUYU(d.value)}</span>
                      </div>
                      {d.sub && <p className="text-xs mb-1" style={{ color: "#8C857B" }}>{d.sub}</p>}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#F5F0E8" }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: "#C5A059" }} />
                        </div>
                        <span className="text-[11px] w-10 text-right tabular-nums" style={{ color: "#8C857B" }}>{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
    </>
  );
}
