"use client";
import { useState, useMemo } from "react";
import { Copy, Search, Trash2, CheckCircle, AlertCircle, ChevronDown, RefreshCw } from "lucide-react";

interface DupGroup {
  banco: string; fecha: string; descripcion: string;
  debito: number | null; credito: number | null; moneda: string;
  ids: string[]; dirty: boolean[]; count: number;
}

function fmtAmt(v: number | null, moneda: string) {
  return v != null ? `${moneda === "USD" ? "U$" : "$"} ${v.toLocaleString("es-UY", { minimumFractionDigits: 2 })}` : "";
}

export function DuplicadosPanel() {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<DupGroup[] | null>(null);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterBanco, setFilterBanco] = useState("");
  const [filterMonth, setFilterMonth] = useState("");

  const bancoOptions = useMemo(() => {
    if (!groups) return [];
    return [...new Set(groups.map(g => g.banco))].sort();
  }, [groups]);

  const monthOptions = useMemo(() => {
    if (!groups) return [];
    return [...new Set(groups.map(g => g.fecha.slice(0, 7)))].sort();
  }, [groups]);

  const visibleGroups = useMemo(() => {
    if (!groups) return [];
    return groups.filter(g =>
      (!filterBanco || g.banco === filterBanco) &&
      (!filterMonth || g.fecha.startsWith(filterMonth))
    );
  }, [groups, filterBanco, filterMonth]);

  async function scan() {
    setLoading(true); setGroups(null); setSelected(new Set()); setDeleted(null); setError(null);
    setFilterBanco(""); setFilterMonth("");
    try {
      const res = await fetch("/api/admin/find-duplicates");
      if (res.status === 401 || res.status === 403) { setError("Sin acceso. Iniciá sesión como contador."); return; }
      const data = await res.json() as { groups: DupGroup[]; total: number; error?: string };
      if (data.error) throw new Error(data.error);
      setGroups(data.groups);
      setTotal(data.total);
      // Pre-select extras (keep first = clean description)
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
      setSelected(new Set());
      // Auto re-scan to confirm clean state
      await scan();
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

  function selectAllVisible() {
    setSelected(prev => {
      const n = new Set(prev);
      for (const g of visibleGroups) g.ids.slice(1).forEach(id => n.add(id));
      return n;
    });
  }

  function deselectAllVisible() {
    setSelected(prev => {
      const n = new Set(prev);
      for (const g of visibleGroups) g.ids.forEach(id => n.delete(id));
      return n;
    });
  }

  const selectedVisible = visibleGroups.reduce((acc, g) => acc + g.ids.filter(id => selected.has(id)).length, 0);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2"><Copy className="w-4 h-4" /> Validar duplicados</h2>
            <p className="text-sm text-muted mt-0.5">
              Detecta movimientos con misma fecha, banco, monto y descripción (normalizada). Las descripciones con caracteres raros se pre-marcan para borrar.
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
          <div className="mt-3 bg-terracotta/10 border border-terracotta/30 rounded-lg p-3 flex gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {deleted != null && (
          <div className="mt-3 bg-olive/10 border border-olive/30 rounded-lg p-3 flex gap-2">
            <CheckCircle className="w-4 h-4 text-olive shrink-0" />
            <p className="text-sm text-olive">{deleted} movimientos eliminados. Re-escaneando…</p>
          </div>
        )}

        {groups !== null && !loading && (
          <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm">
              {groups.length === 0
                ? <span className="text-olive font-medium">✓ No se encontraron duplicados</span>
                : <span className="text-orange-700 font-medium">{groups.length} grupos — {total} filas extra ({selectedVisible} seleccionadas en vista)</span>
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

      {/* Filters + table */}
      {groups && groups.length > 0 && (
        <>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <select value={filterBanco} onChange={e => setFilterBanco(e.target.value)}
                className="h-8 pl-3 pr-7 border border-gray-200 rounded-lg text-xs bg-white appearance-none">
                <option value="">Todos los bancos</option>
                {bancoOptions.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-2 w-3 h-3 text-subtle pointer-events-none" />
            </div>
            <div className="relative">
              <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                className="h-8 pl-3 pr-7 border border-gray-200 rounded-lg text-xs bg-white appearance-none">
                <option value="">Todos los meses</option>
                {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-2 w-3 h-3 text-subtle pointer-events-none" />
            </div>
            <button onClick={selectAllVisible} className="h-8 px-3 text-xs border border-gray-200 rounded-lg hover:bg-surface">Sel. todos</button>
            <button onClick={deselectAllVisible} className="h-8 px-3 text-xs border border-gray-200 rounded-lg hover:bg-surface">Desel. todos</button>
            <span className="text-xs text-subtle self-center">{visibleGroups.length} grupos</span>
          </div>

          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted">Banco</th>
                  <th className="px-3 py-2 text-left font-medium text-muted">Fecha</th>
                  <th className="px-3 py-2 text-left font-medium text-muted">Descripción</th>
                  <th className="px-3 py-2 text-right font-medium text-muted">Débito</th>
                  <th className="px-3 py-2 text-right font-medium text-muted">Crédito</th>
                  <th className="px-3 py-2 text-center font-medium text-muted">IDs (marcar = eliminar)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleGroups.map((g, gi) => (
                  <tr key={gi} className="hover:bg-surface">
                    <td className="px-3 py-2 font-medium">{g.banco}</td>
                    <td className="px-3 py-2 text-muted">{g.fecha}</td>
                    <td className="px-3 py-2 text-ink max-w-[200px] truncate">{g.descripcion}</td>
                    <td className="px-3 py-2 text-right text-terracotta">{fmtAmt(g.debito, g.moneda)}</td>
                    <td className="px-3 py-2 text-right text-olive">{fmtAmt(g.credito, g.moneda)}</td>
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
                            <span className={`text-[10px] font-mono ${selected.has(id) ? "text-terracotta" : "text-subtle"}`}>
                              {idx === 0 ? "conservar" : `dup-${idx}`}
                              {g.dirty[idx] && <span title="Descripción con caracteres raros"> 🔡</span>}
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
        </>
      )}

      {/* Confirmation modal */}
      {confirming && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-red-700 flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Confirmar eliminación
            </h3>
            <p className="text-sm text-ink">
              Estás por eliminar <span className="font-bold">{selected.size} movimientos</span> marcados como duplicados.
              Esta acción no se puede deshacer.
            </p>
            <p className="text-xs text-muted">
              El servidor re-verificará que cada ID tenga un par antes de borrar. Después se re-escaneará automáticamente.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting && <RefreshCw className="w-4 h-4 animate-spin" />}
                {deleting ? "Eliminando…" : `Sí, eliminar ${selected.size}`}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="flex-1 h-10 border text-ink font-semibold rounded-lg text-sm hover:bg-surface disabled:opacity-50"
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
