"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Download, X, Save, BookMarked } from "lucide-react";
import { formatUYU } from "@/lib/utils";
import { ClassifyPopover } from "@/components/bank/ClassifyPopover";

export interface Row {
  id: string;
  banco: string;
  cuenta: string | null;
  fecha: string;
  descripcion: string | null;
  numero: string | null;
  debito: number | null;
  credito: number | null;
  saldo: number | null;
  moneda: string;
  clasificado: string | null;
  tipo: string | null;
  categoria_negocio: string | null;
  categoria_personal: string | null;
  tc: number | null;
  importe_uyu: number | null;
  ok: boolean;
  diff: null;
  computedSaldo: number | null;
}

type SortKey = "fecha" | "descripcion" | "debito" | "credito" | "computedSaldo" | "tipo" | "categoria_negocio" | "categoria_personal";

// ── Tipos y categorías disponibles ────────────────────────────────────────────
const TIPOS = ["negocio", "personal"];
const CATS_NEGOCIO = [
  "", "Publicidad", "Mercadería de reventa", "Servicios contratados",
  "Venta tarjeta", "Gastos generales", "Sueldos", "Impuestos",
];
const CATS_PERSONAL = [
  "", "3. ALIMENTOS", "4. SERVICIOS HOGAR", "5. TRANSPORTE",
  "6. SALUD", "7. ENTRETENIMIENTO", "8. INDUMENTARIA",
  "9. SERVICIOS DIGITALES", "10. TRASPASO", "11. BANCO/FINANCIERO", "12. SEGUROS",
];

const TIPO_BADGE: Record<string, string> = {
  negocio: "bg-blue-100 text-blue-700",
  personal: "bg-purple-100 text-purple-700",
};

// ── Edit modal ────────────────────────────────────────────────────────────────
interface EditState {
  row: Row;
  anchor: { top: number; left: number };
}

function EditPopover({
  row,
  anchor,
  catsNegocio,
  catsPersonal,
  onCategoryCreated,
  onClose,
  onSaved,
}: {
  row: Row;
  anchor: { top: number; left: number };
  catsNegocio: string[];
  catsPersonal: string[];
  onCategoryCreated: (name: string, type: "negocio" | "personal") => void;
  onClose: () => void;
  onSaved: (updated: Partial<Row>) => void;
}) {
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
      // Persist new category to DB if not in the known list
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
        onSaved({ tipo, categoria_negocio: catNeg, categoria_personal: catPer, clasificado: tipo ? "Si" : "No" });
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  function handleSaveClick() {
    // Ask about dictionary only if something changed
    setAskDict(true);
  }

  const style: React.CSSProperties = {
    position: "fixed",
    top: Math.min(anchor.top, window.innerHeight - 360),
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
                  <button
                    key={t}
                    onClick={() => setTipo(t)}
                    className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors
                      ${tipo === t
                        ? t === "negocio" ? "bg-blue-100 border-blue-300 text-blue-700" : "bg-purple-100 border-purple-300 text-purple-700"
                        : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                  >
                    {t}
                  </button>
                ))}
                <button
                  onClick={() => setTipo("")}
                  className={`px-2 py-1.5 text-xs rounded-lg border transition-colors ${tipo === "" ? "bg-gray-100 border-gray-300" : "border-gray-200 text-gray-400 hover:bg-gray-50"}`}
                >
                  —
                </button>
              </div>
            </div>

            {tipo === "negocio" && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Categoría negocio <span className="text-gray-400">(podés escribir una nueva)</span></label>
                <input
                  list="cats-negocio"
                  value={catNeg}
                  onChange={(e) => setCatNeg(e.target.value)}
                  placeholder="Seleccionar o escribir…"
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand"
                />
                <datalist id="cats-negocio">
                  {catsNegocio.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
            )}

            {tipo === "personal" && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Categoría personal <span className="text-gray-400">(podés escribir una nueva)</span></label>
                <input
                  list="cats-personal"
                  value={catPer}
                  onChange={(e) => setCatPer(e.target.value)}
                  placeholder="Seleccionar o escribir…"
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand"
                />
                <datalist id="cats-personal">
                  {catsPersonal.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
            )}

            <button
              onClick={handleSaveClick}
              disabled={saving}
              className="w-full py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-dark disabled:opacity-50 transition-colors"
            >
              <Save className="w-3 h-3 inline mr-1" />
              Guardar
            </button>
          </>
        ) : (
          /* ── Preguntar si guardar en diccionario ── */
          <div className="space-y-3">
            <p className="text-xs text-gray-700 font-medium">
              ¿Querés guardar una regla en el diccionario para clasificar automáticamente en el futuro?
            </p>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Keyword (parte del texto a detectar)</label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder={`ej: ${(row.descripcion ?? "").slice(0, 20)}`}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => save(false)}
                disabled={saving}
                className="flex-1 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Solo esta vez
              </button>
              <button
                onClick={() => save(true)}
                disabled={saving || !keyword.trim()}
                className="flex-1 py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-dark disabled:opacity-50 transition-colors"
              >
                <BookMarked className="w-3 h-3 inline mr-1" />
                Guardar en diccionario
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 opacity-30 ml-1 inline" />;
  return dir === "asc"
    ? <ArrowUp className="w-3 h-3 ml-1 inline text-brand" />
    : <ArrowDown className="w-3 h-3 ml-1 inline text-brand" />;
}

