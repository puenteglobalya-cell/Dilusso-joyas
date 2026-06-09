import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "./supabase";

type AuthOk = { ok: true; userId: string };
type AuthFail = { ok: false; response: NextResponse };

export async function requireAdmin(): Promise<AuthOk | AuthFail> {
  let sb;
  try {
    sb = await getSupabaseServerClient();
  } catch {
    return { ok: false, response: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }

  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (sb.from("profiles") as any)
    .select("role").eq("id", user.id).single();

  if (profile?.role !== "contador") {
    return { ok: false, response: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }) };
  }

  return { ok: true, userId: user.id };
}
