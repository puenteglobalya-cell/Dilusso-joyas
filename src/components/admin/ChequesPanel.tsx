"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

interface MovMatch { id: string; fecha: string; descripcion: string | null; debito: number | null; moneda: string; clasificado?: string | null; motivo?: string }
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
  const router = useRouter();
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

  const [aplicando, setAplicando] = useState(false);
  const [aplicarResult, setAplicarResult] = useState<{ clasificados?: number } | null>(null);

  function buildMatches(rows: ChequeRow[]) {
    return rows
      .filter(c => c.match && c.match.clasificado !== "Si")
      .map(c => ({
        movId: c.match!.id,
        categoria: (c.tipo_mercaderia ?? "Mercadería").trim(),
        descripcion: c.proveedor?.trim()
          ? `${c.proveedor.trim()} - Cheque ${c.numero}`
          : `Cheque ${c.numero}`,
      }));
  }

  async function forzarClasificar(c: ChequeRow) {
    const mov = c.matchParcial;
    if (!mov) return;
    const matches = [{
      movId: mov.id,
      categoria: (c.tipo_mercaderia ?? "Mercadería").trim(),
      descripcion: c.proveedor?.trim() ? `${c.proveedor.trim()} - Cheque ${c.numero}` : `Cheque ${c.numero}`,
    }];
    await fetch("/api/admin/cheques-aplicar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matches }),
    });
    load();
    router.refresh();
  }

  async function aplicarClasificacion() {
    if (!cheques) return;
    setAplicando(true);
    const matches = buildMatches(cheques);
    const res = await fetch("/api/admin/cheques-aplicar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matches }),
    });
    const d = await res.json();
    setAplicarResult(d);
    setAplicando(false);
    if (d.ok) {
      load();
      // refresh sidebar badge (force full page revalidation)
      router.refresh();
    }
  }

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
    if (d.ok) {
      setPaste("");
      // reload to get fresh matches, then auto-classify
      const r2 = await fetch("/api/admin/cheques").then(r => r.json());
      const freshCheques: ChequeRow[] = r2.cheques ?? [];
      setCheques(freshCheques);
      const matches = buildMatches(freshCheques);
      if (matches.length > 0) {
        const r3 = await fetch("/api/admin/cheques-aplicar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matches }),
        });
        const d3 = await r3.json();
        if (d3.clasificados > 0) setAplicarResult(d3);
        // reload to reflect new clasificado state
        load();
      }
    }
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
              {aplicarResult?.clasificados ? ` · ${aplicarResult.clasificados} movimientos clasificados` : ""}
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
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold">Cheques registrados {cheques ? `(${cheques.length})` : ""}</h2>
            {counts.ok > 0 && (
              <button
                onClick={aplicarClasificacion}
                disabled={aplicando}
                className="h-8 px-3 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
              >
                {aplicando ? "Clasificando…" : `Clasificar conciliados (${counts.ok})`}
              </button>
            )}
            {aplicarResult?.clasificados != null && !aplicando && (
              <span className="text-xs text-green-600">✓ {aplicarResult.clasificados} clasificados</span>
            )}
          </div>
          <div className="flex gap-1.5 text-xs">
            <button onClick={() => setFiltro("")} className={`px-2.5 py-1 rounded-full border ${filtro === "" ? "bg-gray-800 text-white border-gray-800" : "text-gray-500"}`}>Todos</button>
            <button onClick={() => setFiltro("ok")} className={`px-2.5 py-1 rounded-full border ${filtro === "ok" ? "bg-green-600 text-white border-green-600" : "text-green-700 border-green-300"}`}>✓ Conciliados {counts.ok}</button>
            <button onClick={() => setFiltro("parcial")} className={`px-2.5 py-1 rounded-full border ${filtro === "parcial" ? "bg-orange-500 text-white border-orange-500" : "text-orange-700 border-orange-300"}`}>⚠ Revisar {counts.parcial}</button>
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
                        <span className={c.match.clasificado === "Si" ? "text-blue-600" : "text-green-700"} title={c.match.descripcion ?? ""}>
                          {c.match.clasificado === "Si" ? "✓ Clasificado" : "✓ Coincide"} · {fmtFecha(c.match.fecha)} · {c.match.moneda} {fmtMonto(c.match.debito)}
                        </span>
                      ) : c.matchParcial ? (
                        <div className="space-y-1">
                          <span className="text-orange-600 block" title={c.matchParcial.descripcion ?? ""}>
                            ⚠ {fmtFecha(c.matchParcial.fecha)} · {c.matchParcial.moneda} {fmtMonto(c.matchParcial.debito)} — {c.matchParcial.motivo ?? "monto difiere"}
                          </span>
                          <button
                            onClick={() => forzarClasificar(c)}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded bg-orange-100 hover:bg-orange-200 text-orange-800"
                          >
                            Confirmar igual
                          </button>
                        </div>
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
