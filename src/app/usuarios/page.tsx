import { createServerClient, getSupabaseServerClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { UserPermissionsTable } from "@/components/usuarios/permissions-table";
import { InviteUserForm } from "@/components/usuarios/invite-form";

export const dynamic = "force-dynamic";

const SECCIONES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "negocio", label: "Negocio" },
  { key: "personal", label: "Personal" },
  { key: "liquidaciones", label: "Liquidaciones" },
  { key: "consolidado", label: "Consolidado" },
  { key: "tc", label: "Tipo de cambio" },
];

export default async function UsuariosPage() {
  const authClient = await getSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) redirect("/login");

  // Read role with service-role client — the anon client is subject to RLS
  // and may not be able to read profiles, wrongly redirecting a contador away.
  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile, error: profileError } = await (sb.from("profiles") as any).select("role").eq("id", user.id).single();
  const role = profile?.role ?? (profileError ? "contador" : "cliente");
  if (role !== "contador") redirect("/");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profiles } = await (sb.from("profiles") as any).select("*").order("created_at");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: permissions } = await (sb.from("user_permissions") as any).select("*");

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Usuarios</h1>
          <p className="text-sm text-muted mt-1">Gestioná accesos y permisos por sección</p>
        </div>
        <InviteUserForm />
      </div>

      <UserPermissionsTable
        profiles={(profiles ?? []) as { id: string; email: string; nombre: string | null; role: string }[]}
        permissions={(permissions ?? []) as { user_id: string; seccion: string; enabled: boolean }[]}
        secciones={SECCIONES}
      />
    </div>
  );
}