function toCSV(rows: Row[]): string {
  const hasNum = rows.some((r) => r.numero);
  const hasUsd = rows.some((r) => r.moneda === "USD");
  const headers = [
    "Fecha", "Descripción",
    ...(hasNum ? ["N° cheque"] : []),
    "Débito", "Crédito", "Saldo calculado", "Moneda",
    ...(hasUsd ? ["TC", "Importe UYU"] : []),
    "Clasificado", "Tipo", "Cat. Negocio", "Cat. Personal",
  ];
  const lines = rows.map((r) => [
    r.fecha,
    `"${(r.descripcion ?? "").replace(/"/g, '""')}"`,
    ...(hasNum ? [r.numero ?? ""] : []),
    r.debito ?? "",
    r.credito ?? "",
    r.computedSaldo?.toFixed(2) ?? "",
    r.moneda,
    ...(hasUsd ? [r.tc ?? "", r.importe_uyu?.toFixed(2) ?? ""] : []),
    r.clasificado ?? "",
    r.tipo ?? "",
    r.categoria_negocio ?? "",
    r.categoria_personal ?? "",
  ].join(","));
  return [headers.join(","), ...lines].join("\n");
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function BankStatementTable({
  rows: initialRows,
  isCreditCard = false,
  catsNegocio: initialCatsNegocio = [],
  catsPersonal: initialCatsPersonal = [],
}: {
  rows: Row[];
  isCreditCard?: boolean;
  catsNegocio?: string[];
  catsPersonal?: string[];
}) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [sortKey, setSortKey] = useState<SortKey>("fecha");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filters, setFilters] = useState({
    fecha: "", descripcion: "", moneda: "", tipo: "", categoria: "", clasificado: "",
  });
  const [editState, setEditState] = useState<EditState | null>(null);
  const [catsNegocio, setCatsNegocio] = useState<string[]>(initialCatsNegocio);
  const [catsPersonal, setCatsPersonal] = useState<string[]>(initialCatsPersonal);

  function openEdit(row: Row, e: React.MouseEvent) {
    if (row.descripcion === "Saldo anterior") return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setEditState({ row, anchor: { top: rect.bottom + 4, left: rect.left } });
  }

  function handleSaved(id: string, updated: Partial<Row>) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...updated } : r));
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (r.descripcion === "Saldo anterior") return false;
      if (filters.fecha && !r.fecha.includes(filters.fecha)) return false;
      if (filters.descripcion && !(r.descripcion ?? "").toLowerCase().includes(filters.descripcion.toLowerCase())) return false;
      if (filters.moneda && r.moneda !== filters.moneda) return false;
      if (filters.tipo && (r.tipo ?? "") !== filters.tipo) return false;
      if (filters.categoria) {
        const cat = ((r.categoria_negocio ?? "") + " " + (r.categoria_personal ?? "")).toLowerCase();
        if (!cat.includes(filters.categoria.toLowerCase())) return false;
      }
      if (filters.clasificado && (r.clasificado ?? "") !== filters.clasificado) return false;
      return true;
    });
  }, [rows, filters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = a[sortKey] ?? (sortDir === "asc" ? "￿" : "");
      const vb = b[sortKey] ?? (sortDir === "asc" ? "￿" : "");
      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [filtered, sortKey, sortDir]);

  function downloadCSV() {
    const csv = toCSV(sorted);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extracto-${sorted[0]?.banco ?? "banco"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasFilters = Object.values(filters).some(Boolean);
  const monedas = [...new Set(rows.map((r) => r.moneda))].sort();
  const hasNumero = rows.some((r) => r.numero);
  const hasUsd = rows.some((r) => r.moneda === "USD");
  const tipos = [...new Set(rows.map((r) => r.tipo ?? "").filter(Boolean))].sort();

  const Th = ({ k, label, right = false }: { k: SortKey; label: string; right?: boolean }) => (
    <th className={`px-4 py-3 font-medium ${right ? "text-right" : ""}`}>
      <button onClick={() => toggleSort(k)} className="hover:text-gray-800 transition-colors whitespace-nowrap">
        {label}
        <SortIcon active={sortKey === k} dir={sortDir} />
      </button>
    </th>
  );

  return (
    <div>
      {editState && (
        <EditPopover
          row={editState.row}
          anchor={editState.anchor}
          catsNegocio={catsNegocio}
          catsPersonal={catsPersonal}
          onCategoryCreated={(name, type) => {
            if (type === "negocio") setCatsNegocio((p) => [...new Set([...p, name])].sort());
            else setCatsPersonal((p) => [...new Set([...p, name])].sort());
          }}
          onClose={() => setEditState(null)}
          onSaved={(updated) => handleSaved(editState.row.id, updated)}
        />
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500">
            {sorted.length} de {rows.length} movimientos
            {hasFilters && (
              <button
                onClick={() => setFilters({ fecha: "", descripcion: "", moneda: "", tipo: "", categoria: "", clasificado: "" })}
                className="ml-2 text-brand underline text-xs"
              >
                Limpiar filtros
              </button>
            )}
          </p>
          <button
            onClick={() => setFilters((f) => ({ ...f, clasificado: f.clasificado === "No" ? "" : "No" }))}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              filters.clasificado === "No"
                ? "bg-orange-100 border-orange-300 text-orange-700"
                : "border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}
          >
            {filters.clasificado === "No" ? "✗ Sin clasificar" : "Ver sin clasificar"}
          </button>
        </div>
        <button
          onClick={downloadCSV}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
              <Th k="fecha" label="Fecha" />
              <Th k="descripcion" label="Descripción" />
              {hasNumero && <th className="px-4 py-3 font-medium text-right">N° cheque</th>}
              <Th k="debito" label="Débito" right />
              <Th k="credito" label="Crédito" right />
              {!isCreditCard && <Th k="computedSaldo" label="Saldo" right />}
              {monedas.length > 1 && <th className="px-4 py-3 font-medium">Mon.</th>}
              {hasUsd && <th className="px-4 py-3 font-medium text-right">Imp. UYU</th>}
              <Th k="tipo" label="Tipo" />
              <Th k="categoria_negocio" label="Cat. Negocio" />
              <Th k="categoria_personal" label="Cat. Personal" />
            </tr>
            {/* Filter row */}
            <tr className="border-b bg-white text-xs">
              <td className="px-3 py-1.5">
                <input placeholder="Fecha…" value={filters.fecha}
                  onChange={(e) => setFilters((f) => ({ ...f, fecha: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand" />
              </td>
              <td className="px-3 py-1.5">
                <input placeholder="Descripción…" value={filters.descripcion}
                  onChange={(e) => setFilters((f) => ({ ...f, descripcion: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand" />
              </td>
              {hasNumero && <td className="px-3 py-1.5" />}
              <td className="px-3 py-1.5" />
              <td className="px-3 py-1.5" />
              {!isCreditCard && <td className="px-3 py-1.5" />}
              {monedas.length > 1 && (
                <td className="px-3 py-1.5">
                  <select value={filters.moneda}
                    onChange={(e) => setFilters((f) => ({ ...f, moneda: e.target.value }))}
                    className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand">
                    <option value="">Todas</option>
                    {monedas.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </td>
              )}
              {hasUsd && <td className="px-3 py-1.5" />}
              <td className="px-3 py-1.5">
                <select value={filters.tipo}
                  onChange={(e) => setFilters((f) => ({ ...f, tipo: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand">
                  <option value="">Todos</option>
                  {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </td>
              <td className="px-3 py-1.5">
                <input placeholder="Categoría…" value={filters.categoria}
                  onChange={(e) => setFilters((f) => ({ ...f, categoria: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand" />
              </td>
              <td className="px-3 py-1.5">
                <select value={filters.clasificado}
                  onChange={(e) => setFilters((f) => ({ ...f, clasificado: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand">
                  <option value="">Todos</option>
                  <option value="Si">Clasificado</option>
                  <option value="No">Sin clasificar</option>
                </select>
              </td>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-sm text-gray-400">
                  Sin resultados para los filtros aplicados
                </td>
              </tr>
            ) : sorted.map((row, i) => {
              const isSaldoAnterior = row.descripcion === "Saldo anterior";
              return (
                <tr
                  key={row.id ?? i}
                  className={isSaldoAnterior ? "bg-gray-50 font-medium" : "hover:bg-gray-50"}
                >
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap tabular-nums text-xs">{row.fecha}</td>
                  <td className="px-4 py-2 text-gray-800 max-w-[200px] truncate" title={row.descripcion ?? ""}>
                    {row.descripcion ?? "—"}
                  </td>
                  {hasNumero && (
                    <td className="px-4 py-2 text-right tabular-nums text-gray-400 text-xs">{row.numero ?? ""}</td>
                  )}
                  <td className="px-4 py-2 text-right text-red-600 tabular-nums">
                    {row.debito != null ? formatUYU(row.debito) : ""}
                  </td>
                  <td className="px-4 py-2 text-right text-green-600 tabular-nums">
                    {row.credito != null ? formatUYU(row.credito) : ""}
                  </td>
                  {!isCreditCard && (
                    <td className="px-4 py-2 text-right font-medium tabular-nums">
                      {row.computedSaldo != null ? formatUYU(row.computedSaldo) : "—"}
                    </td>
                  )}
                  {monedas.length > 1 && (
                    <td className="px-4 py-2 text-xs text-gray-400">{row.moneda}</td>
                  )}
                  {hasUsd && (
                    <td className="px-4 py-2 text-right tabular-nums text-xs text-gray-500">
                      {row.importe_uyu != null ? formatUYU(Math.abs(row.importe_uyu)) : ""}
                    </td>
                  )}
                  {/* Tipo — clickeable para editar */}
                  <td className="px-4 py-2">
                    {!isSaldoAnterior ? (
                      <button
                        onClick={(e) => openEdit(row, e)}
                        title="Clic para editar clasificación"
                        className="text-left"
                      >
                        {row.tipo ? (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium cursor-pointer hover:opacity-80 ${TIPO_BADGE[row.tipo] ?? "bg-gray-100 text-gray-600"}`}>
                            {row.tipo}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300 hover:text-gray-500 cursor-pointer">+ clasificar</span>
                        )}
                      </button>
                    ) : null}
                  </td>
                  <td
                    className="px-4 py-2 text-xs text-gray-500 max-w-[130px] truncate cursor-pointer hover:bg-gray-100 rounded"
                    title={(row.categoria_negocio ?? "") + " — clic para editar"}
                    onClick={(e) => !isSaldoAnterior && openEdit(row, e)}
                  >
                    {row.categoria_negocio || ""}
                  </td>
                  <td
                    className="px-4 py-2 text-xs max-w-[130px] truncate cursor-pointer hover:bg-gray-100 rounded"
                    title={(row.categoria_personal ?? "") + " — clic para editar"}
                    onClick={(e) => !isSaldoAnterior && openEdit(row, e)}
                  >
                    {row.categoria_personal
                      ? <span className="text-gray-500">{row.categoria_personal}</span>
                      : row.clasificado === "No" && !isSaldoAnterior
                        ? <span className="text-orange-400">Sin clasificar</span>
                        : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
