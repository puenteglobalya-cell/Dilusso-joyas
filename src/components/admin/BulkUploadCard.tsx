"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Upload, FolderUp, FileText, RefreshCw, X } from "lucide-react";

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

export function BulkUploadCard({ onImportDone }: { onImportDone?: () => void }) {
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
