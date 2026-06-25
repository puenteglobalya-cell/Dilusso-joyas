import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { transactionId, tipo, categoria, saveToDict, keyword, banco } = await req.json();
  const sb = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb.from("transactions") as any)
    .update({ tipo, categoria, clasificado: true })
    .eq("id", transactionId);

  if (saveToDict && keyword?.trim()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from("vendor_dictionary") as any).upsert(
      { keyword: keyword.trim().toLowerCase(), tipo, categoria, banco: banco ?? null },
      { onConflict: "keyword" }
    );
  }

  return NextResponse.json({ ok: true });
}
