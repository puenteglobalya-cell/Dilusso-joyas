import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

// GET: list all categories with usage count
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const sb = createServerClient();

  const [catRes, negRes, perRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from("categories") as any).select("name,type").order("type").order("name"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from("bank_statements") as any)
      .select("categoria_negocio")
      .not("categoria_negocio", "is", null)
      .neq("descripcion", "Saldo anterior"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from("bank_statements") as any)
      .select("categoria_personal")
      .not("categoria_personal", "is", null)
      .neq("descripcion", "Saldo anterior"),
  ]);

  const negCount: Record<string, number> = {};
  for (const r of negRes.data ?? []) {
    const k = r.categoria_negocio as string;
    negCount[k] = (negCount[k] ?? 0) + 1;
  }
  const perCount: Record<string, number> = {};
  for (const r of perRes.data ?? []) {
    const k = r.categoria_personal as string;
    perCount[k] = (perCount[k] ?? 0) + 1;
  }

  const cats = (catRes.data ?? []) as { name: string; type: string }[];
  return NextResponse.json(
    cats.map(c => ({
      name: c.name,
      type: c.type,
      uso: c.type === "negocio" ? (negCount[c.name] ?? 0) : (perCount[c.name] ?? 0),
    }))
  );
}

// PUT: rename or merge a category
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { from: fromName, to: toName, type } = await req.json() as { from: string; to: string; type: "negocio" | "personal" };
  if (!fromName?.trim() || !toName?.trim() || !type) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  const sb = createServerClient();
  const col = type === "negocio" ? "categoria_negocio" : "categoria_personal";

  // Update all movements with the old category name
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error: updErr } = await (sb.from("bank_statements") as any)
    .update({ [col]: toName.trim() })
    .eq(col, fromName.trim())
    .select("id", { count: "exact", head: true });

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // Delete old category from categories table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb.from("categories") as any).delete().eq("name", fromName.trim()).eq("type", type);

  // Ensure new category exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb.from("categories") as any).upsert({ name: toName.trim(), type }, { onConflict: "name,type" });

  return NextResponse.json({ ok: true, updated: count ?? 0 });
}

// DELETE: delete a category (set movements to null)
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { name, type } = await req.json() as { name: string; type: "negocio" | "personal" };
  if (!name?.trim() || !type) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });

  const sb = createServerClient();
  const col = type === "negocio" ? "categoria_negocio" : "categoria_personal";

  // Set category to null on all movements
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (sb.from("bank_statements") as any)
    .update({ [col]: null, clasificado: "No" })
    .eq(col, name.trim())
    .select("id", { count: "exact", head: true });

  // Delete from categories
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb.from("categories") as any).delete().eq("name", name.trim()).eq("type", type);

  return NextResponse.json({ ok: true, cleared: count ?? 0 });
}
