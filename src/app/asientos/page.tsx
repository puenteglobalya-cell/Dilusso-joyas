"use client";
import { useState, useCallback } from "react";
import { Plus, Trash2, Save, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { formatUYU } from "@/lib/utils";
import { CATEGORIAS_PERSONAL } from "@/lib/categorias-personal";

const CUENTAS = [
  "Caja / Efectivo",
  "Banco BBVA",
  "Banco Itaú",
  "Banco Scotiabank",
  "OCA Tarjeta",
  "Itaú VISA",
  "Deuda a cobrar",
  "Deuda a pagar",
  "Capital propio",
  "Ingreso",
  "Gasto",
  "Otro",
];

const CATS_NEGOCIO = [
  "Insumos/Materiales",
  "Sueldos/Honorarios",
  "Alquiler",
  "Servicios",
  "Ventas/Ingresos",
  "Impuestos",
  "Banco/Comisiones",
  "Publicidad",
  "Logística",
  "Otros Negocio",
];

interface Linea {
  cuenta: string;
  tipo: "negocio" | "personal" | "ambos";
  categoria_negocio: string;
  categoria_personal: string;
  debe: string;
  haber: string;
  moneda: "UYU" | "USD";
}

interface AsientoGuardado {
  id: string;
  fecha: string;
  descripcion: string;
  lineas: {
    id: string;
    cuenta: string;
    tipo: string;
    debe: number;
    haber: number;
    moneda: string;
    categoria_negocio: string | null;
    categoria_personal: string | null;
  }[];
}

function emptyLinea(): Linea {
  return { cuenta: "", tipo: "personal", categoria_negocio: "", categoria_personal: "", debe: "", haber: "", moneda: "UYU" };
}

function parseNum(s: string): number {
  return parseFloat(s.replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
}

export default function AsientosPage() {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [descripcion, setDescripcion] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([emptyLinea(), emptyLinea()]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [historial, setHistorial] = useState<AsientoGuardado[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalDebe = lineas.reduce((s, l) => s + parseNum(l.debe), 0);
  const totalHaber = lineas.reduce((s, l) => s + parseNum(l.haber), 0);
  const diff = Math.abs(totalDebe - totalHaber);
  const balanced = diff < 0.005 && totalDebe > 0;

  const setLinea = useCallback((i: number, patch: Partial<Linea>) => {
    setLineas(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }, []);

  const removeLinea = useCallback((i: number) => {
    setLineas(ls => ls.filter((_, idx) => idx !== i));
  }, []);

  const addLinea = useCallback(() => {
    setLineas(ls => [...ls, emptyLinea()]);
  }, []);

  const handleSave = async () => {
    if (!balanced) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/asientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha,
          descripcion,
          lineas: lineas.map(l => ({
            cuenta: l.cuenta,
            tipo: l.tipo,
            categoria_negocio: l.categoria_negocio || null,
            categoria_personal: l.categoria_personal || null,
            debe: parseNum(l.debe),
            haber: parseNum(l.haber),
            moneda: l.moneda,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg({ type: "err", text: json.error ?? "Error al guardar" });
      } else {
        setMsg({ type: "ok", text: `Asiento guardado (${json.lineas} líneas)` });
        setDescripcion("");
        setLineas([emptyLinea(), emptyLinea()]);
      }
    } catch {
      setMsg({ type: "err", text: "Error de red" });
    } finally {
      setSaving(false);
    }
  };

  const loadHistorial = async () => {
    setLoadingHist(true);
    try {
      const res = await fetch("/api/asientos");
      const json = await res.json();
      setHistorial(json.asientos ?? []);
      setShowHist(true);
    } finally {
      setLoadingHist(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este asiento?")) return;
    await fetch(`/api/asientos?asiento_id=${id}`, { method: "DELETE" });
    setHistorial(h => h.filter(a => a.id !== id));
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "#2a1f1a" }}>Asientos Manuales</h1>
        <p className="text-sm mt-0.5" style={{ color: "#b5a49a" }}>
          Registros manuales con control de balanceo · Debe = Haber
        </p>
      </div>

      {/* Form */}
      <div className="rounded-2xl bg-white p-6 mb-6" style={{ border: "1px solid #ede9e4" }}>
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#9c8a7e" }}>Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ border: "1px solid #ede9e4", color: "#2a1f1a" }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#9c8a7e" }}>Descripción</label>
            <input
              type="text"
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Ej: Pago efectivo mercado, traspaso bolsillo..."
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ border: "1px solid #ede9e4", color: "#2a1f1a" }}
            />
          </div>
        </div>

        {/* Líneas */}
        <div className="mb-4">
          <div className="grid text-xs font-medium mb-2" style={{ gridTemplateColumns: "1fr 100px 120px 120px 90px 90px 70px 32px", color: "#9c8a7e" }}>
            <span>Cuenta</span>
            <span>Tipo</span>
            <span>Cat. Negocio</span>
            <span>Cat. Personal</span>
            <span className="text-right">Debe</span>
            <span className="text-right">Haber</span>
            <span>Moneda</span>
            <span />
          </div>

          {lineas.map((l, i) => (
            <div key={i} className="grid gap-1.5 mb-2 items-center" style={{ gridTemplateColumns: "1fr 100px 120px 120px 90px 90px 70px 32px" }}>
              <select value={l.cuenta} onChange={e => setLinea(i, { cuenta: e.target.value })}
                className="rounded px-2 py-1.5 text-xs" style={{ border: "1px solid #ede9e4", color: "#2a1f1a" }}>
                <option value="">— cuenta —</option>
                {CUENTAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={l.tipo} onChange={e => setLinea(i, { tipo: e.target.value as Linea["tipo"] })}
                className="rounded px-2 py-1.5 text-xs" style={{ border: "1px solid #ede9e4", color: "#2a1f1a" }}>
                <option value="personal">Personal</option>
                <option value="negocio">Negocio</option>
                <option value="ambos">Ambos</option>
              </select>
              <select value={l.categoria_negocio} onChange={e => setLinea(i, { categoria_negocio: e.target.value })}
                className="rounded px-2 py-1.5 text-xs" style={{ border: "1px solid #ede9e4", color: "#2a1f1a" }}
                disabled={l.tipo === "personal"}>
                <option value="">—</option>
                {CATS_NEGOCIO.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={l.categoria_personal} onChange={e => setLinea(i, { categoria_personal: e.target.value })}
                className="rounded px-2 py-1.5 text-xs" style={{ border: "1px solid #ede9e4", color: "#2a1f1a" }}
                disabled={l.tipo === "negocio"}>
                <option value="">—</option>
                {CATEGORIAS_PERSONAL.map(c => <option key={c} value={c}>{c.replace(/^\d+\.\s*/, "")}</option>)}
              </select>
              <input type="number" min="0" step="0.01" value={l.debe} onChange={e => setLinea(i, { debe: e.target.value })}
                placeholder="0"
                className="rounded px-2 py-1.5 text-xs text-right tabular-nums"
                style={{ border: "1px solid #ede9e4", color: "#2a1f1a" }} />
              <input type="number" min="0" step="0.01" value={l.haber} onChange={e => setLinea(i, { haber: e.target.value })}
                placeholder="0"
                className="rounded px-2 py-1.5 text-xs text-right tabular-nums"
                style={{ border: "1px solid #ede9e4", color: "#2a1f1a" }} />
              <select value={l.moneda} onChange={e => setLinea(i, { moneda: e.target.value as "UYU" | "USD" })}
                className="rounded px-2 py-1.5 text-xs" style={{ border: "1px solid #ede9e4", color: "#2a1f1a" }}>
                <option value="UYU">UYU</option>
                <option value="USD">USD</option>
              </select>
              <button onClick={() => removeLinea(i)} disabled={lineas.length <= 2}
                className="flex items-center justify-center w-7 h-7 rounded hover:bg-red-50 disabled:opacity-30"
                title="Eliminar línea">
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              </button>
            </div>
          ))}

          <button onClick={addLinea}
            className="flex items-center gap-1 text-xs mt-2 px-3 py-1.5 rounded-lg transition-colors hover:bg-amber-50"
            style={{ color: "#d97706", border: "1px dashed #f59e0b" }}>
            <Plus className="w-3.5 h-3.5" /> Agregar línea
          </button>
        </div>

        {/* Totales + balance */}
        <div className="flex items-center justify-between pt-4" style={{ borderTop: "1px solid #f5f0eb" }}>
          <div className="flex gap-8 text-sm tabular-nums">
            <div>
              <span style={{ color: "#9c8a7e" }}>Total Debe: </span>
              <span className="font-semibold" style={{ color: "#2a1f1a" }}>{formatUYU(totalDebe)}</span>
            </div>
            <div>
              <span style={{ color: "#9c8a7e" }}>Total Haber: </span>
              <span className="font-semibold" style={{ color: "#2a1f1a" }}>{formatUYU(totalHaber)}</span>
            </div>
            {totalDebe > 0 && (
              <div className="flex items-center gap-1.5">
                {balanced
                  ? <><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="text-emerald-600 font-medium text-xs">Balanceado</span></>
                  : <><AlertCircle className="w-4 h-4 text-rose-500" /><span className="text-rose-600 font-medium text-xs">Diferencia: {formatUYU(diff)}</span></>
                }
              </div>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={!balanced || saving || !descripcion || !fecha}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
            style={{ background: balanced && descripcion ? "#d97706" : "#e5e0da", color: "#fff" }}
          >
            <Save className="w-4 h-4" />
            {saving ? "Guardando..." : "Guardar asiento"}
          </button>
        </div>

        {msg && (
          <div className={`mt-3 flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${msg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            {msg.type === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {msg.text}
          </div>
        )}
      </div>

      {/* Historial */}
      <div className="rounded-2xl bg-white p-6" style={{ border: "1px solid #ede9e4" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: "#5c4d45" }}>Historial de asientos</h2>
          <button onClick={loadHistorial} disabled={loadingHist}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors hover:bg-amber-50"
            style={{ color: "#d97706", border: "1px solid #f59e0b" }}>
            {loadingHist ? "Cargando..." : "Cargar historial"}
          </button>
        </div>

        {showHist && historial.length === 0 && (
          <p className="text-sm text-center py-6" style={{ color: "#b5a49a" }}>No hay asientos registrados</p>
        )}

        {historial.map(a => {
          const totalD = a.lineas.reduce((s, l) => s + l.debe, 0);
          const expanded = expandedId === a.id;
          return (
            <div key={a.id} className="mb-3 rounded-xl overflow-hidden" style={{ border: "1px solid #f5f0eb" }}>
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-amber-50/40"
                onClick={() => setExpandedId(expanded ? null : a.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium tabular-nums" style={{ color: "#b5a49a" }}>{a.fecha}</span>
                  <span className="text-sm font-medium" style={{ color: "#2a1f1a" }}>{a.descripcion}</span>
                  <span className="text-xs" style={{ color: "#9c8a7e" }}>{a.lineas.length} líneas</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums" style={{ color: "#d97706" }}>{formatUYU(totalD)}</span>
                  <button onClick={e => { e.stopPropagation(); handleDelete(a.id); }}
                    className="p-1 rounded hover:bg-red-50" title="Eliminar asiento">
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  </button>
                  {expanded ? <ChevronUp className="w-4 h-4 text-amber-500" /> : <ChevronDown className="w-4 h-4" style={{ color: "#b5a49a" }} />}
                </div>
              </div>

              {expanded && (
                <div className="px-4 pb-3" style={{ borderTop: "1px solid #f5f0eb" }}>
                  <table className="w-full text-xs mt-2">
                    <thead>
                      <tr style={{ color: "#9c8a7e" }}>
                        <th className="text-left pb-1 font-medium">Cuenta</th>
                        <th className="text-left pb-1 font-medium">Tipo</th>
                        <th className="text-left pb-1 font-medium">Categoría</th>
                        <th className="text-right pb-1 font-medium">Debe</th>
                        <th className="text-right pb-1 font-medium">Haber</th>
                        <th className="text-left pb-1 font-medium pl-2">Mon.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.lineas.map(l => (
                        <tr key={l.id} style={{ borderTop: "1px solid #f5f0eb" }}>
                          <td className="py-1.5 pr-2 font-medium" style={{ color: "#5c4d45" }}>{l.cuenta}</td>
                          <td className="py-1.5 pr-2" style={{ color: "#7a6a60" }}>{l.tipo}</td>
                          <td className="py-1.5 pr-2" style={{ color: "#7a6a60" }}>
                            {l.categoria_negocio || l.categoria_personal || "—"}
                          </td>
                          <td className="py-1.5 text-right tabular-nums font-medium" style={{ color: l.debe > 0 ? "#2a1f1a" : "#d1c8c2" }}>
                            {l.debe > 0 ? formatUYU(l.debe) : "—"}
                          </td>
                          <td className="py-1.5 text-right tabular-nums font-medium" style={{ color: l.haber > 0 ? "#2a1f1a" : "#d1c8c2" }}>
                            {l.haber > 0 ? formatUYU(l.haber) : "—"}
                          </td>
                          <td className="py-1.5 pl-2" style={{ color: "#9c8a7e" }}>{l.moneda}</td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: "2px solid #ede9e4" }}>
                        <td colSpan={3} className="pt-2 text-right font-semibold pr-2" style={{ color: "#7a6a60" }}>Totales</td>
                        <td className="pt-2 text-right tabular-nums font-bold" style={{ color: "#2a1f1a" }}>
                          {formatUYU(a.lineas.reduce((s, l) => s + l.debe, 0))}
                        </td>
                        <td className="pt-2 text-right tabular-nums font-bold" style={{ color: "#2a1f1a" }}>
                          {formatUYU(a.lineas.reduce((s, l) => s + l.haber, 0))}
                        </td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
