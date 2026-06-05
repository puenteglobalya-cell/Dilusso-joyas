import { createServerClient } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { AddDictionaryEntry } from "@/components/dictionary/add-entry";
import type { VendorDictionary, Category } from "@/lib/database.types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Diccionario | Dilusso Joyas" };

export default async function DiccionarioPage() {
  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entriesData } = await (sb.from("vendor_dictionary") as any).select("*").order("keyword");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: catData } = await (sb.from("categories") as any).select("*").order("name");

  const entries = (entriesData ?? []) as VendorDictionary[];
  const categories = (catData ?? []) as Category[];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Diccionario de proveedores</h1>
          <p className="text-sm text-slate-500 mt-1">{entries.length} entradas — se aplican automáticamente al importar</p>
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
              <th className="text-left px-4 py-3 font-medium text-slate-500">Banco</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Notas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs font-medium">{e.keyword}</td>
                <td className="px-4 py-3">{e.tipo && <Badge variant={e.tipo === "negocio" ? "default" : "outline"}>{e.tipo}</Badge>}</td>
                <td className="px-4 py-3 text-slate-600">{e.categoria ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">{e.banco ?? "Todos"}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{e.notes ?? "—"}</td>
              </tr>
            ))}
            {!entries.length && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                  <p className="font-medium text-slate-500 mb-1">El diccionario está vacío</p>
                  <p className="text-xs">Agregá palabras clave para clasificar transacciones automáticamente al importar</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
