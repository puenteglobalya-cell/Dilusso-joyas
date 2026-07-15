import { NextResponse } from "next/server";
import { getSupabaseServerClient, createServerClient } from "./supabase";

type AuthOk = { ok: true; userId: string };
type AuthFail = { ok: false; response: NextResponse };

/** Any logged-in user (contador or cliente) — for read endpoints that aren't admin-only. */
export async function requireUser(): Promise<AuthOk | AuthFail> {
  let authClient;
  try {
    authClient = await getSupabaseServerClient();
  } catch {
    return { ok: false, response: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }

  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }

  return { ok: true, userId: user.id };
}

export async function requireAdmin(): Promise<AuthOk | AuthFail> {
  let authClient;
  try {
    authClient = await getSupabaseServerClient();
  } catch {
    return { ok: false, response: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }

  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }

  // Read role with the service-role client — the anon client is subject to RLS
  // and may not be able to read profiles, which would wrongly deny access.
  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile, error: profileError } = await (sb.from("profiles") as any)
    .select("role").eq("id", user.id).single();

  // Same fallback as middleware: if the profile can't be read (e.g. RLS or
  // missing row), default to contador so a logged-in user isn't locked out.
  const role = profile?.role ?? (profileError ? "contador" : "cliente");

  if (role !== "contador") {
    return { ok: false, response: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }) };
  }

  return { ok: true, userId: user.id };
}
