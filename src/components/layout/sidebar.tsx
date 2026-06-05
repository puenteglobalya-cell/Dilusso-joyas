"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Upload, Table2, AlertCircle, Briefcase,
  User, Receipt, BookOpen, DollarSign, Users,
} from "lucide-react";
import { LogoutButton } from "./logout-button";

const navContador = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin", label: "Importar", icon: Upload },
  { href: "/consolidado", label: "Consolidado", icon: Table2 },
  { href: "/sin-conciliar", label: "Sin conciliar", icon: AlertCircle },
  { href: "/negocio", label: "Negocio", icon: Briefcase },
  { href: "/personal", label: "Movimientos de Cecilia", icon: User },
  { href: "/liquidaciones", label: "Liquidaciones", icon: Receipt },
  { href: "/diccionario", label: "Diccionario", icon: BookOpen },
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
}

export function Sidebar({ role, email, allowedSections }: SidebarProps) {
  const pathname = usePathname();
  const isContador = role === "contador";

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
    <aside className="w-56 min-h-screen bg-white border-r border-gray-100 flex flex-col shadow-sm">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {/* Red L mark — caligráfica cursiva */}
          <div className="w-8 h-10 flex items-end justify-start shrink-0">
            <svg viewBox="0 0 48 56" fill="none" className="w-full h-full">
              <path d="M28 3 C25 3 22 5 20 8 L8 44 C7 47 9 50 12 50 L40 50 C43 50 45 48 45 45 C45 42 43 40 40 40 L18 40 L29 8 C30 5 28 3 28 3 Z" fill="#C8102E"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold tracking-widest text-black uppercase leading-none">DILUSSO</p>
            <p className="text-xs tracking-[0.3em] text-gray-500 leading-none mt-0.5">j o y a s</p>
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mt-3 uppercase tracking-widest">Gestión Financiera</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className={cn(
                "flex items-center gap-3 px-5 py-2.5 text-sm transition-colors mx-2 rounded-lg",
                active
                  ? "bg-brand-light text-brand font-semibold"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", active ? "text-brand" : "")} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-100 space-y-1.5">
        {email && <p className="text-xs text-gray-400 truncate">{email}</p>}
        <LogoutButton />
      </div>
    </aside>
  );
}
