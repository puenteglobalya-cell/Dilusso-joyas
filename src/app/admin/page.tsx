"use client";
import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { Upload, CheckCircle, AlertCircle, ChevronDown, Trash2, RefreshCw, FolderUp, FileText, X } from "lucide-react";

const BANKS = [
  { value: "bbva-xls", label: "BBVA CC — Excel (detecta moneda del archivo)", accept: ".xls,.xlsx" },
  { value: "itau-xls", label: "Itaú — Excel (detecta moneda del archivo)", accept: ".xls,.xlsx" },
  { value: "oca-pdf",  label: "OCA — PDF", accept: ".pdf" },
  { value: "bbva-pdf", label: "BBVA — PDF", accept: ".pdf" },
  { value: "scotiabank-pdf",  label: "Scotiabank — PDF", accept: ".pdf" },
  { value: "itau-card-pdf",   label: "Itaú Tarjeta VISA — PDF", accept: ".pdf" },
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
  const [coverageKey, setCoverageKey] = useState(1);

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

      <BulkUploadPanel onImportDone={() => setCoverageKey(k => k + 1)} />
      <TcPanel />
      <TransferPanel />
      <CoveragePanel key={coverageKey} />
    </div>
  );
}

// ── Bulk Upload Panel ─────────────────────────────────────────────────────────

