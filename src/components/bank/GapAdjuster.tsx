"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle, Wrench, X } from "lucide-react";
import { formatUYU } from "@/lib/utils";

export interface GapInfo {
  fecha: string;
  esperado: number;
  recibido: number;
  diff: number;
}

interface Props {
  gaps: GapInfo[];
  banco: string;
  moneda: string;
}

interface ModalState {
  gap: GapInfo;
  descripcion: string;
}

export function GapAdjuster({ gaps, banco, moneda }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const SMALL_THRESHOLD = 1000; // "chica" si la diferencia absoluta es < $1000

  async function doAdjust() {
    if (!modal) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/insert-adjustment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          banco,
          moneda,
          fecha: modal.gap.fecha,
          diff: modal.gap.diff,
          descripcion: modal.descripcion,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setSuccess(`Ajuste de ${formatUYU(Math.abs(modal.gap.diff))} insertado el ${data.fecha}.`);
      setModal(null);
      // Refresh server-rendered data
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  if (gaps.length === 0) {
    return (
      <div className="flex items-center gap-2 bg-olive/10 border border-olive/30 rounded-lg px-4 py-3 mb-6 text-sm text-olive">
        <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
        Continuidad de saldos OK — el saldo final de cada período coincide con el saldo inicial del siguiente
      </div>
    );
  }

  return (
    <>
      {success && (
        <div className="flex items-center gap-2 bg-olive/10 border border-olive/30 rounded-lg px-4 py-3 mb-3 text-sm text-olive">
          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
          {success}
        </div>
      )}

      <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 mb-6 text-sm text-orange-700 space-y-2">
        <div className="flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 text-orange-500 shrink-0" />
          {gaps.length} corte{gaps.length > 1 ? "s" : ""} de continuidad entre períodos
        </div>

        {gaps.map((g) => {
          const small = Math.abs(g.diff) < SMALL_THRESHOLD;
          return (
            <div key={g.fecha} className="ml-6 text-xs space-y-1">
              <p>
                <span className="font-medium">{g.fecha}:</span>{" "}
                saldo declarado {formatUYU(g.recibido)} ≠ saldo calculado del período anterior {formatUYU(g.esperado)}
                {" "}
                <span className={g.diff > 0 ? "text-olive font-medium" : "text-red-700 font-medium"}>
                  ({g.diff > 0 ? "+" : ""}{formatUYU(g.diff)})
                </span>
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-orange-600">
                  {g.diff > 0
                    ? `Faltan movimientos por ${formatUYU(g.diff)} — probablemente falta importar el extracto de ese período.`
                    : `Hay ${formatUYU(Math.abs(g.diff))} de más — posibles duplicados o extracto superpuesto.`}
                </p>
                {small && (
                  <button
                    onClick={() => setModal({ gap: g, descripcion: "Ajuste de redondeo" })}
                    className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-orange-200 hover:bg-orange-300 text-orange-900 shrink-0"
                  >
                    <Wrench className="w-3 h-3" />
                    Ajustar diferencia
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Wrench className="w-4 h-4" /> Ajustar diferencia
              </h3>
              <button onClick={() => { setModal(null); setError(null); }} className="text-subtle hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-surface rounded-lg p-3 text-xs space-y-1 text-ink">
              <p>Banco: <span className="font-semibold text-gray-800">{banco} — {moneda}</span></p>
              <p>Período que cierra: antes de <span className="font-semibold text-gray-800">{modal.gap.fecha}</span></p>
              <p>
                Diferencia:{" "}
                <span className={`font-semibold ${modal.gap.diff > 0 ? "text-olive" : "text-red-700"}`}>
                  {modal.gap.diff > 0 ? "+" : ""}{formatUYU(modal.gap.diff)}
                </span>
                {" "}→ se insertará como{" "}
                <span className="font-semibold text-gray-800">
                  {modal.gap.diff > 0 ? "crédito" : "débito"} de {formatUYU(Math.abs(modal.gap.diff))}
                </span>
              </p>
            </div>

            <div>
              <label className="text-xs text-muted mb-1 block">Descripción del ajuste</label>
              <input
                type="text"
                value={modal.descripcion}
                onChange={e => setModal({ ...modal, descripcion: e.target.value })}
                className="w-full h-9 border border-gray-200 rounded-lg px-3 text-sm"
                maxLength={200}
              />
            </div>

            {error && (
              <p className="text-sm text-terracotta flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={doAdjust}
                disabled={loading || !modal.descripcion.trim()}
                className="flex-1 h-10 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg text-sm disabled:opacity-50"
              >
                {loading ? "Insertando…" : "Confirmar ajuste"}
              </button>
              <button
                onClick={() => { setModal(null); setError(null); }}
                disabled={loading}
                className="flex-1 h-10 border text-ink font-semibold rounded-lg text-sm hover:bg-surface"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
