"use client";
import { useState } from "react";
import { Upload, CheckCircle, AlertCircle, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

interface ImportResult {
  ok: boolean;
  inserted: number;
  total: number;
  anomalias: { hoja: string; fila: number; valor: string; motivo?: string }[];
  noParseadas: { hoja: string; fila: number; valor: string; motivo?: string }[];
  insertError?: string;
}

export function CajaDiariaUpload() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function handleImport() {
    if (!file) return;
    setLoading(true); setError(null); setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/admin/import-caja-diaria", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al importar");
      setResult(data);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-lg border border-gray-200 bg-white hover:bg-surface"
      >
        <Upload className="w-3.5 h-3.5" />
        Subir control de caja diaria
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl border p-5 mb-6 max-w-xl">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">Subir control de caja diaria</h2>
        <button onClick={() => setOpen(false)} className="text-xs text-subtle hover:text-ink">Cerrar</button>
      </div>
      <p className="text-xs text-muted mb-3">
        Subí el Excel exportado de la planilla &quot;Controles de Caja Diaria&quot; (una hoja por mes). Esto
        <strong> reemplaza por completo</strong> los datos actuales de Liquidaciones — subí siempre el archivo completo, no solo la hoja nueva.
      </p>

      <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:bg-surface mb-3">
        {file ? (
          <div className="text-center px-3">
            <p className="text-sm font-medium text-ink truncate max-w-[280px]">{file.name}</p>
            <p className="text-xs text-subtle mt-0.5">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
          </div>
        ) : (
          <div className="text-center">
            <Upload className="w-4 h-4 text-subtle mx-auto mb-1" />
            <p className="text-xs text-muted">Seleccionar archivo (.xlsx)</p>
          </div>
        )}
        <input type="file" className="hidden" accept=".xlsx,.xls" onChange={e => setFile(e.target.files?.[0] ?? null)} />
      </label>

      <button
        onClick={handleImport}
        disabled={!file || loading}
        className="w-full h-9 bg-brand hover:bg-brand-dark text-white text-sm font-semibold rounded-lg disabled:opacity-50"
      >
        {loading ? "Importando…" : "Importar y reemplazar"}
      </button>

      {error && (
        <div className="bg-terracotta/10 border border-terracotta/30 rounded-lg p-3 flex gap-2 mt-3">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-3 space-y-2">
          <div className="bg-olive/10 border border-olive/30 rounded-lg p-3 flex gap-2 items-center">
            <CheckCircle className="w-4 h-4 text-olive shrink-0" />
            <p className="text-sm text-olive font-medium">{result.inserted} de {result.total} períodos importados</p>
          </div>

          {result.anomalias.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex gap-2 items-center mb-1">
                <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0" />
                <p className="text-sm font-medium text-yellow-800">
                  {result.anomalias.length} fila(s) con fecha inconsistente — NO se importaron, revisar en el archivo:
                </p>
              </div>
              <ul className="text-xs text-yellow-800 ml-6 space-y-0.5">
                {result.anomalias.map((a, i) => (
                  <li key={i}>{a.hoja}, fila {a.fila}: &quot;{a.valor}&quot;{a.motivo ? ` (${a.motivo})` : ""}</li>
                ))}
              </ul>
            </div>
          )}

          {result.noParseadas.length > 0 && (
            <div className="bg-surface border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-medium text-muted mb-1">{result.noParseadas.length} fila(s) omitidas (no son un período de venta):</p>
              <ul className="text-xs text-subtle ml-4 space-y-0.5">
                {result.noParseadas.map((a, i) => (
                  <li key={i}>{a.hoja}, fila {a.fila}: &quot;{a.valor}&quot;</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
