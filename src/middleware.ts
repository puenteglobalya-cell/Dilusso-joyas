import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login"];
const CONTADOR_ONLY = ["/upload", "/sin-conciliar", "/diccionario", "/consolidado", "/tc", "/usuarios"];
const SECTION_MAP: Record<string, string> = {
  "/negocio": "negocio",
  "/personal": "personal",
  "/liquidaciones": "liquidaciones",
  "/": "dashboard",
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (!user) return res;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile, error: profileError } = await (supabase.from("profiles") as any).select("role").eq("id", user.id).single();
  // If profile can't be read (e.g. RLS not yet configured), default to contador so
  // the user isn't locked out of their own app. The layout uses service-role and is authoritative.
  const role = profile?.role ?? (profileError ? "contador" : "cliente");

  // Rutas solo contador
  if (CONTADOR_ONLY.some((p) => pathname.startsWith(p)) && role !== "contador") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Verificar permisos de sección para clientes
  if (role === "cliente") {
    const sectionKey = SECTION_MAP[pathname] ?? Object.entries(SECTION_MAP).find(([p]) => pathname.startsWith(p) && p !== "/")?.[1];
    if (sectionKey && sectionKey !== "dashboard") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: perm } = await (supabase.from("user_permissions") as any)
        .select("enabled")
        .eq("user_id", user.id)
        .eq("seccion", sectionKey)
        .single();
      if (perm && !perm.enabled) {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
