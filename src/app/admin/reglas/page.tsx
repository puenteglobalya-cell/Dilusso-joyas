"use client";

import { useState, useEffect, useCallback } from "react";

interface Regla {
  id: string;
  activa: boolean;
  descripcion_regla: string | null;
  keyword: string | null;
  banco: string | null;
  importe_min: number | null;
  importe_max: number | null;
  dia_mes_min: number | null;
  dia_mes_max: number | null;
  moneda: string | null;
  tipo: "negocio" | "personal";
  categoria_negocio: string | null;
  categoria_personal: string | null;
}

const BANCOS = ["BBVA", "Itaú", "Scotiabank", "OCA", "Santander", "BROU", "Itau-Card", "Efectivo"];
const EMPTY: Partial<Regla> = {
  activa: true, tipo: "negocio", moneda: "UYU",
  keyword: "", banco: "", descripcion_regla: "",
  importe_min: undefined, importe_max: undefined,
  dia_mes_min: undefined, dia_mes_max: undefined,
  categoria_negocio: "", categoria_personal: "",
};

function ReglaBadge({ regla }: { regla: Regla }) {
  const parts = [];
  if (regla.keyword) parts.push(`"${regla.keyword}"`);
  if (regla.banco) parts.push(regla.banco);
  if (regla.importe_min !== null || regla.importe_max !== null) {
    const min = regla.importe_min?.toLocaleString("es-UY") ?? "0";
    const max = regla.importe_max?.toLocaleString("es-UY") ?? "∞";
    parts.push(`$${min}–$${max}`);
  }
  if (regla.dia_mes_min !== null || regla.dia_mes_max !== null) {
    parts.push(`día ${regla.dia_mes_min ?? 1}–${regla.dia_mes_max ?? 31}`);
  }
  return <span style={{ color: "#8C857B" }}>{parts.join(" · ") || "Sin criterios"}</span>;
}

