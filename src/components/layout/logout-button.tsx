"use client";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">¿Salir?</span>
        <button onClick={handleLogout} className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors">Sí</button>
        <button onClick={() => setConfirming(false)} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">No</button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-2 text-xs text-gray-400 hover:text-brand transition-colors"
    >
      <LogOut className="w-3.5 h-3.5" />
      Salir
    </button>
  );
}
