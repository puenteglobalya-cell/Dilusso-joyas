import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { name, type } = await req.json() as { name: string; type: "negocio" | "personal" };
  if (!name?.trim() || !type) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from("categories") as any)
    .upsert({ name: name.trim(), type }, { onConflict: "name,type" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
