"use client";
import { useState, useEffect, useCallback } from "react";
import { Trash2 } from "lucide-react";

interface MovMatch { id: string; fecha: string; descripcion: string | null; debito: number | null; moneda: string }
interface ChequeRow {
  id: string; numero: string; fecha_cobro: string | null; proveedor: string | null;
  tipo_mercaderia: string | null; monto_uyu: number | null; monto_usd: number | null;
  banco: string | null; nota: string | null;
  match: MovMatch | null; matchParcial: MovMatch | null;
}

function fmtMonto(n: number | null) {
  return n == null ? "" : n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtFecha(f: string | null) {
  if (!f) return "—";
  const [y, m, d] = f.split("-");
  return `${d}/${m}/${y}`;
}

export function ChequesPanel() {
  const [cheques, setCheques] = useState<ChequeRow[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [paste, setPaste] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok?: boolean; inserted?: number; skipped?: number; parsed?: number; errores?: string[]; error?: string } | null>(null);
  const [filtro, setFiltro] = useState<"" | "ok" | "parcial" | "sin">("");

  const load = useCallback(() => {
    fetch("/api/admin/cheques").then(r => r.json()).then(d => {
      if (d.error) { setLoadError(d.error); setCheques([]); }
      else { setLoadError(""); setCheques(d.cheques ?? []); }
    });
  }, []);

  useEffect(load, [load]);

  async function importar() {
    if (!paste.trim()) return;
    setImporting(true);
    setImportResult(null);
    const res = await fetch("/api/admin/cheques-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: paste }),
    });
    const d = await res.json();
    setImportResult(d);
    setImporting(false);
    if (d.ok) { setPaste(""); load(); }
  }

  async function borrar(id: string) {
    if (!confirm("¿Eliminar este cheque del registro?")) return;
    await fetch("/api/admin/cheques", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  const list = (cheques ?? []).filter(c => {
    if (filtro === "ok") return !!c.match;
    if (filtro === "parcial") return !c.match && !!c.matchParcial;
    if (filtro === "sin") return !c.match && !c.matchParcial;
    return true;
  });

  const counts = {
    ok: (cheques ?? []).filter(c => c.match).length,
    parcial: (cheques ?? []).filter(c => !c.match && c.matchParcial).length,
    sin: (cheques ?? []).filter(c => !c.match && !c.matchParcial).length,
  };

  return (
    <div className="space-y-5">
      {/* Paste import */}
      <div className="bg-white rounded-xl border p-5">
        <h2 className="text-base font-semibold mb-1">Importar registro de cheques</h2>
        <p className="text-xs text-gray-500 mb-3">
          Pegá la planilla desde Excel (columnas separadas por tab): Número, Fecha de cobro, Proveedor, Tipo mercadería, Monto $, Monto USD, Banco.
          Los duplicados (mismo número + fecha + monto) se omiten automáticamente.
        </p>
        <textarea
          value={paste}
          onChange={e => setPaste(e.target.value)}
          rows={6}
          placeholder={"318715\t28/02/2025\tAngel\tJoyas\t\t185,00\tBBVA"}
          className="w-full text-xs font-mono border border-gray-200 rounded-lg p-3 focus:outline-none focus:border-brand resize-y"
        />
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={importar}
            disabled={importing || !paste.trim()}
            className="h-9 px-4 bg-brand text-white text-sm font-semibold rounded-lg disabled:opacity-50"
          >
            {importing ? "Importando…" : "Importar cheques"}
          </button>
          {importResult?.ok && (
            <span className="text-sm text-green-600">
              ✓ {importResult.inserted} nuevos · {importResult.skipped} duplicados omitidos ({importResult.parsed} leídos)
            </span>
          )}
          {importResult?.error && <span className="text-sm text-red-600">{importResult.error}</span>}
        </div>
        {!!importResult?.errores?.length && (
          <div className="mt-2 text-xs text-orange-600 space-y-0.5">
            {importResult.errores.map((e, i) => <p key={i}>⚠ {e}</p>)}
          </div>
        )}
      </div>

      {/* Listado con matching */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-base font-semibold">Cheques registrados {cheques ? `(${cheques.length})` : ""}</h2>
          <div className="flex gap-1.5 text-xs">
            <button onClick={() => setFiltro("")} className={`px-2.5 py-1 rounded-full border ${filtro === "" ? "bg-gray-800 text-white border-gray-800" : "text-gray-500"}`}>Todos</button>
            <button onClick={() => setFiltro("ok")} className={`px-2.5 py-1 rounded-full border ${filtro === "ok" ? "bg-green-600 text-white border-green-600" : "text-green-700 border-green-300"}`}>✓ Conciliados {counts.ok}</button>
            <button onClick={() => setFiltro("parcial")} className={`px-2.5 py-1 rounded-full border ${filtro === "parcial" ? "bg-orange-500 text-white border-orange-500" : "text-orange-700 border-orange-300"}`}>⚠ Nº ok, monto difiere {counts.parcial}</button>
            <button onClick={() => setFiltro("sin")} className={`px-2.5 py-1 rounded-full border ${filtro === "sin" ? "bg-red-600 text-white border-red-600" : "text-red-700 border-red-300"}`}>✗ Sin movimiento {counts.sin}</button>
          </div>
        </div>

        {loadError && <p className="text-sm text-red-600 mb-2">{loadError}</p>}
        {!cheques && <p className="text-sm text-gray-400">Cargando…</p>}
        {cheques && cheques.length === 0 && !loadError && (
          <p className="text-sm text-gray-400">Sin cheques registrados todavía — pegá la planilla arriba.</p>
        )}

        {list.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500 uppercase tracking-wider">
                  <th className="px-3 py-2 font-medium">Nº</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Fecha cobro</th>
                  <th className="px-3 py-2 font-medium">Proveedor</th>
                  <th className="px-3 py-2 font-medium">Mercadería</th>
                  <th className="px-3 py-2 font-medium text-right">$ UYU</th>
                  <th className="px-3 py-2 font-medium text-right">U$S</th>
                  <th className="px-3 py-2 font-medium">Estado banco</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono font-medium">{c.numero}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-500">{fmtFecha(c.fecha_cobro)}</td>
                    <td className="px-3 py-2">{c.proveedor ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-500">{c.tipo_mercaderia ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmtMonto(c.monto_uyu)}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmtMonto(c.monto_usd)}</td>
                    <td className="px-3 py-2">
                      {c.match ? (
                        <span className="text-green-700" title={c.match.descripcion ?? ""}>
                          ✓ {fmtFecha(c.match.fecha)} · {c.match.moneda} {fmtMonto(c.match.debito)}
                        </span>
                      ) : c.matchParcial ? (
                        <span className="text-orange-600" title={c.matchParcial.descripcion ?? ""}>
                          ⚠ Nº en banco ({fmtFecha(c.matchParcial.fecha)} · {c.matchParcial.moneda} {fmtMonto(c.matchParcial.debito)}) pero monto difiere
                        </span>
                      ) : (
                        <span className="text-red-500">✗ Sin movimiento en banco</span>
                      )}
                      {c.nota && <span className="block text-[10px] text-gray-400">{c.nota}</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => borrar(c.id)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
