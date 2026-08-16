"use client";
import { useState, useEffect, useCallback } from "react";
import { Upload, AlertTriangle, AlertCircle, Info, RefreshCw } from "lucide-react";

type ProductAlert = {
  tipo: string;
  severidad: "alta" | "media" | "baja";
  titulo: string;
  detalle: string;
  productos: { id: string; codigo_dl: string; nombre: string | null }[];
};

type Resumen = {
  stock_valor_total: number;
  margen_promedio_pct: number | null;
  margen_por_familia: { familia: string; n: number; margen_pct: number | null; valor_stock: number }[];
  concentracion_proveedores: { proveedor: string; n: number; costo_total: number; pct_del_total: number }[];
};

const SEVERIDAD_STYLE: Record<string, string> = {
  alta: "border-terracotta/40 bg-terracotta/10",
  media: "border-yellow-300 bg-yellow-50",
  baja: "border-gray-200 bg-surface",
};

const SEVERIDAD_ICON: Record<string, React.ReactNode> = {
  alta: <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />,
  media: <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />,
  baja: <Info className="w-4 h-4 text-subtle shrink-0 mt-0.5" />,
};

function money(n: number) {
  return n.toLocaleString("es-UY", { style: "currency", currency: "UYU", maximumFractionDigits: 0 });
}

const METALES = ["PLATA 925", "ORO 10K", "ORO 18K"] as const;

