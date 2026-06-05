"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, X } from "lucide-react";

export function InviteUserForm() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [role, setRole] = useState<"cliente" | "contador">("cliente");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleInvite() {
    if (!email) return;
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/usuarios/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, nombre, role }),
    });
    const data = await res.json();
    setResult({ ok: res.ok, message: data.message ?? data.error });
    setLoading(false);
    if (res.ok) {
      setEmail("");
      setNombre("");
      setTimeout(() => { setOpen(false); setResult(null); window.location.reload(); }, 2000);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        <UserPlus className="w-4 h-4 mr-2" /> Invitar usuario
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setOpen(false)}>
      <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Invitar usuario</h2>
          <button onClick={() => setOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@email.com" className="w-full text-sm border rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Nombre (opcional)</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del usuario" className="w-full text-sm border rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Rol</label>
            <select value={role} onChange={(e) => setRole(e.target.value as "cliente" | "contador")} className="w-full text-sm border rounded-md px-3 py-2">
              <option value="cliente">Cliente (solo lectura)</option>
              <option value="contador">Contador (acceso total)</option>
            </select>
          </div>
          {result && (
            <p className={`text-sm rounded-lg px-3 py-2 ${result.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {result.message}
            </p>
          )}
        </div>
        <div className="flex gap-2 mt-5">
          <Button onClick={handleInvite} disabled={!email || loading} className="flex-1">
            {loading ? "Enviando..." : "Enviar invitación"}
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
        </div>
      </div>
    </div>
  );
}