export default function ReglasPage() {
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Partial<Regla> | null>(null);
  const [saving, setSaving] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [aplicadoMsg, setAplicadoMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/reglas");
    const data = await res.json();
    setReglas(data.reglas ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    const isNew = !editando?.id;
    const url = isNew ? "/api/admin/reglas" : `/api/admin/reglas/${editando!.id}`;
    const method = isNew ? "POST" : "PATCH";
    // Clean empty strings to null
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(editando ?? {})) {
      body[k] = v === "" ? null : v;
    }
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setEditando(null);
    setSaving(false);
    load();
  }

  async function toggleActiva(regla: Regla) {
    await fetch(`/api/admin/reglas/${regla.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activa: !regla.activa }),
    });
    load();
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar esta regla?")) return;
    await fetch(`/api/admin/reglas/${id}`, { method: "DELETE" });
    load();
  }

  async function aplicarTodas() {
    setAplicando(true);
    setAplicadoMsg(null);
    const res = await fetch("/api/admin/reglas/aplicar", { method: "POST" });
    const data = await res.json();
    setAplicadoMsg(`${data.aplicados} movimiento${data.aplicados !== 1 ? "s" : ""} clasificado${data.aplicados !== 1 ? "s" : ""}`);
    setAplicando(false);
  }

  const f = editando ?? {};

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#2E2B2A" }}>Reglas de clasificación</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8C857B" }}>Automatizan la clasificación de movimientos por patrón</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={aplicarTodas}
            disabled={aplicando}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ background: "#586E50", color: "#fff", opacity: aplicando ? 0.6 : 1 }}
          >
            {aplicando ? "Aplicando..." : "Aplicar a sin clasificar"}
          </button>
          <button
            onClick={() => setEditando({ ...EMPTY })}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: "#C5A059", color: "#fff" }}
          >+ Nueva regla</button>
        </div>
      </div>

      {aplicadoMsg && (
        <div className="mb-4 px-4 py-2.5 rounded-xl text-sm" style={{ background: "#F0F5EE", color: "#586E50", border: "1px solid #586E5030" }}>
          ✓ {aplicadoMsg}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16" style={{ color: "#C4B5A0" }}>
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reglas.length === 0 ? (
        <div className="rounded-2xl py-16 text-center" style={{ background: "#FCFBFA", border: "1px solid #E6E1DA" }}>
          <p className="text-sm" style={{ color: "#8C857B" }}>Sin reglas todavía</p>
          <p className="text-xs mt-1" style={{ color: "#C4B5A0" }}>Las reglas se crean al vincular facturas o manualmente</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #E6E1DA" }}>
          {reglas.map((r, i) => (
            <div
              key={r.id}
              className="px-4 py-3 flex items-center gap-3"
              style={{ borderTop: i > 0 ? "1px solid #E6E1DA" : undefined, background: r.activa ? "#FCFBFA" : "#F8F6F4", opacity: r.activa ? 1 : 0.6 }}
            >
              {/* Toggle activa */}
              <button
                onClick={() => toggleActiva(r)}
                className="w-8 h-5 rounded-full transition-colors shrink-0"
                style={{ background: r.activa ? "#586E50" : "#E6E1DA" }}
                title={r.activa ? "Activa — click para desactivar" : "Inactiva — click para activar"}
              >
                <div className="w-3 h-3 bg-white rounded-full transition-transform mx-auto" style={{ transform: r.activa ? "translateX(6px)" : "translateX(-6px)" }} />
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium" style={{ color: "#2E2B2A" }}>
                    {r.descripcion_regla ?? "Sin nombre"}
                  </p>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      background: r.tipo === "negocio" ? "#586E5020" : "#946E6120",
                      color: r.tipo === "negocio" ? "#586E50" : "#946E61",
                    }}
                  >{r.tipo}</span>
                </div>
                <div className="text-xs mt-0.5">
                  <ReglaBadge regla={r} />
                  {(r.categoria_negocio || r.categoria_personal) && (
                    <span style={{ color: "#C5A059" }}> → {r.categoria_negocio ?? r.categoria_personal}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setEditando({ ...r })}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-white"
                  style={{ color: "#8C857B", border: "1px solid #E6E1DA" }}
                >Editar</button>
                <button
                  onClick={() => eliminar(r.id)}
                  className="px-2 py-1.5 rounded-lg text-xs transition-colors hover:bg-white"
                  style={{ color: "#C4B5A0", border: "1px solid #E6E1DA" }}
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editando !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: "#FCFBFA", border: "1px solid #E6E1DA" }}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "#E6E1DA" }}>
              <p className="font-semibold text-sm" style={{ color: "#2E2B2A" }}>
                {f.id ? "Editar regla" : "Nueva regla"}
              </p>
              <button onClick={() => setEditando(null)} style={{ color: "#C4B5A0" }}>✕</button>
            </div>

            <div className="p-5 space-y-4">
              {/* Nombre */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "#8C857B" }}>Nombre / descripción</label>
                <input
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ border: "1px solid #E6E1DA", background: "#fff", color: "#2E2B2A" }}
                  value={f.descripcion_regla ?? ""}
                  onChange={e => setEditando(p => ({ ...p!, descripcion_regla: e.target.value }))}
                  placeholder="Ej: Mapfre Seguros"
                />
              </div>

              <p className="text-xs font-semibold uppercase tracking-wider pt-1" style={{ color: "#8C857B" }}>Criterios de match</p>

              {/* Keyword */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "#8C857B" }}>Keyword en descripción</label>
                <input
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ border: "1px solid #E6E1DA", background: "#fff", color: "#2E2B2A" }}
                  value={f.keyword ?? ""}
                  onChange={e => setEditando(p => ({ ...p!, keyword: e.target.value }))}
                  placeholder="Ej: MAPFRE (vacío = ignorar)"
                />
              </div>

              {/* Banco + Moneda */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "#8C857B" }}>Banco</label>
                  <select
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ border: "1px solid #E6E1DA", background: "#fff", color: "#2E2B2A" }}
                    value={f.banco ?? ""}
                    onChange={e => setEditando(p => ({ ...p!, banco: e.target.value }))}
                  >
                    <option value="">Cualquiera</option>
                    {BANCOS.map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "#8C857B" }}>Moneda</label>
                  <select
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ border: "1px solid #E6E1DA", background: "#fff", color: "#2E2B2A" }}
                    value={f.moneda ?? "UYU"}
                    onChange={e => setEditando(p => ({ ...p!, moneda: e.target.value }))}
                  >
                    <option>UYU</option>
                    <option>USD</option>
                  </select>
                </div>
              </div>

              {/* Importe */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "#8C857B" }}>Importe mínimo</label>
                  <input
                    type="number" className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ border: "1px solid #E6E1DA", background: "#fff", color: "#2E2B2A" }}
                    value={f.importe_min ?? ""}
                    onChange={e => setEditando(p => ({ ...p!, importe_min: e.target.value ? parseFloat(e.target.value) : undefined }))}
                    placeholder="vacío = sin límite"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "#8C857B" }}>Importe máximo</label>
                  <input
                    type="number" className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ border: "1px solid #E6E1DA", background: "#fff", color: "#2E2B2A" }}
                    value={f.importe_max ?? ""}
                    onChange={e => setEditando(p => ({ ...p!, importe_max: e.target.value ? parseFloat(e.target.value) : undefined }))}
                    placeholder="vacío = sin límite"
                  />
                </div>
              </div>

              {/* Día del mes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "#8C857B" }}>Día del mes desde</label>
                  <input
                    type="number" min={1} max={31} className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ border: "1px solid #E6E1DA", background: "#fff", color: "#2E2B2A" }}
                    value={f.dia_mes_min ?? ""}
                    onChange={e => setEditando(p => ({ ...p!, dia_mes_min: e.target.value ? parseInt(e.target.value) : undefined }))}
                    placeholder="1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "#8C857B" }}>Día del mes hasta</label>
                  <input
                    type="number" min={1} max={31} className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ border: "1px solid #E6E1DA", background: "#fff", color: "#2E2B2A" }}
                    value={f.dia_mes_max ?? ""}
                    onChange={e => setEditando(p => ({ ...p!, dia_mes_max: e.target.value ? parseInt(e.target.value) : undefined }))}
                    placeholder="31"
                  />
                </div>
              </div>

              <p className="text-xs font-semibold uppercase tracking-wider pt-1" style={{ color: "#8C857B" }}>Clasificación a asignar</p>

              {/* Tipo */}
              <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid #E6E1DA" }}>
                {(["negocio","personal"] as const).map(t => (
                  <button key={t} onClick={() => setEditando(p => ({ ...p!, tipo: t }))}
                    className="flex-1 py-2 text-sm font-medium capitalize transition-colors"
                    style={{ background: f.tipo === t ? (t === "negocio" ? "#586E50" : "#946E61") : "#fff", color: f.tipo === t ? "#fff" : "#8C857B" }}
                  >{t}</button>
                ))}
              </div>

              {/* Categoría */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "#8C857B" }}>
                  Categoría {f.tipo === "negocio" ? "negocio" : "personal"}
                </label>
                <input
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ border: "1px solid #E6E1DA", background: "#fff", color: "#2E2B2A" }}
                  value={(f.tipo === "negocio" ? f.categoria_negocio : f.categoria_personal) ?? ""}
                  onChange={e => setEditando(p => ({
                    ...p!,
                    categoria_negocio: f.tipo === "negocio" ? e.target.value : p!.categoria_negocio,
                    categoria_personal: f.tipo === "personal" ? e.target.value : p!.categoria_personal,
                  }))}
                  placeholder="Ej: Seguros"
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t flex justify-end gap-2" style={{ borderColor: "#E6E1DA" }}>
              <button onClick={() => setEditando(null)} className="px-4 py-2 rounded-xl text-sm" style={{ color: "#8C857B" }}>Cancelar</button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: "#C5A059", color: "#fff", opacity: saving ? 0.6 : 1 }}
              >{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
