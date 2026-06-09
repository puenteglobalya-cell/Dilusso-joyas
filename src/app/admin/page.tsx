"use client";
import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import {
  Upload, CheckCircle, AlertCircle, ChevronDown, Trash2, RefreshCw,
  FolderUp, FileText, X, Copy, Wrench, Grid3x3, Search,
} from "lucide-react";

const BANKS = [
  { value: "bbva-xls", label: "BBVA CC — Excel", accept: ".xls,.xlsx" },
  { value: "itau-xls", label: "Itaú — Excel", accept: ".xls,.xlsx" },
  { value: "oca-pdf",  label: "OCA — PDF", accept: ".pdf" },
  { value: "bbva-pdf", label: "BBVA — PDF", accept: ".pdf" },
  { value: "scotiabank-pdf", label: "Scotiabank — PDF", accept: ".pdf" },
  { value: "itau-card-pdf",  label: "Itaú Tarjeta VISA — PDF", accept: ".pdf" },
];

// ── Shared helpers ────────────────────────────────────────────────────────────

function StatusBox({ result, error }: { result: Record<string, unknown> | null; error: string | null }) {
  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
      <p className="text-sm text-red-700">{error}</p>
    </div>
  );
  if (result) return (
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
        {result.warning != null && <li className="text-yellow-700">⚠ {String(result.warning)}</li>}
      </ul>
    </div>
  );
  return null;
}

// ── Tab shell ─────────────────────────────────────────────────────────────────

type TabId = "importar" | "cobertura" | "duplicados" | "herramientas";

const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: "importar",     label: "Importar",     icon: <FolderUp className="w-4 h-4" /> },
  { id: "cobertura",    label: "Cobertura",    icon: <Grid3x3 className="w-4 h-4" /> },
  { id: "duplicados",   label: "Duplicados",   icon: <Copy className="w-4 h-4" /> },
  { id: "herramientas", label: "Herramientas", icon: <Wrench className="w-4 h-4" /> },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState<TabId>("importar");
  const [coverageKey, setCoverageKey] = useState(1);

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Administración</h1>
        <p className="text-sm text-gray-500 mt-1">Importaciones, validaciones y herramientas de mantenimiento.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b mb-6">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              tab === t.id
                ? "border-brand text-brand bg-white"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === "importar" && <ImportarTab onImportDone={() => setCoverageKey(k => k + 1)} />}
      {tab === "cobertura" && <CoveragePanel key={coverageKey} />}
      {tab === "duplicados" && <DuplicadosPanel />}
      {tab === "herramientas" && <HerramientasTab />}
    </div>
  );
}

// ── Importar tab ──────────────────────────────────────────────────────────────

function ImportarTab({ onImportDone }: { onImportDone?: () => void }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <BulkUploadCard onImportDone={onImportDone} />
      <SingleUploadCard />
    </div>
  );
}

// ── Single upload card ────────────────────────────────────────────────────────

