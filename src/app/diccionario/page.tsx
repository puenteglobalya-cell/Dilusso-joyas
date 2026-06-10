import { createServerClient } from "@/lib/supabase";
import { AddDictionaryEntry } from "@/components/dictionary/add-entry";
import { DictionaryTable, type Regla } from "@/components/dictionary/dictionary-table";
import type { Category } from "@/lib/database.types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Diccionario | Dilusso Joyas" };

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

      <DictionaryTable entries={entries} />
    </div>
  );
}
