"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Upload, Table2, AlertCircle, Briefcase,
  User, Receipt, BookOpen, DollarSign, Users, Building2, StickyNote, Search,
} from "lucide-react";
import { LogoutButton } from "./logout-button";

const navContador = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin", label: "Importar", icon: Upload, badgeKey: "missingMonths" },
  { href: "/buscar", label: "Buscar", icon: Search },
  { href: "/sin-conciliar", label: "Sin conciliar", icon: AlertCircle, badgeKey: "sinClasificar" },
  { href: "/negocio", label: "Negocio", icon: Briefcase },
  { href: "/extractos", label: "Extractos bancarios", icon: Building2 },
  { href: "/personal", label: "Movimientos de Cecilia", icon: User },
  { href: "/liquidaciones", label: "Liquidaciones", icon: Receipt },
  { href: "/diccionario", label: "Diccionario", icon: BookOpen },
  { href: "/notas", label: "Notas", icon: StickyNote },
  { href: "/tc", label: "Tipo de cambio", icon: DollarSign },
  { href: "/usuarios", label: "Usuarios", icon: Users },
];

const navCliente = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/negocio", label: "Negocio", icon: Briefcase },
  { href: "/personal", label: "Movimientos de Cecilia", icon: User },
  { href: "/liquidaciones", label: "Liquidaciones", icon: Receipt },
];

interface SidebarProps {
  role?: string;
  email?: string;
  allowedSections?: string[];
  missingMonths?: number;
  sinClasificar?: number;
}

export function Sidebar({ role, email, allowedSections, missingMonths, sinClasificar }: SidebarProps) {
  const pathname = usePathname();
  const isContador = role === "contador";

  const badges: Record<string, number> = {};
  if (missingMonths) badges.missingMonths = missingMonths;
  if (sinClasificar) badges.sinClasificar = sinClasificar;

  let nav = isContador ? navContador : navCliente;

  if (!isContador && allowedSections) {
    const sectionMap: Record<string, string> = {
      "/": "dashboard",
      "/negocio": "negocio",
      "/personal": "personal",
      "/liquidaciones": "liquidaciones",
    };
    nav = nav.filter((item) => {
      const key = sectionMap[item.href];
      return !key || allowedSections.includes(key);
    });
  }

  return (
    <aside className="w-56 min-h-screen flex flex-col" style={{ background: "#2a1f1a" }}>
      {/* Logo */}
      <div className="px-6 py-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-9 flex items-end justify-start shrink-0">
            <svg viewBox="0 0 48 56" fill="none" className="w-full h-full">
              <path d="M28 3 C25 3 22 5 20 8 L8 44 C7 47 9 50 12 50 L40 50 C43 50 45 48 45 45 C45 42 43 40 40 40 L18 40 L29 8 C30 5 28 3 28 3 Z" fill="#C8102E"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold tracking-widest uppercase leading-none" style={{ color: "#f5f0eb" }}>DILUSSO</p>
            <p className="text-[10px] tracking-[0.3em] leading-none mt-1" style={{ color: "#9c8a7e" }}>j o y a s</p>
          </div>
        </div>
        <p className="text-[9px] uppercase tracking-widest mt-3" style={{ color: "#6b5a51" }}>Gestión Financiera</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-0.5">
        {nav.map(({ href, label, icon: Icon, badgeKey }: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; badgeKey?: string }) => {
          const active = pathname === href;
          const badgeCount = badgeKey ? (badges[badgeKey] ?? 0) : 0;
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 text-sm transition-all mx-2 rounded-lg",
                active
                  ? "font-semibold"
                  : "hover:opacity-100"
              )}
              style={active
                ? { background: "rgba(200,16,46,0.18)", color: "#f4a0a8" }
                : { color: "#9c8a7e" }
              }
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#d4bfb6"; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#9c8a7e"; }}
            >
              <Icon className={cn("w-4 h-4 shrink-0", active ? "text-brand" : "")} />
              <span className="flex-1">{label}</span>
              {badgeCount > 0 && (
                <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 space-y-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        {email && <p className="text-xs truncate" style={{ color: "#6b5a51" }}>{email}</p>}
        <LogoutButton />
      </div>
    </aside>
  );
}
