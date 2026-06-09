"use client";
import { useState } from "react";
import { Upload, RefreshCw } from "lucide-react";
import { StatusBox } from "./StatusBox";

export function ExcelPanel() {
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

export function TcPanel() {
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

export function AplicarReglasPanel() {
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

export function TransferPanel() {
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
