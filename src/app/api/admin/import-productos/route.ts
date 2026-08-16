import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { parseJoyas, parseRelojes, parseJoyasSyncStatus, ProductRow } from "@/lib/product-parsers";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const tipo = formData.get("tipo") as string | null; // "joya" | "reloj"

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (tipo !== "joya" && tipo !== "reloj") return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: `Archivo demasiado grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Máximo: 20 MB.` }, { status: 413 });
  }

  const buffer = await file.arrayBuffer();
  let rows: ProductRow[];
  try {
    rows = tipo === "joya" ? parseJoyas(buffer) : parseRelojes(buffer);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al parsear el archivo" }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, upserted: 0, warning: "No se encontraron productos en el archivo" });
  }

  const sb = createServerClient();
  const withSource = rows.map(r => ({ ...r, source_file: file.name, updated_at: new Date().toISOString() }));

  let upserted = 0;
  let upsertError: string | null = null;
  const CHUNK = 500;
  for (let i = 0; i < withSource.length; i += CHUNK) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb.from("products") as any)
      .upsert(withSource.slice(i, i + CHUNK), { onConflict: "tipo_producto,codigo_dl" });
    if (!error) upserted += Math.min(CHUNK, withSource.length - i);
    else upsertError = error.message;
  }

  // Para joyas, además cruzamos CHECKLIST_JOYAS / PRECIOS_JOYAS / CARGA_ZUREO_JOYAS
  // para detectar códigos que quedaron fuera de alguno de los 3 sistemas.
  let syncUpserted = 0;
  let syncError: string | null = null;
  if (tipo === "joya") {
    try {
      const syncRows = parseJoyasSyncStatus(buffer);
      const withUpdated = syncRows.map(r => ({ ...r, updated_at: new Date().toISOString() }));
      for (let i = 0; i < withUpdated.length; i += CHUNK) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (sb.from("product_sync_status") as any)
          .upsert(withUpdated.slice(i, i + CHUNK), { onConflict: "codigo_dl" });
        if (!error) syncUpserted += Math.min(CHUNK, withUpdated.length - i);
        else syncError = error.message;
      }
    } catch (e) {
      syncError = e instanceof Error ? e.message : "Error al cruzar hojas de sincronización";
    }
  }

  return NextResponse.json({
    ok: true,
    upserted,
    parsed: rows.length,
    tipo,
    filename: file.name,
    ...(upsertError ? { upsertError } : {}),
    ...(tipo === "joya" ? { syncUpserted, ...(syncError ? { syncError } : {}) } : {}),
  });
}
