"use client";
import { CheckCircle, AlertCircle } from "lucide-react";

export function StatusBox({ result, error }: { result: Record<string, unknown> | null; error: string | null }) {
  if (error) return (
    <div className="bg-terracotta/10 border border-terracotta/30 rounded-lg p-3 flex gap-2">
      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
      <p className="text-sm text-red-700">{error}</p>
    </div>
  );
  if (result) return (
    <div className="bg-olive/10 border border-olive/30 rounded-lg p-3">
      <div className="flex gap-2 items-center mb-1">
        <CheckCircle className="w-4 h-4 text-olive shrink-0" />
        <p className="text-sm font-semibold text-green-800">Completado</p>
      </div>
      <ul className="text-sm text-olive space-y-0.5 ml-6">
        {result.transacciones != null && <li>✓ {String(result.transacciones)} transacciones del Consolidado</li>}
        {result.liquidaciones != null && <li>✓ {String(result.liquidaciones)} liquidaciones</li>}
        {result.deleted != null && <li>✓ {String(result.deleted)} movimientos eliminados</li>}
        {result.inserted != null && <li>✓ {String(result.inserted)} movimientos nuevos insertados</li>}
        {result.skipped != null && Number(result.skipped) > 0 && <li className="text-ink">— {String(result.skipped)} ya existían (omitidos)</li>}
        {result.warning != null && <li className="text-yellow-700">⚠ {String(result.warning)}</li>}
      </ul>
    </div>
  );
  return null;
}
