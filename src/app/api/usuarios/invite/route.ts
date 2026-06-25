import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";

// Admin client using service role (can create users)
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { email, nombre, role } = await req.json();
  if (!email) return NextResponse.json({ error: "Email requerido" }, { status: 400 });

  // Invite user via Supabase Admin API (sends magic link email)
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { nombre, role: role ?? "cliente" },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update profile with nombre and role
  if (data.user) {
    await adminClient
      .from("profiles")
      .update({ nombre: nombre ?? null, role: role ?? "cliente" })
      .eq("id", data.user.id);
  }

  return NextResponse.json({ message: `Invitación enviada a ${email}` });
}
