"use client";
import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { formatUYU } from "@/lib/utils";

export interface KpiDetail {
  label: string;
  value: number;
  sub?: string;   // optional sub-label (e.g. month)
  pct?: number;   // optional % of total
}

interface Props {
  title: string;
  value: string;
  valueClass?: string;
  detail?: KpiDetail[];
  detailTitle?: string;
  href?: string;
  className?: string;
}

export function KpiCard({ title, value, valueClass, detail, detailTitle, href, className = "" }: Props) {
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
      style={{ border: "1px solid #ede9e4", boxShadow: hasDetail ? undefined : "0 1px 3px 0 rgba(0,0,0,0.04)" }}
      onClick={hasDetail ? () => setOpen(true) : undefined}
      title={hasDetail ? `Ver detalle de ${title}` : undefined}
      onMouseEnter={e => { if (hasDetail) (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px 0 rgba(0,0,0,0.08)"; }}
      onMouseLeave={e => { if (hasDetail) (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px 0 rgba(0,0,0,0.04)"; }}
    >
      <p className="text-xs font-medium mb-1" style={{ color: "#9c8a7e" }}>{title}</p>
      <p className={`text-lg font-bold ${valueClass ?? ""}`}>{value}</p>
      {hasDetail && <p className="text-[10px] mt-1" style={{ color: "#C8102E", opacity: 0.7 }}>Ver detalle →</p>}
    </div>
  );

  if (href && !hasDetail) {
    return <a href={href} className="block hover:scale-[1.02] transition-transform">{card}</a>;
  }

  return (
    <>
      {card}

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-over drawer */}
      <div
        ref={drawerRef}
        className={`fixed top-0 right-0 h-full w-[380px] max-w-full bg-white shadow-2xl z-50 flex flex-col
          transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{title}</p>
            <p className={`text-2xl font-bold mt-0.5 ${valueClass ?? ""}`}>{value}</p>
          </div>
          <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {detailTitle && <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">{detailTitle}</p>}
          {detail && detail.length > 0 && (() => {
            const total = detail.reduce((s, d) => s + d.value, 0);
            return (
              <div className="space-y-2">
                {detail.map((d, i) => {
                  const pct = d.pct ?? (total > 0 ? Math.round((d.value / total) * 1000) / 10 : 0);
                  return (
                    <div key={i} className="group">
                      <div className="flex items-center justify-between text-sm mb-0.5">
                        <span className="font-medium text-gray-800 truncate pr-2 flex-1">{d.label}</span>
                        <span className="text-gray-600 tabular-nums shrink-0">{formatUYU(d.value)}</span>
                      </div>
                      {d.sub && <p className="text-xs text-gray-400 mb-1">{d.sub}</p>}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand rounded-full transition-all"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-gray-400 w-10 text-right tabular-nums">{pct.toFixed(1)}%</span>
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
