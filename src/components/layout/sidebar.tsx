"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Upload,
  Table2,
  AlertCircle,
  Briefcase,
  User,
  Receipt,
  BookOpen,
  DollarSign,
} from "lucide-react";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/consolidado", label: "Consolidado", icon: Table2 },
  { href: "/sin-conciliar", label: "Sin conciliar", icon: AlertCircle },
  { href: "/negocio", label: "Negocio", icon: Briefcase },
  { href: "/personal", label: "Personal", icon: User },
  { href: "/liquidaciones", label: "Liquidaciones", icon: Receipt },
  { href: "/diccionario", label: "Diccionario", icon: BookOpen },
  { href: "/tc", label: "Tipo de cambio", icon: DollarSign },
];

export function Sidebar() {
  const pathname = usePathname();
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
      <div className="px-6 py-4 border-t border-slate-700 text-xs text-slate-500">
        v1.0 · Uruguay
      </div>
    </aside>
  );
}
