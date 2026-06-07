import { createServerClient } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { AddDictionaryEntry } from "@/components/dictionary/add-entry";
import type { Category } from "@/lib/database.types";
import { DeleteDictionaryEntry } from "@/components/dictionary/delete-entry";

export const dynamic = "force-dynamic";
export const metadata = { title: "Diccionario | Dilusso Joyas" };

interface Regla {
  keyword: string;
  tipo: string;
  cat_negocio: string;
  cat_personal: string;
}

export default async function DiccionarioPage() {
  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rulesData } = await (sb.from("clasificacion_reglas") as any)
    .select("keyword, tipo, cat_negocio, cat_personal")
    .order("keyword");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: catData } = await (sb.from("categories") as any).select("*").order("name");

  const entries = (rulesData ?? []) as Regla[];
  const categories = (catData ?? []) as Category[];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Diccionario de clasificación</h1>
          <p className="text-sm text-slate-500 mt-1">
            {entries.length} reglas — se aplican al importar y al usar &quot;Aplicar reglas a sin clasificar&quot;
          </p>
        </div>
        <AddDictionaryEntry categories={categories} />
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Keyword</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Categoría</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((e) => (
              <tr key={e.keyword} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs font-medium">{e.keyword}</td>
                <td className="px-4 py-3">
                  {e.tipo && (
                    <Badge variant={e.tipo === "negocio" ? "default" : "outline"}>{e.tipo}</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {e.tipo === "negocio" ? e.cat_negocio : e.cat_personal || "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <DeleteDictionaryEntry keyword={e.keyword} />
                </td>
              </tr>
            ))}
            {!entries.length && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-slate-400">
                  <p className="font-medium text-slate-500 mb-1">El diccionario está vacío</p>
                  <p className="text-xs">Clasificá un movimiento y guardá la keyword para que aparezca aquí</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
