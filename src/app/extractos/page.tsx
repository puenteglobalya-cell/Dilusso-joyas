import { createServerClient } from "@/lib/supabase";
import Link from "next/link";
import { Building2, CheckCircle, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Extractos bancarios | Dilusso Joyas" };

export default async function ExtractosPage() {
  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb.from("bank_statements") as any)
    .select("banco, cuenta, moneda, fecha, saldo, debito, credito")
    .order("fecha", { ascending: false });

  type BankRow = {
    banco: string; cuenta: string | null; moneda: string;
    fecha: string; saldo: number | null; debito: number | null; credito: number | null;
  };
  const rows = (data ?? []) as BankRow[];

  // Group by banco + moneda → separate "account"
  const byKey = rows.reduce<Record<string, BankRow[]>>((acc, r) => {
    const key = `${r.banco}||${r.moneda}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const keys = Object.keys(byKey).sort();

  if (keys.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-2">Extractos bancarios</h1>
        <p className="text-sm text-muted mb-6">Movimientos importados directamente desde los extractos de cada banco.</p>
        <div className="bg-surface border border-dashed border-gray-200 rounded-xl p-12 text-center">
          <Building2 className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-muted text-sm font-medium">No hay extractos importados todavía</p>
          <Link href="/admin" className="text-brand text-sm underline mt-2 inline-block">Importar extracto →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Extractos bancarios</h1>
      <p className="text-sm text-muted mb-6">Cada cuenta se muestra por separado según banco y moneda.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {keys.map((key) => {
          const [banco, moneda] = key.split("||");
          const movs = byKey[key];
          const total = movs.length;
          const fechas = movs.map((r) => r.fecha).sort();
          const desde = fechas[0];
          const hasta = fechas[fechas.length - 1];

          // Account numbers (distinct, non-null)
          const cuentas = [...new Set(movs.map((r) => r.cuenta).filter(Boolean))];

          // Simple balance consistency check within same moneda
          const conSaldo = movs
            .filter((r) => r.saldo !== null && r.saldo !== 0)
            .sort((a, b) => a.fecha.localeCompare(b.fecha));
          let errores = 0;
          for (let i = 1; i < conSaldo.length; i++) {
            const prev = conSaldo[i - 1];
            const cur = conSaldo[i];
            if (prev.saldo === null || cur.saldo === null) continue;
            const esperado = prev.saldo + (cur.credito ?? 0) - (cur.debito ?? 0);
            if (Math.abs(esperado - cur.saldo) > 1) errores++;
          }

          const slug = encodeURIComponent(key); // "BBVA||UYU" → URL-encoded

          return (
            <Link key={key} href={`/extractos/${slug}`} className="block">
              <div className="bg-white rounded-xl border hover:border-brand hover:shadow-sm transition-all p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-gray-900 text-lg leading-tight">{banco}</p>
                    <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full
                      ${moneda === "USD" ? "bg-green-100 text-olive" : "bg-brand-light text-brand-dark"}`}>
                      {moneda}
                    </span>
                  </div>
                  {errores === 0
                    ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                    : <AlertCircle className="w-4 h-4 text-orange-500 shrink-0" />}
                </div>

                {cuentas.length > 0 && (
                  <p className="text-xs font-mono text-subtle mb-3">{cuentas.join(" · ")}</p>
                )}

                <p className="text-2xl font-bold text-gray-900 mb-1">{total}</p>
                <p className="text-xs text-muted">movimientos</p>

                <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-subtle">
                  <p>{hasta?.slice(0, 7)} → {desde?.slice(0, 7)}</p>
                  {errores > 0 && <p className="text-orange-500 mt-0.5">{errores} inconsistencias</p>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
