"use client";
import { useState, useMemo } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DeleteDictionaryEntry } from "@/components/dictionary/delete-entry";

export interface Regla {
  keyword: string;
  tipo: string;
  cat_negocio: string;
  cat_personal: string;
}

type SortKey = "keyword" | "tipo" | "categoria";

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 opacity-30 ml-1 inline" />;
  return dir === "asc"
    ? <ArrowUp className="w-3 h-3 ml-1 inline text-brand" />
    : <ArrowDown className="w-3 h-3 ml-1 inline text-brand" />;
}

export function DictionaryTable({ entries }: { entries: Regla[] }) {
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("keyword");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const catOf = (e: Regla) => (e.tipo === "negocio" ? e.cat_negocio : e.cat_personal) || "";

  const categorias = useMemo(() => {
    const source = filterTipo ? entries.filter(e => e.tipo === filterTipo) : entries;
    return [...new Set(source.map(catOf).filter(Boolean))].sort();
  }, [entries, filterTipo]);

  const filtered = useMemo(() => entries.filter(e => {
    if (search && !e.keyword.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterTipo && e.tipo !== filterTipo) return false;
    if (filterCat && catOf(e) !== filterCat) return false;
    return true;
  }), [entries, search, filterTipo, filterCat]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "keyword") cmp = a.keyword.localeCompare(b.keyword);
    else if (sortKey === "tipo") cmp = (a.tipo ?? "").localeCompare(b.tipo ?? "");
    else cmp = catOf(a).localeCompare(catOf(b));
    return sortDir === "asc" ? cmp : -cmp;
  }), [filtered, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  }

  const hasFilters = search || filterTipo || filterCat;

  return (
    <>
      {/* Search + filters */}
      <div className="flex gap-2 flex-wrap mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-subtle" />
          <input
            type="text"
            placeholder="Buscar keyword…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-8 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-2.5 text-subtle hover:text-ink">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <select value={filterTipo} onChange={e => { setFilterTipo(e.target.value); setFilterCat(""); }}
          className="h-9 pl-3 pr-7 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="">Todo tipo</option>
          <option value="negocio">Negocio</option>
          <option value="personal">Personal</option>
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="h-9 pl-3 pr-7 border border-gray-200 rounded-lg text-sm bg-white max-w-[220px]">
          <option value="">Toda categoría</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {hasFilters && (
          <button onClick={() => { setSearch(""); setFilterTipo(""); setFilterCat(""); }}
            className="h-9 px-3 text-xs text-brand underline">
            Limpiar
          </button>
        )}
        <span className="text-xs text-subtle self-center ml-auto">
          {sorted.length} de {entries.length} reglas
        </span>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted">
                <button onClick={() => toggleSort("keyword")} className="hover:text-slate-800">
                  Keyword <SortIcon active={sortKey === "keyword"} dir={sortDir} />
                </button>
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted">
                <button onClick={() => toggleSort("tipo")} className="hover:text-slate-800">
                  Tipo <SortIcon active={sortKey === "tipo"} dir={sortDir} />
                </button>
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted">
                <button onClick={() => toggleSort("categoria")} className="hover:text-slate-800">
                  Categoría <SortIcon active={sortKey === "categoria"} dir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((e) => (
              <tr key={e.keyword} className="hover:bg-surface">
                <td className="px-4 py-3 font-mono text-xs font-medium">
                  {search ? highlightMatch(e.keyword, search) : e.keyword}
                </td>
                <td className="px-4 py-3">
                  {e.tipo && (
                    <Badge variant={e.tipo === "negocio" ? "default" : "outline"}>{e.tipo}</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-ink">{catOf(e) || "—"}</td>
                <td className="px-4 py-3 text-right">
                  <DeleteDictionaryEntry keyword={e.keyword} />
                </td>
              </tr>
            ))}
            {!sorted.length && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-subtle">
                  {entries.length === 0 ? (
                    <>
                      <p className="font-medium text-muted mb-1">El diccionario está vacío</p>
                      <p className="text-xs">Clasificá un movimiento y guardá la keyword para que aparezca aquí</p>
                    </>
                  ) : (
                    <p className="text-sm">Sin resultados para los filtros aplicados</p>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function highlightMatch(text: string, query: string) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}