function SingleUploadCard() {
  const [selectedBank, setSelectedBank] = useState(BANKS[0].value);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("");

  useEffect(() => {
    fetch(`/api/admin/bank-months?banco=${selectedBank}`)
      .then(r => r.json())
      .then(d => { setAvailableMonths(d.months ?? []); setSelectedMonth(""); });
  }, [selectedBank]);

  const bankConfig = BANKS.find(b => b.value === selectedBank) ?? BANKS[0];

  async function handleImport() {
    if (!file) return;
    setLoading(true); setError(null); setResult(null);
    const fd = new FormData();
    fd.append("file", file); fd.append("banco", selectedBank);
    try {
      const res = await fetch("/api/admin/import-bank", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(mes?: string) {
    const label = BANKS.find(b => b.value === selectedBank)?.label ?? selectedBank;
    const what = mes ? `el mes ${mes} de ${label}` : `TODOS los datos de ${label}`;
    if (!confirm(`¿Borrar ${what}? Esta acción no se puede deshacer.`)) return;
    setDeleteLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/admin/delete-bank", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banco: selectedBank, mes: mes ?? null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setResult({ deleted: data.deleted });
      fetch(`/api/admin/bank-months?banco=${selectedBank}`).then(r => r.json())
        .then(d => { setAvailableMonths(d.months ?? []); setSelectedMonth(""); });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border p-5 flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Extracto individual</h2>
        <p className="text-xs text-gray-500 mt-0.5">Subí un archivo para un banco específico.</p>
      </div>

      {/* Bank selector */}
      <div className="relative">
        <select
          value={selectedBank}
          onChange={e => setSelectedBank(e.target.value)}
          className="w-full h-9 pl-3 pr-8 border border-gray-200 rounded-lg text-sm bg-white appearance-none"
        >
          {BANKS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
        <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>

      {/* File drop */}
      <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
        {file ? (
          <div className="text-center px-3">
            <p className="text-sm font-medium text-gray-700 truncate max-w-[200px]">{file.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
          </div>
        ) : (
          <div className="text-center">
            <Upload className="w-4 h-4 text-gray-400 mx-auto mb-1" />
            <p className="text-xs text-gray-500">Seleccionar archivo</p>
            <p className="text-xs text-gray-400">{bankConfig.accept.split(",").join(", ")}</p>
          </div>
        )}
        <input type="file" className="hidden" accept={bankConfig.accept} onChange={e => setFile(e.target.files?.[0] ?? null)} />
      </label>

      <button
        onClick={handleImport}
        disabled={!file || loading}
        className="h-9 bg-brand hover:bg-brand-dark text-white text-sm font-semibold rounded-lg disabled:opacity-50"
      >
        {loading ? "Importando…" : "Importar"}
      </button>

      <StatusBox result={result} error={error} />

      {/* Delete */}
      {availableMonths.length > 0 && (
        <div className="border border-red-100 rounded-lg p-3 space-y-2 bg-red-50/40">
          <p className="text-xs text-gray-500 font-medium">Borrar datos cargados</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="w-full h-8 pl-3 pr-7 border border-gray-200 rounded text-xs bg-white appearance-none"
              >
                <option value="">— Seleccionar mes —</option>
                {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
            <button
              onClick={() => selectedMonth && handleDelete(selectedMonth)}
              disabled={deleteLoading || !selectedMonth}
              className="flex items-center gap-1 text-xs px-3 h-8 border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-40"
            >
              <Trash2 className="w-3 h-3" />
              {deleteLoading ? "…" : "Borrar mes"}
            </button>
          </div>
          <button
            onClick={() => handleDelete()}
            disabled={deleteLoading}
            className="text-xs text-red-400 hover:text-red-600 underline disabled:opacity-50"
          >
            Borrar todos los datos de este banco
          </button>
        </div>
      )}
    </div>
  );
}

// ── Bulk upload card ──────────────────────────────────────────────────────────

type FileState = {
  id: string; file: File;
  status: "pending" | "detecting" | "ready" | "importing" | "done" | "error" | "unknown";
  banco: string | null; bancoLabel: string | null;
  inserted?: number; skipped?: number; warning?: string; errorMsg?: string;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function BulkUploadCard({ onImportDone }: { onImportDone?: () => void }) {
  const [files, setFiles] = useState<FileState[]>([]);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const addFiles = useCallback(async (newFiles: File[]) => {
    const valid = newFiles.filter(f => /\.(pdf|xls|xlsx)$/i.test(f.name));
    if (!valid.length) return;
    const entries: FileState[] = valid.map(f => ({
      id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
      file: f, status: "detecting", banco: null, bancoLabel: null,
    }));
    setFiles(prev => [...prev, ...entries]);
    for (const entry of entries) {
      try {
        const b64 = await fileToBase64(entry.file);
        const res = await fetch("/api/admin/detect-banco", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64: b64, filename: entry.file.name }),
        });
        const data = await res.json() as { banco: string | null; label: string | null };
        setFiles(prev => prev.map(f => f.id === entry.id
          ? { ...f, status: data.banco ? "ready" : "unknown", banco: data.banco, bancoLabel: data.label }
          : f));
      } catch {
        setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, status: "unknown" } : f));
      }
    }
  }, []);

  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const prevent = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => { e.preventDefault(); if (e.dataTransfer?.files) addFiles(Array.from(e.dataTransfer.files)); };
    el.addEventListener("dragover", prevent); el.addEventListener("drop", drop);
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
          method: "POST", headers: { "Content-Type": "application/json" },
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
    <div className="bg-white rounded-xl border p-5 flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold flex items-center gap-2"><FolderUp className="w-4 h-4" /> Subida masiva</h2>
        <p className="text-xs text-gray-500 mt-0.5">Arrastrá varios archivos — el sistema detecta el banco automáticamente.</p>
      </div>

      <div
        ref={dropRef}
        onClick={() => inputRef.current?.click()}
        className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
      >
        <Upload className="w-4 h-4 text-gray-400 mb-1" />
        <p className="text-xs text-gray-500">Arrastrar o hacer clic</p>
        <p className="text-xs text-gray-400">PDF, XLS, XLSX</p>
        <input ref={inputRef} type="file" multiple accept=".pdf,.xls,.xlsx" className="hidden"
          onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = ""; }} />
      </div>

      {files.length > 0 && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {files.map(f => (
            <div key={f.id} className="flex items-center gap-2 border rounded-lg px-3 py-1.5 text-xs">
              <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="flex-1 truncate text-gray-700">{f.file.name}</span>
              <span className={`px-2 py-0.5 rounded-full shrink-0 ${
                f.status === "detecting" ? "bg-gray-100 text-gray-500" :
                f.status === "unknown"   ? "bg-red-100 text-red-600" :
                "bg-blue-100 text-blue-700"
              }`}>
                {f.status === "detecting" ? "Detectando…" : f.bancoLabel ?? "No detectado"}
              </span>
              {f.status === "importing" && <RefreshCw className="w-3.5 h-3.5 text-gray-400 animate-spin shrink-0" />}
              {f.status === "done" && <span className="text-green-700 shrink-0">{f.warning ? `⚠ ${f.warning}` : `✓ ${f.inserted}`}</span>}
              {f.status === "error" && <span className="text-red-600 shrink-0 max-w-[120px] truncate" title={f.errorMsg}>✗ {f.errorMsg}</span>}
              {!importing && f.status !== "importing" && (
                <button onClick={() => setFiles(prev => prev.filter(x => x.id !== f.id))} className="text-gray-300 hover:text-gray-500 shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={importAll}
            disabled={importing || readyCount === 0}
            className="h-9 px-5 bg-brand hover:bg-brand-dark text-white text-sm font-semibold rounded-lg disabled:opacity-50"
          >
            {importing ? "Importando…" : `Importar ${readyCount} archivo${readyCount !== 1 ? "s" : ""}`}
          </button>
          {!importing && (
            <button onClick={() => setFiles([])} className="text-xs text-gray-400 hover:text-gray-600">Limpiar</button>
          )}
          {totalInserted > 0 && (
            <span className="text-xs text-green-700 font-medium">✓ {totalInserted} movimientos</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Coverage panel ────────────────────────────────────────────────────────────

const MES_LABELS: Record<string, string> = {
  "01": "ene","02": "feb","03": "mar","04": "abr","05": "may","06": "jun",
  "07": "jul","08": "ago","09": "sep","10": "oct","11": "nov","12": "dic",
};
function fmtYM(ym: string) { return `${MES_LABELS[ym.slice(5)] ?? ym.slice(5)}-${ym.slice(2, 4)}`; }

function CoveragePanel() {
  const [data, setData] = useState<{ months: string[]; bancos: { label: string; months: { ym: string; loaded: boolean }[] }[] } | null>(null);

  useEffect(() => { fetch("/api/admin/coverage").then(r => r.json()).then(setData); }, []);

  if (!data || data.months.length === 0) return (
    <div className="bg-white rounded-xl border p-6 text-sm text-gray-400">Cargando cobertura…</div>
  );

  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const missing = data.bancos
    .map(b => ({ banco: b.label, meses: b.months.filter(({ ym, loaded }) => !loaded && ym <= currentYM).map(({ ym }) => fmtYM(ym)) }))
    .filter(b => b.meses.length > 0);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border p-5">
        <h2 className="text-base font-semibold mb-3">Cobertura de extractos</h2>
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
                      {ym > currentYM
                        ? <span className="inline-block w-5 h-5 rounded bg-gray-100 text-gray-300 text-[10px] leading-5">–</span>
                        : <span className={`inline-block w-5 h-5 rounded text-white text-[10px] leading-5 font-bold ${loaded ? "bg-green-400" : "bg-red-300"}`}>{loaded ? "✓" : "✗"}</span>
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {missing.length > 0 && (
        <div className="border border-orange-200 bg-orange-50 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-orange-800">Extractos faltantes</p>
            <span className="text-xs font-bold bg-orange-200 text-orange-900 rounded-full px-2.5 py-0.5">
              {missing.reduce((acc, b) => acc + b.meses.length, 0)} meses
            </span>
          </div>
          <ul className="space-y-1.5">
            {missing.map(({ banco, meses }) => (
              <li key={banco} className="text-sm text-orange-700">
                <span className="font-medium">{banco}</span>
                <span className="ml-1.5 text-xs font-semibold bg-orange-200 text-orange-900 rounded-full px-2 py-0.5">{meses.length}</span>
                <span className="ml-2 text-orange-600">{meses.join(", ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Duplicados panel ──────────────────────────────────────────────────────────

interface DupGroup {
  banco: string; fecha: string; descripcion: string;
  debito: number | null; credito: number | null; moneda: string;
  ids: string[]; count: number;
}

function DuplicadosPanel() {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<DupGroup[] | null>(null);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function scan() {
    setLoading(true); setGroups(null); setSelected(new Set()); setDeleted(null); setError(null);
    try {
      const res = await fetch("/api/admin/find-duplicates");
      const data = await res.json() as { groups: DupGroup[]; total: number };
      setGroups(data.groups);
      setTotal(data.total);
      // Pre-select the "extra" IDs to delete (keep first, select rest)
      const sel = new Set<string>();
      for (const g of data.groups) g.ids.slice(1).forEach(id => sel.add(id));
      setSelected(sel);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (selected.size === 0) return;
    setDeleting(true); setError(null);
    try {
      const res = await fetch("/api/admin/delete-duplicates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setDeleted(data.deleted);
      setConfirming(false);
      // Remove deleted from groups
      const deletedIds = new Set(Array.from(selected));
      setGroups(prev => prev?.map(g => ({ ...g, ids: g.ids.filter(id => !deletedIds.has(id)) }))
        .filter(g => g.ids.length > 1) ?? []);
      setSelected(new Set());
      setTotal(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  }

  function toggleId(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const fmtAmt = (v: number | null, moneda: string) =>
    v != null ? `${moneda === "USD" ? "U$" : "$"} ${v.toLocaleString("es-UY", { minimumFractionDigits: 2 })}` : "";

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2"><Copy className="w-4 h-4" /> Validar duplicados</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Detecta movimientos con misma fecha, banco, monto y descripción (normalizada). Podés desmarcar filas antes de borrar.
            </p>
          </div>
          <button
            onClick={scan}
            disabled={loading}
            className="flex items-center gap-1.5 h-9 px-4 bg-brand hover:bg-brand-dark text-white text-sm font-semibold rounded-lg disabled:opacity-50 shrink-0"
          >
            <Search className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Escaneando…" : "Escanear"}
          </button>
        </div>

        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {deleted != null && (
          <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 flex gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-sm text-green-700">{deleted} movimientos duplicados eliminados correctamente.</p>
          </div>
        )}

        {groups !== null && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm">
              {groups.length === 0
                ? <span className="text-green-700 font-medium">✓ No se encontraron duplicados</span>
                : <span className="text-orange-700 font-medium">{groups.length} grupos — {total} filas a eliminar ({selected.size} seleccionadas)</span>
              }
            </p>
            {groups.length > 0 && (
              <button
                onClick={() => setConfirming(true)}
                disabled={selected.size === 0}
                className="flex items-center gap-1.5 h-8 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar {selected.size} seleccionadas
              </button>
            )}
          </div>
        )}
      </div>

      {/* Groups table */}
      {groups && groups.length > 0 && (
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-500">Banco</th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">Fecha</th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">Descripción</th>
                <th className="px-3 py-2 text-right font-medium text-slate-500">Débito</th>
                <th className="px-3 py-2 text-right font-medium text-slate-500">Crédito</th>
                <th className="px-3 py-2 text-center font-medium text-slate-500">IDs (marcar = eliminar)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groups.map((g, gi) => (
                <tr key={gi} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{g.banco}</td>
                  <td className="px-3 py-2 text-slate-500">{g.fecha}</td>
                  <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate">{g.descripcion}</td>
                  <td className="px-3 py-2 text-right text-red-600">{fmtAmt(g.debito, g.moneda)}</td>
                  <td className="px-3 py-2 text-right text-green-600">{fmtAmt(g.credito, g.moneda)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {g.ids.map((id, idx) => (
                        <label key={id} className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selected.has(id)}
                            onChange={() => toggleId(id)}
                            className="w-3 h-3 accent-red-600"
                          />
                          <span className={`text-[10px] font-mono ${selected.has(id) ? "text-red-600" : "text-slate-400"}`}>
                            {idx === 0 ? "conservar" : `dup-${idx}`}
                          </span>
                        </label>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation modal */}
      {confirming && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-red-700 flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Confirmar eliminación
            </h3>
            <p className="text-sm text-gray-700">
              Estás por eliminar <span className="font-bold">{selected.size} movimientos</span> marcados como duplicados.
              Esta acción no se puede deshacer.
            </p>
            <p className="text-xs text-gray-500">
              Se conservará 1 fila por grupo (la marcada como "conservar"). Los demás serán borrados permanentemente.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-sm disabled:opacity-50"
              >
                {deleting ? "Eliminando…" : `Sí, eliminar ${selected.size}`}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="flex-1 h-10 border text-gray-700 font-semibold rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Herramientas tab ──────────────────────────────────────────────────────────

function HerramientasTab() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <TcPanel />
      <TransferPanel />
      <AplicarReglasPanel />
      <ExcelPanel />
    </div>
  );
}

function ExcelPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExcel() {
    if (!file) return;
    setLoading(true); setError(null); setResult(null);
    const fd = new FormData(); fd.append("file", file);
    try {
      const res = await fetch("/api/admin/import-excel", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border p-5 flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Excel maestro</h2>
        <p className="text-xs text-gray-500 mt-0.5">Importa el Excel de Cecilia (Consolidado + Liquidaciones).</p>
      </div>
      <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
        {file
          ? <p className="text-sm font-medium text-gray-700 px-3 truncate">{file.name}</p>
          : <><Upload className="w-4 h-4 text-gray-400 mb-1" /><p className="text-xs text-gray-500">.xlsx, .xls</p></>
        }
        <input type="file" className="hidden" accept=".xlsx,.xls" onChange={e => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <button onClick={handleExcel} disabled={!file || loading}
        className="h-9 bg-brand hover:bg-brand-dark text-white text-sm font-semibold rounded-lg disabled:opacity-50">
        {loading ? "Importando…" : "Importar Excel"}
      </button>
      <StatusBox result={result} error={error} />
    </div>
  );
}

function TcPanel() {
  const [mes, setMes] = useState(""); const [tc, setTc] = useState("");
  const [loading, setLoading] = useState(false); const [msg, setMsg] = useState<string | null>(null);

  async function handleUpdateTc() {
    if (!mes || !tc) return;
    setLoading(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/update-tc", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes, tc: parseFloat(tc) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setMsg(`✓ ${data.updated} movimientos USD actualizados para ${mes}`);
    } catch (e) { setMsg(`Error: ${e instanceof Error ? e.message : e}`); }
    finally { setLoading(false); }
  }

  return (
    <div className="bg-white rounded-xl border p-5 flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Tipo de cambio USD/UYU</h2>
        <p className="text-xs text-gray-500 mt-0.5">Recalcula el importe UYU de movimientos en dólares.</p>
      </div>
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">Mes</label>
          <input type="month" value={mes} onChange={e => setMes(e.target.value)}
            className="w-full h-9 border border-gray-200 rounded-lg px-3 text-sm" />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">TC</label>
          <input type="number" step="0.01" value={tc} onChange={e => setTc(e.target.value)}
            placeholder="41.50" className="w-full h-9 border border-gray-200 rounded-lg px-3 text-sm" />
        </div>
        <button onClick={handleUpdateTc} disabled={loading || !mes || !tc}
          className="flex items-center gap-1 h-9 px-3 bg-brand text-white text-sm font-semibold rounded-lg disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "…" : "OK"}
        </button>
      </div>
      {msg && <p className={`text-sm ${msg.startsWith("Error") ? "text-red-600" : "text-green-700"}`}>{msg}</p>}
    </div>
  );
}

function AplicarReglasPanel() {
  const [loading, setLoading] = useState(false); const [msg, setMsg] = useState<string | null>(null);

  async function aplicar() {
    setLoading(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/aplicar-reglas", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setMsg(`✓ ${data.actualizados} movimientos clasificados`);
    } catch (e) { setMsg(`Error: ${e instanceof Error ? e.message : e}`); }
    finally { setLoading(false); }
  }

  return (
    <div className="bg-white rounded-xl border p-5 flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Aplicar reglas de clasificación</h2>
        <p className="text-xs text-gray-500 mt-0.5">Recorre todos los sin clasificar y aplica el diccionario.</p>
      </div>
      <button onClick={aplicar} disabled={loading}
        className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 w-fit">
        {loading ? "Aplicando…" : "Aplicar reglas"}
      </button>
      {msg && <p className={`text-sm ${msg.startsWith("Error") ? "text-red-600" : "text-green-700"}`}>{msg}</p>}
    </div>
  );
}

function TransferPanel() {
  const [loading, setLoading] = useState(false); const [msg, setMsg] = useState<string | null>(null);

  async function detect() {
    setLoading(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/match-transfers", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setMsg(`✓ ${data.pares} pares — ${data.updated} marcados como traspaso`);
    } catch (e) { setMsg(`Error: ${e instanceof Error ? e.message : e}`); }
    finally { setLoading(false); }
  }

  return (
    <div className="bg-white rounded-xl border p-5 flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Traspasos entre cuentas</h2>
        <p className="text-xs text-gray-500 mt-0.5">Detecta movimientos espejo entre bancos (mismo monto, ±2 días) y los marca como traspaso.</p>
      </div>
      <button onClick={detect} disabled={loading}
        className="flex items-center gap-1.5 h-9 px-4 bg-brand hover:bg-brand-dark text-white text-sm font-semibold rounded-lg disabled:opacity-50 w-fit">
        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Detectando…" : "Detectar traspasos"}
      </button>
      {msg && <p className={`text-sm ${msg.startsWith("Error") ? "text-red-600" : "text-green-700"}`}>{msg}</p>}
    </div>
  );
}
