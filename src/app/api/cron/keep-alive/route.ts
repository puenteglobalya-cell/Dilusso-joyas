/**
 * GET /api/cron/keep-alive
 * Hace un SELECT mínimo a Supabase los sábados para evitar que el proyecto
 * sea pausado por inactividad (Supabase pausa proyectos sin actividad en 7 días).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from("exchange_rates") as any)
    .select("id")
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ping: new Date().toISOString() });
}
