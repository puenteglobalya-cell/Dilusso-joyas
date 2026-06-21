"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { X, Save, BookMarked, RotateCcw } from "lucide-react";
import { useDebounce } from "@/lib/use-debounce";

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
  userEmail?: string;
  onCategoryCreated: (name: string, type: "negocio" | "personal") => void;
  onClose: () => void;
  onSaved: (updated: Partial<ClassifyRow & { clasificado: string }>) => void;
  // Optional: called if user undoes the save
  onUndo?: (id: string) => void;
}

const TIPOS = ["negocio", "personal"];

interface ToastState {
  message: string;
  onUndo?: () => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

export function ClassifyPopover({
  row, anchor, catsNegocio, catsPersonal, userEmail,
  onCategoryCreated, onClose, onSaved, onUndo,
}: Props) {
  const [tipo, setTipo] = useState(row.tipo ?? "");
  const [catNeg, setCatNeg] = useState(row.categoria_negocio ?? "");
  const [catPer, setCatPer] = useState(row.categoria_personal ?? "");
  const [keyword, setKeyword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [askDict, setAskDict] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [keywordPreview, setKeywordPreview] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const debouncedKeyword = useDebounce(keyword, 400);

  // Preview how many rows match the keyword
  useEffect(() => {
    if (!debouncedKeyword.trim() || debouncedKeyword.length < 2) { setKeywordPreview(null); return; }
    fetch(`/api/admin/preview-regla?keyword=${encodeURIComponent(debouncedKeyword)}`)
      .then(r => r.json())
      .then(d => setKeywordPreview(d.count ?? 0))
      .catch(() => setKeywordPreview(null));
  }, [debouncedKeyword]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Dismiss toast and clear its timeout
  const dismissToast = useCallback(() => {
    setToast(prev => { if (prev) clearTimeout(prev.timeoutId); return null; });
  }, []);

  function showToast(message: string, undoFn?: () => void) {
    setToast(prev => { if (prev) clearTimeout(prev.timeoutId); return null; });
    const timeoutId = setTimeout(() => setToast(null), 5000);
    setToast({ message, onUndo: undoFn, timeoutId });
  }

  async function save(guardarEnDiccionario: boolean) {
    setSaving(true);
    setSaveError(null);
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
        descripcion: row.descripcion ?? undefined,
        clasificado: tipo ? "Si" : "No",
        tipo,
        categoria_negocio: catNeg,
        categoria_personal: catPer,
        usuario_email: userEmail,
        prev_tipo: row.tipo,
        prev_cat_negocio: row.categoria_negocio,
        prev_cat_personal: row.categoria_personal,
        ...(guardarEnDiccionario && keyword.trim()
          ? { guardar_regla: { keyword: keyword.trim() } }
          : {}),
      };
      const res = await fetch("/api/admin/clasificar-row", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setSaveError(data.error ?? "Error al guardar. Intentá de nuevo.");
        return;
      }

      const prevTipo = row.tipo;
      const prevCatNeg = row.categoria_negocio;
      const prevCatPer = row.categoria_personal;

      // Build undo function (only reverts this single row)
      const undoFn = onUndo ? async () => {
        await fetch("/api/admin/clasificar-row", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: row.id,
            descripcion: row.descripcion ?? undefined,
            clasificado: prevTipo ? "Si" : "No",
            tipo: prevTipo ?? "",
            categoria_negocio: prevCatNeg ?? "",
            categoria_personal: prevCatPer ?? "",
            usuario_email: userEmail,
          }),
        });
        onUndo(row.id);
        dismissToast();
      } : undefined;

      let msg = "Clasificación guardada.";
      if (data.actualizados > 0) msg += ` También se clasificaron ${data.actualizados} similares.`;
      if (data.reglaError) msg += ` (error al guardar en diccionario)`;

      onSaved({ tipo, categoria_negocio: catNeg, categoria_personal: catPer, clasificado: tipo ? "Si" : "No" });
      setSaved(true);
      setSavedMsg(msg);
      // Close after a brief moment so the user sees confirmation
      setTimeout(() => {
        onClose();
        showToast(msg, undoFn);
      }, 1000);
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
      {/* Toast — rendered outside popover so it persists after close */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg">
          <span>{toast.message}</span>
          {toast.onUndo && (
            <button
              onClick={toast.onUndo}
              className="flex items-center gap-1 text-yellow-300 font-semibold hover:text-yellow-200 shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />Deshacer
            </button>
          )}
          <button onClick={dismissToast} className="text-subtle hover:text-white shrink-0"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div ref={ref} style={style} className="w-80 bg-white rounded-xl shadow-xl border p-4 z-50 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">Clasificar movimiento</p>
          <button onClick={onClose}><X className="w-4 h-4 text-subtle hover:text-ink" /></button>
        </div>

        <p className="text-xs text-muted truncate" title={row.descripcion ?? ""}>{row.descripcion}</p>

        {saved ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2 text-olive">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm font-semibold">Guardado</p>
            <p className="text-xs text-muted text-center">{savedMsg}</p>
          </div>
        ) : saveError ? (
          <div className="rounded-lg bg-terracotta/10 border border-terracotta/30 px-3 py-2 text-xs text-red-700">
            {saveError}
            <button className="ml-2 underline" onClick={() => setSaveError(null)}>Reintentar</button>
          </div>
        ) : null}

        {!saved && !askDict && (
          <>
            <div>
              <label className="text-xs text-muted mb-1 block">Tipo</label>
              <div className="flex gap-2">
                {TIPOS.map((t) => (
                  <button key={t} onClick={() => setTipo(t)}
                    className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors
                      ${tipo === t
                        ? t === "negocio" ? "bg-brand-light border-brand text-brand-dark" : "bg-bronze/10 border-bronze/30 text-bronze"
                        : "border-gray-200 text-muted hover:bg-surface"}`}>
                    {t}
                  </button>
                ))}
                <button onClick={() => setTipo("")}
                  className={`px-2 py-1.5 text-xs rounded-lg border transition-colors ${tipo === "" ? "bg-gray-100 border-gray-300" : "border-gray-200 text-subtle hover:bg-surface"}`}>
                  —
                </button>
              </div>
            </div>

            {tipo === "negocio" && (
              <div>
                <label className="text-xs text-muted mb-1 block">Categoría negocio <span className="text-subtle">(podés escribir una nueva)</span></label>
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
                <label className="text-xs text-muted mb-1 block">Categoría personal <span className="text-subtle">(podés escribir una nueva)</span></label>
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
        )}
        {!saved && askDict && (
          <div className="space-y-3">
            <p className="text-xs text-ink font-medium">
              ¿Querés guardar una regla en el diccionario para clasificar automáticamente?
            </p>
            <div>
              <label className="text-xs text-muted mb-1 block">Keyword (parte del texto)</label>
              <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)}
                placeholder={`ej: ${(row.descripcion ?? "").slice(0, 20)}`}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand" />
              {keywordPreview !== null && keyword.length >= 2 && (
                <p className={`text-[11px] mt-1 ${keywordPreview > 0 ? "text-orange-600" : "text-olive"}`}>
                  {keywordPreview > 0
                    ? `⚠ Esta keyword clasificará ${keywordPreview} movimiento${keywordPreview !== 1 ? "s" : ""} sin clasificar`
                    : "✓ No hay movimientos sin clasificar que matcheen esta keyword"}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => save(false)} disabled={saving}
                className="flex-1 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-surface disabled:opacity-50 transition-colors">
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
