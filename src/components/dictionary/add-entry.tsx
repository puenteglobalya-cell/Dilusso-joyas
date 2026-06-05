"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Category } from "@/lib/database.types";
import { Plus, X } from "lucide-react";
import { BANCOS } from "@/lib/utils";

export function AddDictionaryEntry({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [tipo, setTipo] = useState<"negocio" | "personal">("negocio");
  const [categoria, setCategoria] = useState("");
  const [banco, setBanco] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!keyword.trim() || !categoria) return;
    setLoading(true);
    await fetch("/api/dictionary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: keyword.trim().toLowerCase(), tipo, categoria, banco: banco || null }),
    });
    setOpen(false);
    setKeyword("");
    setCategoria("");
    setLoading(false);
    window.location.reload();
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        <Plus className="w-4 h-4 mr-2" /> Agregar entrada
      </Button>
    );
  }

  const filteredCategories = categories.filter((c) => c.type === tipo);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setOpen(false)}>
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Nueva entrada</h2>
          <button onClick={() => setOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Keyword</label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="ej: supermercado, alquiler, ose..."
              className="w-full text-sm border rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Tipo</label>
            <select value={tipo} onChange={(e) => { setTipo(e.target.value as "negocio" | "personal"); setCategoria(""); }} className="w-full text-sm border rounded-md px-3 py-2">
              <option value="negocio">Negocio</option>
              <option value="personal">Personal</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Categoría</label>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full text-sm border rounded-md px-3 py-2">
              <option value="">Seleccionar...</option>
              {filteredCategories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Banco (opcional)</label>
            <select value={banco} onChange={(e) => setBanco(e.target.value)} className="w-full text-sm border rounded-md px-3 py-2">
              <option value="">Todos los bancos</option>
              {BANCOS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <Button onClick={handleSave} disabled={!keyword.trim() || !categoria || loading} className="flex-1">
            {loading ? "Guardando..." : "Guardar"}
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
        </div>
      </div>
    </div>
  );
}
