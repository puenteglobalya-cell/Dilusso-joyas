import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { getSupabaseServerClient, createServerClient } from "@/lib/supabase";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dilusso Joyas · Gestión Financiera",
  description: "Dashboard financiero Dilusso Joyas",
  icons: { icon: "/favicon.svg" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const authClient = await getSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();

  let role: string | undefined;
  let email: string | undefined;
  let allowedSections: string[] | undefined;
  let missingMonths = 0;
  let sinClasificar = 0;

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

    if (role === "contador") {
      // Fetch badge counts in parallel (best-effort — silently ignore errors)
      const now = new Date();
      const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const [coverageRes, sinClasRes] = await Promise.allSettled([
        (async () => {
          const PAGE = 1000;
          let rows: { banco: string; moneda: string; fecha: string }[] = [];
          let from = 0;
          while (true) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (sb.from("bank_statements") as any)
              .select("banco, moneda, fecha")
              .range(from, from + PAGE - 1);
            if (error || !data || data.length === 0) break;
            rows = rows.concat(data);
            if (data.length < PAGE) break;
            from += PAGE;
          }
          return rows;
        })(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sb.from("bank_statements") as any)
          .select("id", { count: "exact", head: true })
          .eq("clasificado", "No")
          .neq("descripcion", "Saldo anterior"),
      ]);

      // Count missing months
      if (coverageRes.status === "fulfilled") {
        const rows = coverageRes.value;
        if (rows.length > 0) {
          const loaded = new Set(rows.map((r: { banco: string; moneda: string; fecha: string }) => `${r.banco}|${r.moneda}|${r.fecha.slice(0, 7)}`));
          const BANCOS = [
            { banco: "BBVA", moneda: "UYU" }, { banco: "BBVA", moneda: "USD" },
            { banco: "Itaú", moneda: "UYU" }, { banco: "Itaú", moneda: "USD" },
            { banco: "OCA", moneda: null }, { banco: "Scotiabank", moneda: null },
            { banco: "Itau-Card", moneda: null },
          ];
          const earliest = rows.map((r: { fecha: string }) => r.fecha.slice(0, 7)).sort()[0];
          const allMonths: string[] = [];
          let cur = earliest;
          while (cur <= currentYM) {
            allMonths.push(cur);
            const [y, m] = cur.split("-").map(Number);
            cur = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
          }
          for (const b of BANCOS) {
            for (const ym of allMonths) {
              if (ym > currentYM) continue;
              const keyAny = rows.some((r: { banco: string; moneda: string; fecha: string }) =>
                r.banco === b.banco && (b.moneda ? r.moneda === b.moneda : true) && r.fecha.slice(0, 7) === ym
              );
              const key = `${b.banco}|${b.moneda ?? ""}|${ym}`;
              const isLoaded = b.moneda ? loaded.has(key) : keyAny;
              if (!isLoaded) missingMonths++;
            }
          }
        }
      }

      // Count unclassified rows
      if (sinClasRes.status === "fulfilled") {
        sinClasificar = (sinClasRes.value as { count: number | null }).count ?? 0;
      }
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
            <Sidebar
              role={role}
              email={email}
              allowedSections={allowedSections}
              missingMonths={missingMonths}
              sinClasificar={sinClasificar}
            />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        )}
      </body>
    </html>
  );
}
