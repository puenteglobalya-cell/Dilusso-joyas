"use client";
import { useState, useEffect } from "react";
import { Pencil, Trash2, Merge, Plus, Check, X } from "lucide-react";

interface Cat { name: string; type: "negocio" | "personal"; uso: number }

export function CategoriasPanel() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"negocio" | "personal">("negocio");
  const [editId, setEditId] = useState<string | null>(null);   // "name|type"
  const [editVal, setEditVal] = useState("");
  const [mergeFrom, setMergeFrom] = useState<Cat | null>(null);
  const [mergeTo, setMergeTo] = useState("");
  const [newName, setNewName] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/categorias-manage");
    const data = await res.json();
    setCats(data);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function flash(text: string, ok: boolean) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3500);
  }

  async function handleRename(cat: Cat) {
    if (!editVal.trim() || editVal.trim() === cat.name) { setEditId(null); return; }
    const res = await fetch("/api/admin/categorias-manage", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: cat.name, to: editVal.trim(), type: cat.type }),
    });
    const data = await res.json();
    if (data.ok) { flash(`✓ Renombrada. ${data.updated} movimientos actualizados.`, true); load(); }
    else flash(data.error ?? "Error", false);
    setEditId(null);
  }

  async function handleDelete(cat: Cat) {
    if (!confirm(`¿Eliminar categoría "${cat.name}"? Los ${cat.uso} movimientos quedarán sin clasificar.`)) return;
    const res = await fetch("/api/admin/categorias-manage", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: cat.name, type: cat.type }),
    });
    const data = await res.json();
    if (data.ok) { flash(`✓ Eliminada. ${data.cleared} movimientos des-clasificados.`, true); load(); }
    else flash(data.error ?? "Error", false);
  }

  async function handleMerge() {
    if (!mergeFrom || !mergeTo.trim() || mergeTo.trim() === mergeFrom.name) return;
    const res = await fetch("/api/admin/categorias-manage", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: mergeFrom.name, to: mergeTo.trim(), type: mergeFrom.type }),
    });
    const data = await res.json();
    if (data.ok) { flash(`✓ Unificada en "${mergeTo}". ${data.updated} movimientos actualizados.`, true); load(); }
    else flash(data.error ?? "Error", false);
    setMergeFrom(null); setMergeTo("");
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    const res = await fetch("/api/admin/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), type: tab }),
    });
    const data = await res.json();
    if (data.ok) { flash(`✓ Categoría creada.`, true); load(); setNewName(""); }
    else flash(data.error ?? "Error", false);
  }

  const visible = cats.filter(c => c.type === tab).sort((a, b) => b.uso - a.uso);
  const otherCats = cats.filter(c => c.type === (mergeFrom?.type ?? tab));

  return (
    <div className="p-6">
      {msg && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm font-medium ${msg.ok ? "bg-olive/10 text-olive border border-olive/30" : "bg-terracotta/10 text-red-700 border border-terracotta/30"}`}>
          {msg.text}
        </div>
      )}

      {/* Merge modal */}
      {mergeFrom && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 w-96">
            <h3 className="font-bold mb-1">Unificar categoría</h3>
            <p className="text-sm text-muted mb-4">
              Todos los movimientos de <strong>"{mergeFrom.name}"</strong> ({mergeFrom.uso}) se moverán a la categoría destino.
            </p>
            <label className="text-xs font-medium text-ink block mb-1">Categoría destino</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
              value={mergeTo}
              onChange={e => setMergeTo(e.target.value)}
            >
              <option value="">— Seleccioná —</option>
              {otherCats.filter(c => c.name !== mergeFrom.name).map(c => (
                <option key={c.name} value={c.name}>{c.name} ({c.uso})</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setMergeFrom(null); setMergeTo(""); }} className="px-4 py-2 text-sm rounded-lg border hover:bg-surface">Cancelar</button>
              <button onClick={handleMerge} disabled={!mergeTo} className="px-4 py-2 text-sm rounded-lg bg-brand text-white disabled:opacity-50 hover:bg-brand/90">Unificar</button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["negocio", "personal"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-brand text-white" : "bg-slate-100 text-ink hover:bg-slate-200"}`}>
            {t === "negocio" ? "Negocio" : "Personal"} ({cats.filter(c => c.type === t).length})
          </button>
        ))}
      </div>

      {/* New category */}
      <div className="flex gap-2 mb-4">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleCreate()}
          placeholder="Nueva categoría…"
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
        />
        <button onClick={handleCreate} disabled={!newName.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-brand/90">
          <Plus className="w-3.5 h-3.5" /> Agregar
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-subtle text-sm">Cargando…</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted">Categoría</th>
                <th className="text-right px-4 py-3 font-medium text-muted">Movimientos</th>
                <th className="px-4 py-3 font-medium text-muted text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map(cat => {
                const key = `${cat.name}|${cat.type}`;
                const isEditing = editId === key;
                return (
                  <tr key={key} className="hover:bg-surface group">
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={editVal}
                            onChange={e => setEditVal(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") handleRename(cat); if (e.key === "Escape") setEditId(null); }}
                            className="border rounded px-2 py-1 text-sm flex-1"
                          />
                          <button onClick={() => handleRename(cat)} className="text-olive hover:text-olive"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditId(null)} className="text-subtle hover:text-ink"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <span className="font-medium">{cat.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {cat.uso > 0 ? (
                        <span className="text-slate-700">{cat.uso.toLocaleString()}</span>
                      ) : (
                        <span className="text-slate-300">0</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditId(key); setEditVal(cat.name); }}
                          title="Renombrar"
                          className="p-1.5 rounded hover:bg-blue-50 text-brand hover:text-brand-dark"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { setMergeFrom(cat); setMergeTo(""); }}
                          title="Unificar con otra"
                          className="p-1.5 rounded hover:bg-amber-50 text-amber-600 hover:text-amber-700"
                        >
                          <Merge className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(cat)}
                          title={cat.uso > 0 ? `Eliminar (${cat.uso} movimientos quedarán sin clasificar)` : "Eliminar"}
                          className="p-1.5 rounded hover:bg-terracotta/10 text-red-500 hover:text-terracotta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-subtle">Sin categorías</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