function MetalPricesBox({ onSaved }: { onSaved: () => void }) {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/metal-prices").then(r => r.json()).then(d => {
      const map: Record<string, string> = {};
      for (const p of d.prices ?? []) map[p.metal] = String(p.precio_uyu_gramo);
      setPrices(map);
    });
  }, []);

  async function save(metal: string) {
    const valor = parseFloat(prices[metal]);
    if (!valor || valor <= 0) return;
    setSaving(metal);
    try {
      await fetch("/api/admin/metal-prices", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metal, precio_uyu_gramo: valor }),
      });
      onSaved();
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="bg-white rounded-xl border p-5">
      <h3 className="text-sm font-semibold mb-1">Cotización de metal (precio de reposición)</h3>
      <p className="text-xs text-muted mb-3">Cargá el precio actual del gramo en UYU para detectar productos cuyo margen se erosiona si hay que reponer stock hoy.</p>
      <div className="grid grid-cols-3 gap-3">
        {METALES.map(metal => (
          <div key={metal} className="flex flex-col gap-1">
            <label className="text-xs text-subtle">{metal} ($/g)</label>
            <div className="flex gap-1">
              <input
                type="number"
                value={prices[metal] ?? ""}
                onChange={e => setPrices(p => ({ ...p, [metal]: e.target.value }))}
                className="w-full h-8 px-2 border border-gray-200 rounded text-sm"
              />
              <button
                onClick={() => save(metal)}
                disabled={saving === metal}
                className="h-8 px-2 text-xs bg-brand hover:bg-brand-dark text-white rounded disabled:opacity-50"
              >
                {saving === metal ? "…" : "Guardar"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UploadBox({ tipo, label }: { tipo: "joya" | "reloj"; label: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ upserted?: number; parsed?: number; error?: string } | null>(null);

  async function handleImport() {
    if (!file) return;
    setLoading(true); setResult(null);
    const fd = new FormData();
    fd.append("file", file); fd.append("tipo", tipo);
    try {
      const res = await fetch("/api/admin/import-productos", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setResult(data);
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : "Error desconocido" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border p-5 flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{label}</h3>
      <label className="flex flex-col items-center justify-center h-20 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:bg-surface">
        {file ? (
          <p className="text-xs font-medium text-ink truncate max-w-[200px] px-2">{file.name}</p>
        ) : (
          <div className="text-center">
            <Upload className="w-4 h-4 text-subtle mx-auto mb-1" />
            <p className="text-xs text-muted">Seleccionar .xlsx</p>
          </div>
        )}
        <input type="file" className="hidden" accept=".xls,.xlsx" onChange={e => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <button
        onClick={handleImport}
        disabled={!file || loading}
        className="h-9 bg-brand hover:bg-brand-dark text-white text-sm font-semibold rounded-lg disabled:opacity-50"
      >
        {loading ? "Importando…" : "Importar"}
      </button>
      {result?.error && <p className="text-xs text-red-600">{result.error}</p>}
      {result?.upserted != null && (
        <p className="text-xs text-olive">✓ {result.upserted} de {result.parsed} productos cargados/actualizados</p>
      )}
    </div>
  );
}

export function ProductosPanel() {
  const [alertas, setAlertas] = useState<ProductAlert[] | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [totalProductos, setTotalProductos] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/productos-alertas");
      const data = await res.json();
      setAlertas(data.alertas ?? []);
      setResumen(data.resumen ?? null);
      setTotalProductos(data.total_productos ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggle(i: number) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <UploadBox tipo="joya" label="Catálogo de Joyas (SISTEMA_JOYAS.xlsx)" />
        <UploadBox tipo="reloj" label="Catálogo de Relojes (SISTEMA_RELOJES.xlsx)" />
      </div>

      <MetalPricesBox onSaved={load} />

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Diagnóstico de gestión</h2>
        <button onClick={load} disabled={loading} className="flex items-center gap-1 text-xs text-muted hover:text-ink">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {totalProductos === 0 && !loading && (
        <p className="text-sm text-muted">Todavía no hay productos cargados. Subí los dos Excel para empezar.</p>
      )}

      {resumen && totalProductos > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-subtle">Productos cargados</p>
            <p className="text-xl font-bold mt-1">{totalProductos}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-subtle">Valor de stock total</p>
            <p className="text-xl font-bold mt-1">{money(resumen.stock_valor_total)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-subtle">Margen promedio</p>
            <p className="text-xl font-bold mt-1">{resumen.margen_promedio_pct != null ? `${resumen.margen_promedio_pct}%` : "—"}</p>
          </div>
        </div>
      )}

      {resumen && resumen.margen_por_familia.length > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <h3 className="text-sm font-semibold mb-3">Margen y stock por familia</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-subtle border-b">
                <th className="pb-2 font-medium">Familia</th>
                <th className="pb-2 font-medium text-right">Productos</th>
                <th className="pb-2 font-medium text-right">Margen</th>
                <th className="pb-2 font-medium text-right">Valor stock</th>
              </tr>
            </thead>
            <tbody>
              {resumen.margen_por_familia.map(f => (
                <tr key={f.familia} className="border-b border-gray-50">
                  <td className="py-1.5">{f.familia}</td>
                  <td className="py-1.5 text-right">{f.n}</td>
                  <td className="py-1.5 text-right">{f.margen_pct != null ? `${f.margen_pct}%` : "—"}</td>
                  <td className="py-1.5 text-right">{money(f.valor_stock)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resumen && resumen.concentracion_proveedores.length > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <h3 className="text-sm font-semibold mb-3">Concentración de compras por proveedor</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-subtle border-b">
                <th className="pb-2 font-medium">Proveedor</th>
                <th className="pb-2 font-medium text-right">Productos</th>
                <th className="pb-2 font-medium text-right">% del costo total</th>
              </tr>
            </thead>
            <tbody>
              {resumen.concentracion_proveedores.slice(0, 10).map(p => (
                <tr key={p.proveedor} className="border-b border-gray-50">
                  <td className="py-1.5">{p.proveedor}</td>
                  <td className="py-1.5 text-right">{p.n}</td>
                  <td className="py-1.5 text-right">{p.pct_del_total}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {alertas && alertas.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Alertas ({alertas.length})</h3>
          <div className="space-y-2">
            {alertas.map((a, i) => (
              <div key={i} className={`border rounded-lg p-3 ${SEVERIDAD_STYLE[a.severidad]}`}>
                <button className="flex gap-2 w-full text-left" onClick={() => toggle(i)}>
                  {SEVERIDAD_ICON[a.severidad]}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink">{a.titulo}</p>
                    <p className="text-xs text-muted mt-0.5">{a.detalle}</p>
                  </div>
                </button>
                {expanded.has(i) && a.productos.length > 0 && (
                  <ul className="mt-2 ml-6 text-xs text-subtle space-y-0.5">
                    {a.productos.map(p => (
                      <li key={p.id}>{p.codigo_dl} — {p.nombre ?? "sin nombre"}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {alertas && alertas.length === 0 && totalProductos > 0 && (
        <p className="text-sm text-olive">✓ Sin alertas detectadas en {totalProductos} productos.</p>
      )}
    </div>
  );
}
