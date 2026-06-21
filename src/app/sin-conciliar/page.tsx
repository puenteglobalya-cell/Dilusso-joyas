"use client";
import { useState, useEffect, useMemo } from "react";
import { formatUYU, formatDate } from "@/lib/utils";
import { ArrowUp, ArrowDown, ArrowUpDown, CheckSquare, X, Save } from "lucide-react";
import { ClassifyPopover } from "@/components/bank/ClassifyPopover";
import { NoteCell } from "@/components/bank/NoteCell";

interface BSRow {
  id: string; banco: string; fecha: string; descripcion: string | null;
  debito: number | null; credito: number | null; importe_uyu: number | null;
  moneda: string; tipo: string | null; categoria_negocio: string | null;
  categoria_personal: string | null; clasificado: string | null; nota: string | null;
}

function rowImporteUYU(r: BSRow): number {
  if (r.moneda === "USD") return Math.abs(r.importe_uyu ?? 0);
  return (r.debito ?? 0) + (r.credito ?? 0);
}

type SortKey = "fecha" | "banco" | "descripcion" | "monto";

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 opacity-30 ml-1 inline" />;
  return dir === "asc"
    ? <ArrowUp className="w-3 h-3 ml-1 inline text-brand" />
    : <ArrowDown className="w-3 h-3 ml-1 inline text-brand" />;
}

interface EditState { row: BSRow; anchor: { top: number; left: number } }

