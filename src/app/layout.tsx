import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { getSupabaseServerClient, createServerClient } from "@/lib/supabase";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dilusso Joyas · Gestión Financiera",
  description: "Dashboard financiero Dilusso Joyas",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const authClient = await getSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();

  let role: string | undefined;
  let email: string | undefined;
  let allowedSections: string[] | undefined;

  if (user) {
    email = user.email;
    const sb = createServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (sb.from("profiles") as any).select("role").eq("id", user.id).single();
    role = profile?.role;

    if (role === "cliente") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: perms } = await (sb.from("user_permissions") as any)
        .select("seccion, enabled")
        .eq("user_id", user.id);
      const disabled = new Set((perms ?? []).filter((p: { enabled: boolean }) => !p.enabled).map((p: { seccion: string }) => p.seccion));
      allowedSections = ["dashboard", "negocio", "personal", "liquidaciones"].filter((s) => !disabled.has(s));
    }
  }

  const isLoginPage = !user;

  return (
    <html lang="es">
      <body className={`${inter.className} bg-slate-50 text-slate-900`}>
        {isLoginPage ? (
          children
        ) : (
          <div className="flex min-h-screen">
            <Sidebar role={role} email={email} allowedSections={allowedSections} />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        )}
      </body>
    </html>
  );
}
