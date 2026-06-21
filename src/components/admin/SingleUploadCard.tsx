"use client";
import { useState, useEffect } from "react";
import { Upload, ChevronDown, Trash2 } from "lucide-react";
import { StatusBox } from "./StatusBox";

const BANKS = [
  { value: "bbva-xls", label: "BBVA CC — Excel", accept: ".xls,.xlsx" },
  { value: "itau-xls", label: "Itaú — Excel", accept: ".xls,.xlsx" },
  { value: "oca-pdf",  label: "OCA — PDF", accept: ".pdf" },
  { value: "bbva-pdf", label: "BBVA — PDF", accept: ".pdf" },
  { value: "scotiabank-pdf", label: "Scotiabank — PDF", accept: ".pdf" },
  { value: "itau-card-pdf",  label: "Itaú Tarjeta VISA — PDF", accept: ".pdf" },
];

export function SingleUploadCard() {
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
        <p className="text-xs text-muted mt-0.5">Subí un archivo para un banco específico.</p>
      </div>

      <div className="relative">
        <select
          value={selectedBank}
          onChange={e => setSelectedBank(e.target.value)}
          className="w-full h-9 pl-3 pr-8 border border-gray-200 rounded-lg text-sm bg-white appearance-none"
        >
          {BANKS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
        <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-subtle pointer-events-none" />
      </div>

      <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:bg-surface">
        {file ? (
          <div className="text-center px-3">
            <p className="text-sm font-medium text-ink truncate max-w-[200px]">{file.name}</p>
            <p className="text-xs text-subtle mt-0.5">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
          </div>
        ) : (
          <div className="text-center">
            <Upload className="w-4 h-4 text-subtle mx-auto mb-1" />
            <p className="text-xs text-muted">Seleccionar archivo</p>
            <p className="text-xs text-subtle">{bankConfig.accept.split(",").join(", ")}</p>
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

      {availableMonths.length > 0 && (
        <div className="border border-red-100 rounded-lg p-3 space-y-2 bg-terracotta/10/40">
          <p className="text-xs text-muted font-medium">Borrar datos cargados</p>
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
              <ChevronDown className="absolute right-2 top-2 w-3 h-3 text-subtle pointer-events-none" />
            </div>
            <button
              onClick={() => selectedMonth && handleDelete(selectedMonth)}
              disabled={deleteLoading || !selectedMonth}
              className="flex items-center gap-1 text-xs px-3 h-8 border border-terracotta/30 text-terracotta rounded hover:bg-terracotta/10 disabled:opacity-40"
            >
              <Trash2 className="w-3 h-3" />
              {deleteLoading ? "…" : "Borrar mes"}
            </button>
          </div>
          <button
            onClick={() => handleDelete()}
            disabled={deleteLoading}
            className="text-xs text-red-400 hover:text-terracotta underline disabled:opacity-50"
          >
            Borrar todos los datos de este banco
          </button>
        </div>
      )}
    </div>
  );
}
