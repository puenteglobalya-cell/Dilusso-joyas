"use client";
import { useState, useRef, useEffect } from "react";
import { X, Save, BookMarked } from "lucide-react";

export interface ClassifyRow {
  id: string;
  descripcion: string | null;
  tipo: string | null;
  categoria_negocio: string | null;
  categoria_personal: string | null;
}

interface Props {
  row: ClassifyRow;
  anchor: { top: number; left: number };
  catsNegocio: string[];
  catsPersonal: string[];
  onCategoryCreated: (name: string, type: "negocio" | "personal") => void;
  onClose: () => void;
  onSaved: (updated: Partial<ClassifyRow & { clasificado: string }>) => void;
}

const TIPOS = ["negocio", "personal"];

export function ClassifyPopover({
  row, anchor, catsNegocio, catsPersonal, onCategoryCreated, onClose, onSaved,
}: Props) {
  const [tipo, setTipo] = useState(row.tipo ?? "");
  const [catNeg, setCatNeg] = useState(row.categoria_negocio ?? "");
  const [catPer, setCatPer] = useState(row.categoria_personal ?? "");
  const [keyword, setKeyword] = useState("");
  const [saving, setSaving] = useState(false);
  const [askDict, setAskDict] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save(guardarEnDiccionario: boolean) {
    setSaving(true);
    try {
      if (tipo === "negocio" && catNeg && !catsNegocio.includes(catNeg)) {
        await fetch("/api/admin/categorias", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: catNeg, type: "negocio" }),
        });
        onCategoryCreated(catNeg, "negocio");
      }
      if (tipo === "personal" && catPer && !catsPersonal.includes(catPer)) {
        await fetch("/api/admin/categorias", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: catPer, type: "personal" }),
        });
        onCategoryCreated(catPer, "personal");
      }

      const body = {
        id: row.id,
        clasificado: tipo ? "Si" : "No",
        tipo,
        categoria_negocio: catNeg,
        categoria_personal: catPer,
        ...(guardarEnDiccionario && keyword.trim()
          ? { guardar_regla: { keyword: keyword.trim() } }
          : {}),
      };
      const res = await fetch("/api/admin/clasificar-row", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.reglaError) alert(`Clasificación guardada, pero error al guardar en diccionario: ${data.reglaError}`);
        if (data.actualizados > 0) alert(`✓ También se clasificaron ${data.actualizados} movimientos similares`);
        onSaved({ tipo, categoria_negocio: catNeg, categoria_personal: catPer, clasificado: tipo ? "Si" : "No" });
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  const style: React.CSSProperties = {
    position: "fixed",
    top: Math.min(anchor.top, window.innerHeight - 380),
    left: Math.min(anchor.left, window.innerWidth - 340),
    zIndex: 50,
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div ref={ref} style={style} className="w-80 bg-white rounded-xl shadow-xl border p-4 z-50 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">Clasificar movimiento</p>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400 hover:text-gray-600" /></button>
        </div>

        <p className="text-xs text-gray-500 truncate" title={row.descripcion ?? ""}>{row.descripcion}</p>

        {!askDict ? (
          <>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
              <div className="flex gap-2">
                {TIPOS.map((t) => (
                  <button key={t} onClick={() => setTipo(t)}
                    className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors
                      ${tipo === t
                        ? t === "negocio" ? "bg-blue-100 border-blue-300 text-blue-700" : "bg-purple-100 border-purple-300 text-purple-700"
                        : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                    {t}
                  </button>
                ))}
                <button onClick={() => setTipo("")}
                  className={`px-2 py-1.5 text-xs rounded-lg border transition-colors ${tipo === "" ? "bg-gray-100 border-gray-300" : "border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
                  —
                </button>
              </div>
            </div>

            {tipo === "negocio" && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Categoría negocio <span className="text-gray-400">(podés escribir una nueva)</span></label>
                <input list="cp-cats-negocio" value={catNeg} onChange={(e) => setCatNeg(e.target.value)}
                  placeholder="Seleccionar o escribir…"
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand" />
                <datalist id="cp-cats-negocio">
                  {catsNegocio.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
            )}

            {tipo === "personal" && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Categoría personal <span className="text-gray-400">(podés escribir una nueva)</span></label>
                <input list="cp-cats-personal" value={catPer} onChange={(e) => setCatPer(e.target.value)}
                  placeholder="Seleccionar o escribir…"
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand" />
                <datalist id="cp-cats-personal">
                  {catsPersonal.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
            )}

            <button onClick={() => setAskDict(true)} disabled={saving}
              className="w-full py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-dark disabled:opacity-50 transition-colors">
              <Save className="w-3 h-3 inline mr-1" />Guardar
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-700 font-medium">
              ¿Querés guardar una regla en el diccionario para clasificar automáticamente?
            </p>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Keyword (parte del texto)</label>
              <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)}
                placeholder={`ej: ${(row.descripcion ?? "").slice(0, 20)}`}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => save(false)} disabled={saving}
                className="flex-1 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                Solo esta vez
              </button>
              <button onClick={() => save(true)} disabled={saving || !keyword.trim()}
                className="flex-1 py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-dark disabled:opacity-50 transition-colors">
                <BookMarked className="w-3 h-3 inline mr-1" />Guardar en diccionario
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
