"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BANCOS } from "@/lib/utils";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";

interface UploadResult {
  total: number;
  classified: number;
  unclassified: number;
  banco: string;
}

export default function UploadPage() {
  const [banco, setBanco] = useState<string>(BANCOS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("banco", banco);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al procesar");
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Upload de extractos</h1>
      <p className="text-sm text-slate-500 mb-6">
        Subí el extracto bancario mensual en formato Excel (.xlsx) o CSV.
      </p>

      <Card className="mb-6">
        <CardContent className="pt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Banco</label>
            <div className="flex flex-wrap gap-2">
              {BANCOS.map((b) => (
                <button
                  key={b}
                  onClick={() => setBanco(b)}
                  className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                    banco === b
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Archivo</label>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
              {file ? (
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">{file.name}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Arrastrá o hacé click para seleccionar</p>
                  <p className="text-xs text-slate-400 mt-1">.xlsx, .xls, .csv</p>
                </div>
              )}
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <Button
            onClick={handleUpload}
            disabled={!file || loading}
            className="w-full"
          >
            {loading ? "Procesando..." : "Subir y clasificar"}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado del procesamiento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{result.total}</p>
                <p className="text-xs text-slate-500 mt-1">Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{result.classified}</p>
                <p className="text-xs text-slate-500 mt-1">Clasificadas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{result.unclassified}</p>
                <p className="text-xs text-slate-500 mt-1">Sin clasificar</p>
              </div>
            </div>
            {result.unclassified > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                <p className="text-sm text-yellow-800">
                  Hay {result.unclassified} transacciones sin clasificar.{" "}
                  <a href="/sin-conciliar" className="underline font-medium">
                    Ir a revisar
                  </a>
                </p>
              </div>
            )}
            {result.unclassified === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <p className="text-sm text-green-800">Todo clasificado correctamente.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
