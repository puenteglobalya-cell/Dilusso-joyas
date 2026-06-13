"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { formatUYU, formatDate } from "@/lib/utils";

interface Row {
  id: string;
  banco: string;
  fecha: string;
  descripcion: string | null;
  debito: number | null;
  credito: number | null;
  importe_uyu: number | null;
  moneda: string;
  nota: string | null;
}

export interface DrilldownTarget {
  tipo: "negocio" | "personal";
  categoria: string;
  mes?: string; // YYYY-MM
}

interface Props {
  target: DrilldownTarget | null;
  onClose: () => void;
}

const MES: Record<string, string> = {
  "01": "enero", "02": "febrero", "03": "marzo", "04": "abril",
  "05": "mayo", "06": "junio", "07": "julio", "08": "agosto",
  "09": "septiembre", "10": "octubre", "11": "noviembre", "12": "diciembre",
};

function fmtMes(ym: string) {
  const [y, m] = ym.split("-");
  return `${MES[m] ?? m} ${y}`;
}

export function CategoryDrawer({ target, onClose }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!target) return;
    setLoading(true);
    setRows([]);
    const params = new URLSearchParams({ tipo: target.tipo, categoria: target.categoria });
    if (target.mes) params.set("mes", target.mes);
    fetch(`/api/movimientos-categoria?${params}`)
      .then(r => r.json())
      .then(data => { setRows(Array.isArray(data) ? data : []); })
      .finally(() => setLoading(false));
  }, [target]);

  // Close on Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  if (!target) return null;

  const total = rows.reduce((s, r) => {
    if (r.moneda === "USD") return s + Math.abs(r.importe_uyu ?? 0);
    return s + (r.debito ?? 0) + (r.credito ?? 0);
  }, 0);

  const egresos = rows.filter(r => (r.debito ?? 0) > 0).reduce((s, r) => {
    if (r.moneda === "USD") return s + Math.abs(r.importe_uyu ?? 0);
    return s + (r.debito ?? 0);
  }, 0);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b bg-slate-50">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">
              {target.tipo} — {target.mes ? fmtMes(target.mes) : "período completo"}
            </p>
            <h2 className="text-lg font-bold text-slate-800">{target.categoria}</h2>
            {!loading && (
              <p className="text-sm text-slate-500 mt-0.5">
                {rows.length} movimiento{rows.length !== 1 ? "s" : ""} · total{" "}
                <span className="font-semibold text-red-600">{formatUYU(egresos || total)}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-200 transition-colors mt-0.5">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-16 text-slate-400 text-sm">Cargando…</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">Sin movimientos</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500">Fecha</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500">Banco</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500">Descripción</th>
                  <th className="text-right px-4 py-2.5 font-medium text-slate-500">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(r => {
                  const esDebito = (r.debito ?? 0) > 0;
                  const importe = r.moneda === "USD"
                    ? Math.abs(r.importe_uyu ?? 0)
                    : esDebito ? (r.debito ?? 0) : (r.credito ?? 0);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{formatDate(r.fecha)}</td>
                      <td className="px-4 py-2.5 font-medium whitespace-nowrap">{r.banco}</td>
                      <td className="px-4 py-2.5 text-slate-600 max-w-xs">
                        <span className="line-clamp-2">{r.descripcion ?? "—"}</span>
                        {r.nota && <span className="block text-xs text-slate-400 italic">{r.nota}</span>}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-medium whitespace-nowrap ${esDebito ? "text-red-600" : "text-green-600"}`}>
                        {esDebito ? "-" : "+"}{formatUYU(importe)}
                        {r.moneda === "USD" && (
                          <span className="block text-[10px] text-slate-400 font-normal">USD</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
