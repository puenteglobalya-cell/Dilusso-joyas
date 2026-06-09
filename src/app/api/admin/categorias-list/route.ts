import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb.from("categories") as any).select("name, type").order("name");
  const cats = data ?? [];
  return NextResponse.json({
    negocio: cats.filter((c: { type: string }) => c.type === "negocio").map((c: { name: string }) => c.name),
    personal: cats.filter((c: { type: string }) => c.type === "personal").map((c: { name: string }) => c.name),
  });
}
