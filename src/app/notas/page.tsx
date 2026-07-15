"use client";
import { useState, useEffect } from "react";
import { Plus, Check, Trash2, RotateCcw } from "lucide-react";

interface Nota {
  id: string;
  contenido: string;
  categoria: string;
  resuelta: boolean;
  created_at: string;
}

const CATEGORIAS = [
  { value: "mejora", label: "Mejora", color: "bg-brand-light text-brand-dark" },
  { value: "bug", label: "Bug", color: "bg-red-100 text-red-700" },
  { value: "pendiente", label: "Pendiente", color: "bg-orange-100 text-orange-700" },
  { value: "general", label: "General", color: "bg-gray-100 text-ink" },
];

function catStyle(cat: string) {
  return CATEGORIAS.find(c => c.value === cat)?.color ?? "bg-gray-100 text-ink";
}
function catLabel(cat: string) {
  return CATEGORIAS.find(c => c.value === cat)?.label ?? cat;
}

export default function NotasPage() {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState("");
  const [categoria, setCategoria] = useState("general");
  const [saving, setSaving] = useState(false);
  const [mostrarResueltas, setMostrarResueltas] = useState(false);

  useEffect(() => {
    fetch("/api/admin/notas").then(r => r.json()).then(setNotas).finally(() => setLoading(false));
  }, []);

  async function agregar() {
    if (!texto.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/notas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contenido: texto.trim(), categoria }),
    });
    const nueva = await res.json();
    setNotas(prev => [nueva, ...prev]);
    setTexto("");
    setSaving(false);
  }

  async function toggleResuelta(nota: Nota) {
    const nueva = !nota.resuelta;
    setNotas(prev => prev.map(n => n.id === nota.id ? { ...n, resuelta: nueva } : n));
    await fetch("/api/admin/notas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: nota.id, resuelta: nueva }),
    });
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar esta nota?")) return;
    setNotas(prev => prev.filter(n => n.id !== id));
    await fetch("/api/admin/notas", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  const visibles = notas.filter(n => mostrarResueltas || !n.resuelta);
  const pendientes = notas.filter(n => !n.resuelta).length;

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Notas y mejoras</h1>
          <p className="text-sm text-muted mt-1">{pendientes} pendientes · {notas.length} total</p>
        </div>
        <button
          onClick={() => setMostrarResueltas(v => !v)}
          className="text-xs text-muted hover:text-slate-700 underline"
        >
          {mostrarResueltas ? "Ocultar resueltas" : "Ver resueltas"}
        </button>
      </div>

      {/* Nueva nota */}
      <div className="bg-white rounded-xl border p-4 mb-6 space-y-3">
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && e.metaKey) agregar(); }}
          placeholder="Escribí una nota, idea o mejora… (⌘Enter para guardar)"
          rows={3}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand resize-none"
        />
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {CATEGORIAS.map(c => (
              <button
                key={c.value}
                onClick={() => setCategoria(c.value)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                  categoria === c.value ? c.color + " ring-2 ring-offset-1 ring-current" : "bg-gray-100 text-muted hover:bg-gray-200"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <button
            onClick={agregar}
            disabled={saving || !texto.trim()}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-xs font-medium rounded-lg hover:bg-brand-dark disabled:opacity-50 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-sm text-subtle text-center py-8">Cargando…</p>
      ) : visibles.length === 0 ? (
        <div className="text-center py-12 text-subtle">
          <p className="text-sm">{mostrarResueltas ? "Sin notas" : "No hay notas pendientes"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibles.map(nota => (
            <div
              key={nota.id}
              className={`bg-white rounded-xl border p-4 flex gap-3 transition-opacity ${nota.resuelta ? "opacity-50" : ""}`}
            >
              <button
                onClick={() => toggleResuelta(nota)}
                className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  nota.resuelta
                    ? "bg-olive/100 border-green-500 text-white"
                    : "border-gray-300 hover:border-green-400"
                }`}
              >
                {nota.resuelta ? <Check className="w-3 h-3" /> : null}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${nota.resuelta ? "line-through text-subtle" : "text-slate-800"} whitespace-pre-wrap`}>
                  {nota.contenido}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catStyle(nota.categoria)}`}>
                    {catLabel(nota.categoria)}
                  </span>
                  <span className="text-xs text-subtle">
                    {new Date(nota.created_at).toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {nota.resuelta && (
                  <button onClick={() => toggleResuelta(nota)} className="text-slate-300 hover:text-muted transition-colors" title="Reabrir">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => eliminar(nota.id)} className="text-slate-300 hover:text-red-400 transition-colors" title="Eliminar">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
