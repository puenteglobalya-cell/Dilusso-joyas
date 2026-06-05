"use client";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Email o contraseña incorrectos");
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16">
              <svg viewBox="0 0 40 44" fill="none" className="w-full h-full">
                <path d="M8 2 C6 2 4 4 4 6 L4 36 C4 38 6 40 8 40 L32 40 C34 40 36 38 36 36 C36 34 34 32 32 32 L14 32 L14 6 C14 4 12 2 10 2 Z" fill="#C8102E"/>
                <path d="M4 28 C4 26 6 24 8 23 L32 18 C34 17 36 19 36 21 C36 23 34 25 32 26 L14 30 L14 32 L4 32 Z" fill="#C8102E"/>
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold tracking-widest text-black uppercase">DILUSSO</p>
          <p className="text-sm tracking-[0.4em] text-gray-400 mt-0.5">j o y a s</p>
          <p className="text-xs text-gray-400 mt-3 uppercase tracking-widest">Gestión Financiera</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              placeholder="tu@email.com"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg transition-colors disabled:opacity-50 text-sm uppercase tracking-wider mt-2"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