export default function SinConciliarPage() {
  const [rows, setRows] = useState<BSRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [catsNegocio, setCatsNegocio] = useState<string[]>([]);
  const [catsPersonal, setCatsPersonal] = useState<string[]>([]);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [sortKey, setSortKey] = useState<SortKey>("fecha");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterBanco, setFilterBanco] = useState("");
  const [filterDesc, setFilterDesc] = useState("");
  const [filterMoneda, setFilterMoneda] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterCat, setFilterCat] = useState("");

  // Bulk classify modal
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkTipo, setBulkTipo] = useState("");
  const [bulkCatNeg, setBulkCatNeg] = useState("");
  const [bulkCatPer, setBulkCatPer] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  // Undo toast state
  const [toast, setToast] = useState<{ msg: string; undo?: () => void } | null>(null);
  const [toastTimeout, setToastTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/sin-clasificar").then(r => r.json()),
      fetch("/api/admin/categorias-list").then(r => r.json()),
    ]).then(([d, cats]) => {
      setRows(d.rows ?? []);
      setCatsNegocio(cats.negocio ?? []);
      setCatsPersonal(cats.personal ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const bancos = useMemo(() => [...new Set(rows.map(r => r.banco))].sort(), [rows]);
  const monedas = useMemo(() => [...new Set(rows.map(r => r.moneda))].sort(), [rows]);

  const catOptions = useMemo(() => {
    if (filterTipo === "negocio") return catsNegocio;
    if (filterTipo === "personal") return catsPersonal;
    return [];
  }, [filterTipo, catsNegocio, catsPersonal]);

  const filtered = useMemo(() => rows.filter(r => {
    if (r.clasificado === "Si") return false;
    if (filterBanco && r.banco !== filterBanco) return false;
    if (filterMoneda && r.moneda !== filterMoneda) return false;
    if (filterDesc && !(r.descripcion ?? "").toLowerCase().includes(filterDesc.toLowerCase())) return false;
    if (filterTipo && (r.tipo ?? "") !== filterTipo) return false;
    if (filterCat) {
      const cat = filterTipo === "negocio" ? (r.categoria_negocio ?? "") : (r.categoria_personal ?? "");
      if (!cat.toLowerCase().includes(filterCat.toLowerCase())) return false;
    }
    return true;
  }), [rows, filterBanco, filterMoneda, filterDesc, filterTipo, filterCat]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "fecha") cmp = a.fecha.localeCompare(b.fecha);
    else if (sortKey === "banco") cmp = a.banco.localeCompare(b.banco);
    else if (sortKey === "descripcion") cmp = (a.descripcion ?? "").localeCompare(b.descripcion ?? "");
    else if (sortKey === "monto") cmp = rowImporteUYU(a) - rowImporteUYU(b);
    return sortDir === "asc" ? cmp : -cmp;
  }), [filtered, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  }

  function openEdit(row: BSRow, e: React.MouseEvent) {
    if (selected.size > 0) { toggleSelect(row.id); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setEditState({ row, anchor: { top: rect.bottom + 4, left: rect.left } });
  }

  function handleSaved(id: string, updated: Partial<BSRow & { clasificado: string }>) {
    if (updated.clasificado === "Si") {
      setRows(prev => prev.filter(r => r.id !== id));
    } else {
      setRows(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r));
    }
  }

  function handleUndo(id: string) {
    // Row comes back as unclassified — re-add it if we removed it
    setRows(prev => {
      if (prev.find(r => r.id === id)) return prev;
      return prev; // can't fully restore without original data; just keep as-is
    });
  }

  function showToast(msg: string, undo?: () => void) {
    if (toastTimeout) clearTimeout(toastTimeout);
    setToast({ msg, undo });
    const t = setTimeout(() => setToast(null), 5000);
    setToastTimeout(t);
  }

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function selectAll() { setSelected(new Set(sorted.map(r => r.id))); }
  function clearSelection() { setSelected(new Set()); }

  async function doBulkClassify() {
    if (!bulkTipo || selected.size === 0) return;
    setBulkSaving(true);
    try {
      const res = await fetch("/api/admin/bulk-classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selected),
          tipo: bulkTipo,
          categoria_negocio: bulkCatNeg,
          categoria_personal: bulkCatPer,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRows(prev => prev.filter(r => !selected.has(r.id)));
      const count = data.updated;
      showToast(`✓ ${count} movimientos clasificados como ${bulkTipo}.`);
      setBulkModal(false);
      clearSelection();
      setBulkTipo(""); setBulkCatNeg(""); setBulkCatPer("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setBulkSaving(false);
    }
  }

  const hasFilters = filterBanco || filterDesc || filterMoneda || filterTipo || filterCat;
  const total = rows.filter(r => r.clasificado !== "Si").length;

  return (
    <div className="p-8">
      {/* Undo toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 text-white text-sm px-4 py-3 rounded-xl shadow-lg" style={{ background: "#1C1A19" }}>
          <span>{toast.msg}</span>
          {toast.undo && (
            <button onClick={toast.undo} className="flex items-center gap-1 font-semibold" style={{ color: "#C5A059" }}>
              ↩ Deshacer
            </button>
          )}
          <button onClick={() => setToast(null)} style={{ color: "#8C857B" }} className="hover:text-white"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {editState && (
        <ClassifyPopover
          row={editState.row}
          anchor={editState.anchor}
          catsNegocio={catsNegocio}
          catsPersonal={catsPersonal}
          onCategoryCreated={(name, type) => {
            if (type === "negocio") setCatsNegocio(p => [...new Set([...p, name])].sort());
            else setCatsPersonal(p => [...new Set([...p, name])].sort());
          }}
          onClose={() => setEditState(null)}
          onSaved={(updated) => { handleSaved(editState.row.id, updated); setEditState(null); }}
          onUndo={handleUndo}
        />
      )}

      {/* Bulk classify modal */}
      {bulkModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl shadow-xl p-6 max-w-sm w-full space-y-4" style={{ background: "#FCFBFA", border: "1px solid #E6E1DA" }}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base" style={{ color: "#2E2B2A" }}>Clasificar {selected.size} movimientos</h3>
              <button onClick={() => setBulkModal(false)}><X className="w-4 h-4" style={{ color: "#8C857B" }} /></button>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "#8C857B" }}>Tipo</label>
              <div className="flex gap-2">
                {(["negocio", "personal"] as const).map(t => (
                  <button key={t} onClick={() => setBulkTipo(t)}
                    style={bulkTipo === t
                      ? { background: t === "negocio" ? "#EAF0E6" : "#F5EDE9", border: `1px solid ${t === "negocio" ? "#586E50" : "#946E61"}`, color: t === "negocio" ? "#586E50" : "#946E61" }
                      : { border: "1px solid #E6E1DA", color: "#8C857B" }}
                    className="flex-1 py-1.5 text-xs rounded-lg font-medium transition-colors">
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {bulkTipo === "negocio" && (
              <div>
                <label className="text-xs mb-1 block" style={{ color: "#8C857B" }}>Categoría negocio</label>
                <input list="bk-cats-neg" value={bulkCatNeg} onChange={e => setBulkCatNeg(e.target.value)}
                  className="w-full text-xs rounded-lg px-2 py-1.5 focus:outline-none" style={{ border: "1px solid #E6E1DA" }} placeholder="Seleccionar o escribir…" />
                <datalist id="bk-cats-neg">{catsNegocio.map(c => <option key={c} value={c} />)}</datalist>
              </div>
            )}
            {bulkTipo === "personal" && (
              <div>
                <label className="text-xs mb-1 block" style={{ color: "#8C857B" }}>Categoría personal</label>
                <input list="bk-cats-per" value={bulkCatPer} onChange={e => setBulkCatPer(e.target.value)}
                  className="w-full text-xs rounded-lg px-2 py-1.5 focus:outline-none" style={{ border: "1px solid #E6E1DA" }} placeholder="Seleccionar o escribir…" />
                <datalist id="bk-cats-per">{catsPersonal.map(c => <option key={c} value={c} />)}</datalist>
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button onClick={doBulkClassify} disabled={bulkSaving || !bulkTipo}
                className="flex-1 h-10 text-white font-semibold rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "#C5A059" }}>
                <Save className="w-4 h-4" />{bulkSaving ? "Guardando…" : "Clasificar todos"}
              </button>
              <button onClick={() => setBulkModal(false)} className="flex-1 h-10 rounded-lg text-sm" style={{ border: "1px solid #E6E1DA", color: "#8C857B" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#2E2B2A" }}>Sin clasificar</h1>
          <p className="text-sm mt-1" style={{ color: "#8C857B" }}>
            {loading ? "Cargando…" : `${sorted.length} de ${total} movimientos`}
            {hasFilters && (
              <button onClick={() => { setFilterBanco(""); setFilterDesc(""); setFilterMoneda(""); setFilterTipo(""); setFilterCat(""); }}
                className="ml-2 underline text-xs" style={{ color: "#C5A059" }}>
                Limpiar filtros
              </button>
            )}
          </p>
        </div>
        {/* Bulk action bar */}
        {selected.size > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium" style={{ color: "#2E2B2A" }}>{selected.size} seleccionados</span>
            <button onClick={() => setBulkModal(true)}
              className="flex items-center gap-1.5 h-8 px-3 text-white text-xs font-semibold rounded-lg"
              style={{ background: "#C5A059" }}>
              <CheckSquare className="w-3.5 h-3.5" />Clasificar selección
            </button>
            <button onClick={clearSelection} className="h-8 px-3 text-xs rounded-lg" style={{ border: "1px solid #E6E1DA", color: "#8C857B" }}>Cancelar</button>
          </div>
        ) : (
          sorted.length > 0 && (
            <button onClick={selectAll} className="h-8 px-3 text-xs rounded-lg" style={{ border: "1px solid #E6E1DA", color: "#8C857B" }}>
              Seleccionar todos ({sorted.length})
            </button>
          )
        )}
      </div>

      {!loading && total === 0 ? (
        <div className="text-center py-16" style={{ color: "#8C857B" }}>
          <p className="text-2xl mb-2">✓</p>
          <p className="text-base font-medium" style={{ color: "#2E2B2A" }}>Todo clasificado</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-x-auto" style={{ background: "white", border: "1px solid #E6E1DA" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider" style={{ background: "#FCFBFA", borderColor: "#E6E1DA", color: "#8C857B" }}>
                <th className="px-3 py-3 w-8">
                  <input type="checkbox" checked={sorted.length > 0 && selected.size === sorted.length}
                    onChange={e => e.target.checked ? selectAll() : clearSelection()}
                    className="w-3 h-3 accent-brand" />
                </th>
                <th className="px-4 py-3 font-medium">
                  <button onClick={() => toggleSort("fecha")} className="hover:text-gray-800 whitespace-nowrap">
                    Fecha <SortIcon active={sortKey === "fecha"} dir={sortDir} />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">
                  <button onClick={() => toggleSort("banco")} className="hover:text-gray-800 whitespace-nowrap">
                    Banco <SortIcon active={sortKey === "banco"} dir={sortDir} />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">
                  <button onClick={() => toggleSort("descripcion")} className="hover:text-gray-800 whitespace-nowrap">
                    Descripción <SortIcon active={sortKey === "descripcion"} dir={sortDir} />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium text-right whitespace-nowrap">Importe original</th>
                <th className="px-4 py-3 font-medium text-right whitespace-nowrap">
                  <button onClick={() => toggleSort("monto")} className="hover:text-gray-800">
                    Imp. UYU <SortIcon active={sortKey === "monto"} dir={sortDir} />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Categoría</th>
                <th className="px-4 py-3 font-medium">Nota</th>
              </tr>
              <tr className="border-b text-xs" style={{ background: "white", borderColor: "#E6E1DA" }}>
                <td className="px-3 py-1.5" />
                <td className="px-3 py-1.5" />
                <td className="px-3 py-1.5">
                  <select value={filterBanco} onChange={e => setFilterBanco(e.target.value)}
                    className="w-full rounded px-2 py-1 focus:outline-none text-xs" style={{ border: "1px solid #E6E1DA", color: "#2E2B2A" }}>
                    <option value="">Todos</option>
                    {bancos.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  <input placeholder="Buscar…" value={filterDesc} onChange={e => setFilterDesc(e.target.value)}
                    className="w-full rounded px-2 py-1 focus:outline-none text-xs" style={{ border: "1px solid #E6E1DA", color: "#2E2B2A" }} />
                </td>
                <td className="px-3 py-1.5">
                  <select value={filterMoneda} onChange={e => setFilterMoneda(e.target.value)}
                    className="w-full rounded px-2 py-1 focus:outline-none text-xs" style={{ border: "1px solid #E6E1DA", color: "#2E2B2A" }}>
                    <option value="">Todas</option>
                    {monedas.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </td>
                <td className="px-3 py-1.5" />
                <td className="px-3 py-1.5">
                  <select value={filterTipo} onChange={e => { setFilterTipo(e.target.value); setFilterCat(""); }}
                    className="w-full rounded px-2 py-1 focus:outline-none text-xs" style={{ border: "1px solid #E6E1DA", color: "#2E2B2A" }}>
                    <option value="">Todos</option>
                    <option value="negocio">Negocio</option>
                    <option value="personal">Personal</option>
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  {catOptions.length > 0 ? (
                    <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                      className="w-full rounded px-2 py-1 focus:outline-none text-xs" style={{ border: "1px solid #E6E1DA", color: "#2E2B2A" }}>
                      <option value="">Todas</option>
                      {catOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <span className="text-xs px-2" style={{ color: "#C4B5A0" }}>— elegí tipo —</span>
                  )}
                </td>
                <td className="px-3 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const esIngreso = (r.credito ?? 0) > 0;
                const montoOrig = esIngreso ? (r.credito ?? 0) : (r.debito ?? 0);
                const importeUYU = rowImporteUYU(r);
                const esUSD = r.moneda === "USD";
                const cat = r.tipo === "negocio" ? r.categoria_negocio : r.categoria_personal;
                const isSelected = selected.has(r.id);
                return (
                  <tr key={r.id}
                    className="cursor-pointer"
                    style={{
                      background: isSelected ? "#F5EDE9" : i % 2 === 0 ? "white" : "#FCFBFA",
                      borderBottom: "1px solid #E6E1DA",
                    }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#F5F0E8"; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? "white" : "#FCFBFA"; }}
                    onClick={e => openEdit(r, e)}>
                    <td className="px-3 py-3" onClick={e => { e.stopPropagation(); toggleSelect(r.id); }}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(r.id)}
                        className="w-3 h-3" style={{ accentColor: "#C5A059" }} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#8C857B" }}>{formatDate(r.fecha)}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: "#2E2B2A" }}>{r.banco}</td>
                    <td className="px-4 py-3 max-w-xs truncate" style={{ color: "#2E2B2A" }}>{r.descripcion ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap" style={{ color: esIngreso ? "#586E50" : "#946E61" }}>
                      {esIngreso ? "+" : "-"}
                      {esUSD ? `U$ ${montoOrig.toFixed(2)}` : formatUYU(montoOrig)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap" style={{ color: esIngreso ? "#586E50" : "#946E61" }}>
                      {esUSD ? <>{esIngreso ? "+" : "-"}{formatUYU(importeUYU)}</> : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.tipo ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={r.tipo === "negocio"
                            ? { background: "#EAF0E6", color: "#586E50" }
                            : { background: "#F5EDE9", color: "#946E61" }}>
                          {r.tipo}
                        </span>
                      ) : <span className="text-xs" style={{ color: "#C4B5A0" }}>—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#8C857B" }}>{cat ?? "—"}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <NoteCell id={r.id} nota={r.nota} />
                    </td>
                  </tr>
                );
              })}
              {!loading && sorted.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm" style={{ color: "#8C857B" }}>
                    Sin resultados para los filtros aplicados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