type FileState = {
  id: string;
  file: File;
  status: "pending" | "detecting" | "ready" | "importing" | "done" | "error" | "unknown";
  banco: string | null;
  bancoLabel: string | null;
  inserted?: number;
  skipped?: number;
  warning?: string;
  errorMsg?: string;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function BulkUploadPanel({ onImportDone }: { onImportDone?: () => void }) {
  const [files, setFiles] = useState<FileState[]>([]);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const addFiles = useCallback(async (newFiles: File[]) => {
    const valid = newFiles.filter(f => /\.(pdf|xls|xlsx)$/i.test(f.name));
    if (!valid.length) return;

    const entries: FileState[] = valid.map(f => ({
      id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
      file: f,
      status: "detecting",
      banco: null,
      bancoLabel: null,
    }));
    setFiles(prev => [...prev, ...entries]);

    // Detect banco for each file
    for (const entry of entries) {
      try {
        const b64 = await fileToBase64(entry.file);
        const res = await fetch("/api/admin/detect-banco", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64: b64, filename: entry.file.name }),
        });
        const data = await res.json() as { banco: string | null; label: string | null };
        setFiles(prev => prev.map(f => f.id === entry.id
          ? { ...f, status: data.banco ? "ready" : "unknown", banco: data.banco, bancoLabel: data.label }
          : f
        ));
      } catch {
        setFiles(prev => prev.map(f => f.id === entry.id
          ? { ...f, status: "unknown" }
          : f
        ));
      }
    }
  }, []);

  // Drag & drop
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const prevent = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.files) addFiles(Array.from(e.dataTransfer.files));
    };
    el.addEventListener("dragover", prevent);
    el.addEventListener("drop", drop);
    return () => { el.removeEventListener("dragover", prevent); el.removeEventListener("drop", drop); };
  }, [addFiles]);

  async function importAll() {
    const toImport = files.filter(f => f.status === "ready" && f.banco);
    if (!toImport.length) return;
    setImporting(true);

    for (const entry of toImport) {
      setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, status: "importing" } : f));
      try {
        const b64 = await fileToBase64(entry.file);
        const res = await fetch("/api/admin/import-from-base64", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64: b64, filename: entry.file.name, banco: entry.banco }),
        });
        const data = await res.json() as { ok?: boolean; inserted?: number; skipped?: number; warning?: string; error?: string };
        if (!res.ok || data.error) {
          setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, status: "error", errorMsg: data.error ?? "Error" } : f));
        } else {
          setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, status: "done", inserted: data.inserted, skipped: data.skipped, warning: data.warning } : f));
        }
      } catch (e) {
        setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, status: "error", errorMsg: e instanceof Error ? e.message : "Error" } : f));
      }
    }
    setImporting(false);
    onImportDone?.();
  }

  const readyCount = files.filter(f => f.status === "ready").length;
  const totalInserted = files.reduce((s, f) => s + (f.inserted ?? 0), 0);

  return (
    <div className="bg-white rounded-xl border p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2"><FolderUp className="w-5 h-5" /> Subida masiva (varios archivos)</h2>
        <p className="text-sm text-gray-500 mt-0.5">Arrastrá archivos o seleccioná varios a la vez. El sistema detecta automáticamente el banco.</p>
      </div>

      {/* Drop zone */}
      <div
        ref={dropRef}
        onClick={() => inputRef.current?.click()}
        className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <Upload className="w-5 h-5 text-gray-400 mb-2" />
        <p className="text-sm text-gray-500">Arrastrar acá o hacer clic para seleccionar</p>
        <p className="text-xs text-gray-400 mt-0.5">PDF, XLS, XLSX</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.xls,.xlsx"
          className="hidden"
          onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = ""; }}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map(f => (
            <div key={f.id} className="flex items-center gap-3 border rounded-lg px-3 py-2 text-sm">
              <FileText className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="flex-1 truncate text-gray-700 min-w-0">{f.file.name}</span>

              {/* Bank badge */}
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                f.status === "detecting" ? "bg-gray-100 text-gray-500" :
                f.status === "unknown"   ? "bg-red-100 text-red-600" :
                "bg-blue-100 text-blue-700"
              }`}>
                {f.status === "detecting" ? "Detectando…" : f.bancoLabel ?? "No detectado"}
              </span>

              {/* Status */}
              {f.status === "importing" && <RefreshCw className="w-4 h-4 text-gray-400 animate-spin shrink-0" />}
              {f.status === "done" && (
                <span className="text-xs text-green-700 shrink-0">
                  {f.warning ? `⚠ ${f.warning}` : `✓ ${f.inserted} nuevos`}
                </span>
              )}
              {f.status === "error" && <span className="text-xs text-red-600 shrink-0 max-w-[160px] truncate" title={f.errorMsg}>✗ {f.errorMsg}</span>}

              {/* Remove */}
              {!importing && f.status !== "importing" && (
                <button onClick={() => setFiles(prev => prev.filter(x => x.id !== f.id))} className="text-gray-300 hover:text-gray-500 shrink-0">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {files.length > 0 && (
        <div className="flex items-center gap-4">
          <button
            onClick={importAll}
            disabled={importing || readyCount === 0}
            className="h-10 px-6 bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg transition-colors disabled:opacity-50 text-sm"
          >
            {importing ? "Importando…" : `Importar ${readyCount} archivo${readyCount !== 1 ? "s" : ""}`}
          </button>
          {!importing && (
            <button onClick={() => setFiles([])} className="text-sm text-gray-400 hover:text-gray-600">
              Limpiar lista
            </button>
          )}
          {totalInserted > 0 && (
            <span className="text-sm text-green-700 font-medium">✓ {totalInserted} movimientos importados</span>
          )}
        </div>
      )}
    </div>
  );
}

const MES_LABELS: Record<string, string> = {
  "01": "ene", "02": "feb", "03": "mar", "04": "abr",
  "05": "may", "06": "jun", "07": "jul", "08": "ago",
  "09": "sep", "10": "oct", "11": "nov", "12": "dic",
};
function fmtYM(ym: string) { return `${MES_LABELS[ym.slice(5)] ?? ym.slice(5)}-${ym.slice(2, 4)}`; }

function CoveragePanel() {
  const [data, setData] = useState<{ months: string[]; bancos: { label: string; months: { ym: string; loaded: boolean }[] }[] } | null>(null);

  useEffect(() => {
    fetch("/api/admin/coverage").then(r => r.json()).then(setData);
  }, []);

  if (!data || data.months.length === 0) return null;

  // Build missing list — only up to current month (skip future months)
  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const missing: { banco: string; meses: string[] }[] = data.bancos
    .map(b => ({
      banco: b.label,
      meses: b.months.filter(({ ym, loaded }) => !loaded && ym <= currentYM).map(({ ym }) => fmtYM(ym)),
    }))
    .filter(b => b.meses.length > 0);

  return (
    <div className="bg-white rounded-xl border p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Cobertura de meses cargados</h2>
        <p className="text-sm text-gray-500 mt-0.5">Verde = cargado · Rojo = faltante</p>
      </div>

      <div className="overflow-x-auto">
        <table className="text-xs w-full">
          <thead>
            <tr>
              <th className="text-left pr-3 pb-1 font-medium text-gray-500 whitespace-nowrap">Banco</th>
              {data.months.map(m => (
                <th key={m} className={`px-0.5 pb-1 font-normal whitespace-nowrap ${m > currentYM ? "text-gray-200" : "text-gray-400"}`}>
                  {fmtYM(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.bancos.map(b => (
              <tr key={b.label}>
                <td className="pr-3 py-1 font-medium text-gray-700 whitespace-nowrap">{b.label}</td>
                {b.months.map(({ ym, loaded }) => (
                  <td key={ym} className="px-0.5 py-1 text-center">
                    {ym > currentYM ? (
                      <span className="inline-block w-5 h-5 rounded bg-gray-100 text-gray-300 text-[10px] leading-5">–</span>
                    ) : (
                      <span className={`inline-block w-5 h-5 rounded text-white text-[10px] leading-5 font-bold ${loaded ? "bg-green-400" : "bg-red-300"}`}>
                        {loaded ? "✓" : "✗"}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {missing.length > 0 && (
        <div className="border border-orange-200 bg-orange-50 rounded-lg p-4 space-y-2">
          <p className="text-sm font-semibold text-orange-800">Extractos faltantes para solicitar:</p>
          <ul className="space-y-1">
            {missing.map(({ banco, meses }) => (
              <li key={banco} className="text-sm text-orange-700">
                <span className="font-medium">{banco}:</span>{" "}
                {meses.join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TransferPanel() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function detect() {
    setLoading(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/match-transfers", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setMsg(`✓ ${data.pares} pares detectados, ${data.updated} movimientos marcados como traspaso`);
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : e}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Transferencias entre cuentas propias</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Detecta automáticamente movimientos espejo entre BBVA, Itaú, OCA y Scotiabank
          (mismo monto, distinto banco, fecha ±2 días) y los marca como traspaso.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={detect}
          disabled={loading}
          className="flex items-center gap-1.5 h-9 px-4 bg-brand text-white text-sm font-semibold rounded-lg disabled:opacity-50 hover:bg-brand-dark transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Detectando…" : "Detectar traspasos"}
        </button>
        {msg && (
          <p className={`text-sm ${msg.startsWith("Error") ? "text-red-600" : "text-green-700"}`}>{msg}</p>
        )}
      </div>
    </div>
  );
}
