import { createServerClient } from "@/lib/supabase";
import Link from "next/link";
import { Building2, CheckCircle, AlertCircle, Clock } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Extractos bancarios | Dilusso Joyas" };

const BANCO_LABELS: Record<string, string> = {
  BBVA: "BBVA",
  "Itaú": "Itaú",
  OCA: "OCA",
  Scotiabank: "Scotiabank",
  "Itau-Card": "Itaú Tarjeta VISA",
};

export default async function ExtractosPage() {
  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb.from("bank_statements") as any)
    .select("banco, fecha, saldo, debito, credito")
    .order("fecha", { ascending: false });

  const rows = (data ?? []) as { banco: string; fecha: string; saldo: number | null; debito: number | null; credito: number | null }[];

  // Group by banco
  const byBanco = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    if (!acc[r.banco]) acc[r.banco] = [];
    acc[r.banco].push(r);
    return acc;
  }, {});

  const bancos = Object.keys(byBanco).sort();

  if (bancos.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-2">Extractos bancarios</h1>
        <p className="text-sm text-gray-500 mb-6">Movimientos importados directamente desde los extractos de cada banco.</p>
        <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-12 text-center">
          <Building2 className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">No hay extractos importados todavía</p>
          <Link href="/admin" className="text-brand text-sm underline mt-2 inline-block">Importar extracto →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Extractos bancarios</h1>
      <p className="text-sm text-gray-500 mb-6">Movimientos importados directamente desde los extractos de cada banco.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {bancos.map((banco) => {
          const movs = byBanco[banco];
          const total = movs.length;
          const fechas = movs.map((r) => r.fecha).sort();
          const desde = fechas[fechas.length - 1]; // most recent first (desc order)
          const hasta = fechas[0];
          const sinSaldo = movs.filter((r) => r.saldo === null).length;

          // Quick balance consistency check
          const conSaldo = movs.filter((r) => r.saldo !== null).sort((a, b) => a.fecha.localeCompare(b.fecha));
          let errores = 0;
          for (let i = 1; i < conSaldo.length; i++) {
            const prev = conSaldo[i - 1];
            const cur = conSaldo[i];
            if (prev.saldo === null || cur.saldo === null) continue;
            const esperado = prev.saldo + (cur.credito ?? 0) - (cur.debito ?? 0);
            if (Math.abs(esperado - cur.saldo) > 1) errores++;
          }

          const ok = errores === 0 && sinSaldo === 0;
          const warn = errores > 0 || sinSaldo > total * 0.3;

          return (
            <Link key={banco} href={`/extractos/${encodeURIComponent(banco)}`} className="block">
              <div className="bg-white rounded-xl border hover:border-brand hover:shadow-sm transition-all p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-gray-400" />
                    <span className="font-semibold text-gray-900">{BANCO_LABELS[banco] ?? banco}</span>
                  </div>
                  {ok ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : warn ? (
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                  ) : (
                    <Clock className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <p className="text-2xl font-bold text-gray-900 mb-1">{total}</p>
                <p className="text-xs text-gray-500">movimientos</p>
                <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400 space-y-0.5">
                  <p>Desde {hasta?.slice(0, 7)} hasta {desde?.slice(0, 7)}</p>
                  {errores > 0 && <p className="text-orange-600">{errores} inconsistencias de saldo</p>}
                  {sinSaldo > 0 && <p className="text-gray-400">{sinSaldo} sin saldo</p>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
