"use client";
import { useState, useEffect, type ReactNode } from "react";
import { Upload, CheckCircle, AlertCircle, ChevronDown, Trash2, RefreshCw } from "lucide-react";

const BANKS = [
  { value: "bbva-xls", label: "BBVA — Excel (.xls/.xlsx)", accept: ".xls,.xlsx" },
  { value: "itau-xls", label: "Itaú — Excel (.xls/.xlsx)", accept: ".xls,.xlsx" },
  { value: "oca-pdf", label: "OCA — PDF (.pdf)", accept: ".pdf" },
  { value: "bbva-pdf", label: "BBVA — PDF (.pdf)", accept: ".pdf" },
  { value: "scotiabank-pdf", label: "Scotiabank — PDF (.pdf)", accept: ".pdf" },
  { value: "itau-card-pdf", label: "Itaú Tarjeta VISA — PDF (.pdf)", accept: ".pdf" },
];

function UploadCard({
  title,
  description,
  accept,
  onSubmit,
  loading,
  result,
  error,
  children,
}: {
  title: string;
  description: string;
  accept: string;
  onSubmit: (file: File) => void;
  loading: boolean;
  result: Record<string, unknown> | null;
  error: string | null;
  children?: ReactNode;
}) {
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="bg-white rounded-xl border p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>

      {children}

      <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
        {file ? (
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">{file.name}</p>
            <p className="text-xs text-gray-400 mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
          </div>
        ) : (
          <div className="text-center">
            <Upload className="w-5 h-5 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Seleccionar archivo</p>
            <p className="text-xs text-gray-400 mt-0.5">{accept.split(",").join(", ")}</p>
          </div>
        )}
        <input type="file" className="hidden" accept={accept} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>

      <button
        onClick={() => file && onSubmit(file)}
        disabled={!file || loading}
        className="w-full h-10 bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg transition-colors disabled:opacity-50 text-sm uppercase tracking-wider"
      >
        {loading ? "Importando…" : "Importar"}
      </button>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex gap-2 items-center mb-1">
            <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-sm font-semibold text-green-800">Completado</p>
          </div>
          <ul className="text-sm text-green-700 space-y-0.5 ml-6">
            {result.transacciones != null && <li>✓ {String(result.transacciones)} transacciones del Consolidado</li>}
            {result.liquidaciones != null && <li>✓ {String(result.liquidaciones)} liquidaciones</li>}
            {result.deleted != null && <li>✓ {String(result.deleted)} movimientos eliminados</li>}
            {result.inserted != null && <li>✓ {String(result.inserted)} movimientos nuevos insertados</li>}
            {result.skipped != null && Number(result.skipped) > 0 && <li className="text-gray-600">— {String(result.skipped)} ya existían (omitidos)</li>}
            {result.parsed != null && Number(result.parsed) === 0 && (
              <li className="text-yellow-700">⚠ No se encontraron movimientos en el archivo</li>
            )}
            {result.warning != null && <li className="text-yellow-700">⚠ {String(result.warning)}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function TcPanel() {
  const [mes, setMes] = useState("");
  const [tc, setTc] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleUpdateTc() {
    if (!mes || !tc) return;
    setLoading(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/update-tc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes, tc: parseFloat(tc) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setMsg(`✓ ${data.updated} movimientos USD actualizados para ${mes}`);
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : e}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Tipo de cambio USD/UYU</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Actualizá el TC mensual para recalcular el importe en UYU de movimientos en dólares.
        </p>
      </div>
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">Mes (YYYY-MM)</label>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="w-full h-9 border border-gray-200 rounded-lg px-3 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">TC (ej: 41.50)</label>
          <input
            type="number"
            step="0.01"
            value={tc}
            onChange={(e) => setTc(e.target.value)}
            placeholder="41.50"
            className="w-full h-9 border border-gray-200 rounded-lg px-3 text-sm"
          />
        </div>
        <button
          onClick={handleUpdateTc}
          disabled={loading || !mes || !tc}
          className="flex items-center gap-1.5 h-9 px-4 bg-brand text-white text-sm font-semibold rounded-lg disabled:opacity-50 hover:bg-brand-dark transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "…" : "Actualizar"}
        </button>
      </div>
      {msg && (
        <p className={`text-sm ${msg.startsWith("Error") ? "text-red-600" : "text-green-700"}`}>{msg}</p>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelResult, setExcelResult] = useState<Record<string, unknown> | null>(null);
  const [excelError, setExcelError] = useState<string | null>(null);

  const [bankLoading, setBankLoading] = useState(false);
  const [bankResult, setBankResult] = useState<Record<string, unknown> | null>(null);
  const [bankError, setBankError] = useState<string | null>(null);
  const [selectedBank, setSelectedBank] = useState(BANKS[0].value);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  useEffect(() => {
    fetch(`/api/admin/bank-months?banco=${selectedBank}`)
      .then((r) => r.json())
      .then((d) => { setAvailableMonths(d.months ?? []); setSelectedMonth(""); });
  }, [selectedBank]);

  async function handleExcel(file: File) {
    setExcelLoading(true);
    setExcelError(null);
    setExcelResult(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/admin/import-excel", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setExcelResult(data);
    } catch (e) {
      setExcelError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setExcelLoading(false);
    }
  }

  async function handleBank(file: File) {
    setBankLoading(true);
    setBankError(null);
    setBankResult(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("banco", selectedBank);
    try {
      const res = await fetch("/api/admin/import-bank", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setBankResult(data);
    } catch (e) {
      setBankError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setBankLoading(false);
    }
  }

  async function handleDeleteBank(mes?: string) {
    const label = BANKS.find(b => b.value === selectedBank)?.label ?? selectedBank;
    const what = mes ? `el mes ${mes} de ${label}` : `TODOS los datos de ${label}`;
    if (!confirm(`¿Borrar ${what}? Esta acción no se puede deshacer.`)) return;
    setDeleteLoading(true);
    setBankError(null);
    setBankResult(null);
    try {
      const res = await fetch("/api/admin/delete-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banco: selectedBank, mes: mes ?? null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setBankResult({ deleted: data.deleted });
      // Refresh available months
      fetch(`/api/admin/bank-months?banco=${selectedBank}`)
        .then((r) => r.json())
        .then((d) => { setAvailableMonths(d.months ?? []); setSelectedMonth(""); });
    } catch (e) {
      setBankError(e instanceof Error ? e.message : "Error");
    } finally {
      setDeleteLoading(false);
    }
  }

  const bankConfig = BANKS.find((b) => b.value === selectedBank) ?? BANKS[0];

  return (
    <div className="p-8 max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Importar datos</h1>
        <p className="text-sm text-gray-500 mt-1">Subí el Excel maestro o los extractos bancarios directamente.</p>
      </div>

      <UploadCard
        title="Excel maestro (Consolidado + Liquidaciones)"
        description="Importa el Excel de Cecilia con las hojas Consolidado y Liquidaciones. Reemplaza todos los datos."
        accept=".xlsx,.xls"
        onSubmit={handleExcel}
        loading={excelLoading}
        result={excelResult}
        error={excelError}
      />

      <UploadCard
        title="Extracto bancario"
        description="Importa movimientos de un banco. Los movimientos ya existentes se omiten automáticamente (acumulativo)."
        accept={bankConfig.accept}
        onSubmit={handleBank}
        loading={bankLoading}
        result={bankResult}
        error={bankError}
      >
        <div className="space-y-3">
          {/* Bank selector */}
          <div className="relative">
            <select
              value={selectedBank}
              onChange={(e) => setSelectedBank(e.target.value)}
              className="w-full h-10 pl-3 pr-8 border border-gray-200 rounded-lg text-sm bg-white appearance-none cursor-pointer"
            >
              {BANKS.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Delete section */}
          {availableMonths.length > 0 && (
            <div className="border border-red-100 rounded-lg p-3 space-y-2 bg-red-50/40">
              <p className="text-xs text-gray-500 font-medium">Borrar datos cargados</p>
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full h-8 pl-3 pr-8 border border-gray-200 rounded text-xs bg-white appearance-none cursor-pointer"
                  >
                    <option value="">— Seleccionar mes —</option>
                    {availableMonths.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-2 w-3 h-3 text-gray-400 pointer-events-none" />
                </div>
                <button
                  onClick={() => selectedMonth && handleDeleteBank(selectedMonth)}
                  disabled={deleteLoading || !selectedMonth}
                  className="flex items-center gap-1 text-xs px-3 h-8 border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-40 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  {deleteLoading ? "…" : "Borrar mes"}
                </button>
              </div>
              <button
                onClick={() => handleDeleteBank()}
                disabled={deleteLoading}
                className="text-xs text-red-400 hover:text-red-600 underline disabled:opacity-50"
              >
                Borrar todos los datos de este banco
              </button>
            </div>
          )}
        </div>
      </UploadCard>

      <TcPanel />
    </div>
  );
}
