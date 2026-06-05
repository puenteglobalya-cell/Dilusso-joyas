"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface Profile { id: string; email: string; nombre: string | null; role: string }
interface Permission { user_id: string; seccion: string; enabled: boolean }
interface Seccion { key: string; label: string }

interface Props {
  profiles: Profile[];
  permissions: Permission[];
  secciones: Seccion[];
}

export function UserPermissionsTable({ profiles, permissions: initialPerms, secciones }: Props) {
  const [perms, setPerms] = useState<Permission[]>(initialPerms);
  const [saving, setSaving] = useState<string | null>(null);

  function isEnabled(userId: string, seccion: string): boolean {
    const p = perms.find((p) => p.user_id === userId && p.seccion === seccion);
    return p?.enabled ?? true;
  }

  async function togglePermission(userId: string, seccion: string, currentValue: boolean) {
    const key = `${userId}-${seccion}`;
    setSaving(key);

    const newValue = !currentValue;
    setPerms((prev) => {
      const existing = prev.findIndex((p) => p.user_id === userId && p.seccion === seccion);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], enabled: newValue };
        return next;
      }
      return [...prev, { user_id: userId, seccion, enabled: newValue }];
    });

    await fetch("/api/usuarios/permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, seccion, enabled: newValue }),
    });

    setSaving(null);
  }

  const clientes = profiles.filter((p) => p.role === "cliente");
  const contadores = profiles.filter((p) => p.role === "contador");

  return (
    <div className="space-y-8">
      {contadores.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Contadores</h2>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {contadores.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.nombre ?? p.email}</p>
                      <p className="text-xs text-slate-400">{p.email}</p>
                    </td>
                    <td className="px-4 py-3"><Badge>Acceso total</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Clientes</h2>
        {clientes.length === 0 ? (
          <p className="text-sm text-slate-400">Sin clientes registrados aún</p>
        ) : (
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Usuario</th>
                  {secciones.map((s) => (
                    <th key={s.key} className="text-center px-3 py-3 font-medium text-slate-500 whitespace-nowrap">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clientes.map((profile) => (
                  <tr key={profile.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{profile.nombre ?? profile.email}</p>
                      <p className="text-xs text-slate-400">{profile.email}</p>
                    </td>
                    {secciones.map((s) => {
                      const enabled = isEnabled(profile.id, s.key);
                      const key = `${profile.id}-${s.key}`;
                      return (
                        <td key={s.key} className="px-3 py-3 text-center">
                          <button
                            onClick={() => togglePermission(profile.id, s.key, enabled)}
                            disabled={saving === key}
                            className={`w-10 h-6 rounded-full transition-colors relative ${
                              enabled ? "bg-slate-900" : "bg-slate-200"
                            } ${saving === key ? "opacity-50" : ""}`}
                            title={enabled ? "Quitar acceso" : "Dar acceso"}
                          >
                            <span
                              className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                                enabled ? "left-5" : "left-1"
                              }`}
                            />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
