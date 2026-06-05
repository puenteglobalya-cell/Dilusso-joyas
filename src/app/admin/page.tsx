"use client";
import { useState } from "react";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";

export default function AdminPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/admin/import-excel", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-bold mb-2">Importar Excel maestro</h1>
      <p className="text-sm text-gray-500 mb-6">
        Importa <strong>Consolidado</strong> y <strong>Liquidaciones</strong> desde el Excel de Cecilia.
        Reemplaza todos los datos existentes.
      </p>

      <div className="bg-white rounded-xl border p-6 space-y-4">
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          {file ? (
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">{file.name}</p>
              <p className="text-xs text-gray-400 mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
          ) : (
            <div className="text-center">
              <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Seleccionar archivo Excel (.xlsx)</p>
            </div>
          )}
          <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>

        <button
          onClick={handleImport}
          disabled={!file || loading}
          className="w-full h-11 bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg transition-colors disabled:opacity-50 text-sm uppercase tracking-wider"
        >
          {loading ? "Importando... (puede tardar 1-2 min)" : "Importar datos"}
        </button>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            <p className="text-sm font-semibold text-green-800">Importación completada</p>
          </div>
          <ul className="text-sm text-green-700 space-y-1 ml-7">
            {result.transacciones != null && <li>✓ {String(result.transacciones)} transacciones importadas</li>}
            {result.liquidaciones != null && <li>✓ {String(result.liquidaciones)} liquidaciones importadas</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
