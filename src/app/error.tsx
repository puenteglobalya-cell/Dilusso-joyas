"use client";
import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <AlertCircle className="w-10 h-10 text-red-400 mb-4" />
      <h2 className="text-lg font-semibold text-slate-800 mb-1">No se pudo cargar esta sección</h2>
      <p className="text-sm text-muted mb-4">Ocurrió un error al conectar con la base de datos.</p>
      <button onClick={reset} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors">
        Reintentar
      </button>
    </div>
  );
}
