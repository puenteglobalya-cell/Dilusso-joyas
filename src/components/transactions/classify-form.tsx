"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Category } from "@/lib/database.types";

interface Props {
  transactionId: string;
  detalle: string;
  banco: string;
  categories: Category[];
}

export function ClassifyForm({ transactionId, detalle, banco, categories }: Props) {
  const [tipo, setTipo] = useState<"negocio" | "personal">("negocio");
  const [categoria, setCategoria] = useState("");
  const [saveToDict, setSaveToDict] = useState(true);
  const [keyword, setKeyword] = useState(() => {
    // Pre-fill keyword with first meaningful words of detalle
    const words = detalle.split(/\s+/).slice(0, 3).join(" ");
    return words;
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const filteredCategories = categories.filter((c) => c.type === tipo);

  async function handleSubmit() {
    setLoading(true);
    try {
      await fetch("/api/transactions/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId,
          tipo,
          categoria,
          saveToDict,
          keyword,
          banco: saveToDict ? banco : null,
        }),
      });
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return <p className="text-sm text-olive font-medium">✓ Clasificada correctamente</p>;
  }

  return (
    <div className="flex flex-wrap gap-2 items-end">
      <select
        value={tipo}
        onChange={(e) => { setTipo(e.target.value as "negocio" | "personal"); setCategoria(""); }}
        className="text-xs border rounded-md px-2 py-1.5 bg-white"
      >
        <option value="negocio">Negocio</option>
        <option value="personal">Personal</option>
      </select>

      <select
        value={categoria}
        onChange={(e) => setCategoria(e.target.value)}
        className="text-xs border rounded-md px-2 py-1.5 bg-white min-w-32"
      >
        <option value="">Seleccionar categoría</option>
        {filteredCategories.map((c) => (
          <option key={c.id} value={c.name}>{c.name}</option>
        ))}
      </select>

      <label className="flex items-center gap-1.5 text-xs text-ink cursor-pointer">
        <input
          type="checkbox"
          checked={saveToDict}
          onChange={(e) => setSaveToDict(e.target.checked)}
          className="rounded"
        />
        Guardar en diccionario
      </label>

      {saveToDict && (
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Keyword..."
          className="text-xs border rounded-md px-2 py-1.5 bg-white w-40"
        />
      )}

      <Button size="sm" onClick={handleSubmit} disabled={!categoria || loading}>
        {loading ? "..." : "Clasificar"}
      </Button>
    </div>
  );
}
