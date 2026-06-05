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
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/consolidado", label: "Consolidado", icon: Table2 },
  { href: "/sin-conciliar", label: "Sin conciliar", icon: AlertCircle },
  { href: "/negocio", label: "Negocio", icon: Briefcase },
  { href: "/personal", label: "Personal", icon: User },
  { href: "/liquidaciones", label: "Liquidaciones", icon: Receipt },
  { href: "/diccionario", label: "Diccionario", icon: BookOpen },
  { href: "/tc", label: "Tipo de cambio", icon: DollarSign },
  { href: "/usuarios", label: "Usuarios", icon: Users },
];

const navCliente = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/negocio", label: "Negocio", icon: Briefcase },
  { href: "/personal", label: "Personal", icon: User },
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

  // Filtrar por permisos si es cliente
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
    <aside className="w-56 min-h-screen bg-slate-900 text-white flex flex-col">
      <div className="px-6 py-5 border-b border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest">Dilusso Joyas</p>
        <p className="text-sm font-semibold mt-0.5">Gestión Financiera</p>
      </div>
      <nav className="flex-1 py-4">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-6 py-2.5 text-sm transition-colors hover:bg-slate-800",
              pathname === href ? "bg-slate-800 text-white font-medium" : "text-slate-400"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-6 py-4 border-t border-slate-700 space-y-2">
        {email && <p className="text-xs text-slate-500 truncate">{email}</p>}
        <LogoutButton />
      </div>
    </aside>
  );
}
