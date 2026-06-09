import { createServerClient } from "@/lib/supabase";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Download } from "lucide-react";
import { formatUYU } from "@/lib/utils";
import BankStatementTable, { type Row } from "./BankStatementTable";
import { GapAdjuster } from "@/components/bank/GapAdjuster";

export const dynamic = "force-dynamic";

interface PeriodGap {
  fecha: string;       // fecha of the Saldo anterior row
  esperado: number;    // last saldo of previous period
  recibido: number;    // saldo of this Saldo anterior
  diff: number;
}

function checkPeriodContinuity(rows: Row[], computed: (number | null)[]): PeriodGap[] {
  const gaps: PeriodGap[] = [];

  for (let i = 1; i < rows.length; i++) {
    if (rows[i].descripcion !== "Saldo anterior") continue;

    // Find the computed saldo of the last non-SA entry before this "Saldo anterior".
    // Rows are sorted SA-first within each date so that same-date regular entries
    // (belonging to the new period) don't appear before the SA in the comparison.
    let prevComputed: number | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (rows[j].descripcion !== "Saldo anterior") {
        prevComputed = computed[j];
        break;
      }
    }

    const declared = rows[i].saldo;
    if (prevComputed === null || declared === null) continue;
    if (Math.abs(declared - prevComputed) > 1) {
      gaps.push({
        fecha: rows[i].fecha,
        esperado: prevComputed,
        recibido: declared,
        diff: declared - prevComputed,
      });
    }
  }

  return gaps;
}

const CREDIT_CARD_BANKS = ["Scotiabank", "Itau-Card"];

export default async function ExtractoBancoPage({ params }: { params: Promise<{ banco: string }> }) {
  const { banco } = await params;
  // Slug format: "BBVA||UYU" (banco + moneda separated by ||)
  const slug = decodeURIComponent(banco);
  const [bancoNombre, moneda] = slug.includes("||") ? slug.split("||") : [slug, null];

  const isCreditCard = CREDIT_CARD_BANKS.includes(bancoNombre);

  const sb = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: catData } = await (sb.from("categories") as any).select("name, type").order("name");
  const catsNegocio: string[] = (catData ?? []).filter((c: { type: string }) => c.type === "negocio").map((c: { name: string }) => c.name);
  const catsPersonal: string[] = (catData ?? []).filter((c: { type: string }) => c.type === "personal").map((c: { name: string }) => c.name);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (sb.from("bank_statements") as any)
    .select("*")
    .eq("banco", bancoNombre)
    .order("fecha", { ascending: true })
    .order("created_at", { ascending: true });

  if (moneda) query = query.eq("moneda", moneda);


  const { data } = await query;
  // Sort SA-first within each date so same-date regular entries (new period)
  // don't appear before the SA and cause false continuity breaks.
  const rawRows = (data ?? []) as Row[];
  const rows = [...rawRows].sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
    const aIsSA = a.descripcion === "Saldo anterior" ? 0 : 1;
    const bIsSA = b.descripcion === "Saldo anterior" ? 0 : 1;
    if (aIsSA !== bIsSA) return aIsSA - bIsSA;
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });

  const pageTitle = moneda ? `${bancoNombre} — ${moneda}` : bancoNombre;

  if (rows.length === 0) {
    return (
      <div className="p-8">
        <Link href="/extractos" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Extractos
        </Link>
        <p className="text-gray-500">No hay movimientos para {pageTitle}.</p>
      </div>
    );
  }

  const meses = [...new Set(rows.map((r) => r.fecha.slice(0, 7)))].sort();

  // Credit cards: no running saldo, no period continuity check
  if (isCreditCard) {
    const rowsWithSaldo = rows.map((r) => ({ ...r, ok: true, diff: null as null, computedSaldo: null as null }));

    const gastosUYU = rows.filter((r) => r.moneda === "UYU").reduce((s, r) => s + (r.debito ?? 0), 0);
    const gastosUSD = rows.filter((r) => r.moneda === "USD").reduce((s, r) => s + (r.debito ?? 0), 0);
    const pagosUYU = rows.filter((r) => r.moneda === "UYU").reduce((s, r) => s + (r.credito ?? 0), 0);
    const pagosUSD = rows.filter((r) => r.moneda === "USD").reduce((s, r) => s + (r.credito ?? 0), 0);

    return (
      <div className="p-8 max-w-5xl">
        <Link href="/extractos" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Extractos
        </Link>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{pageTitle}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{rows.length} movimientos · {meses[0]} a {meses[meses.length - 1]}</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/api/admin/export-bank-xlsx?banco=${encodeURIComponent(bancoNombre)}${moneda ? `&moneda=${moneda}` : ""}`}
              className="flex items-center gap-1.5 text-xs px-3 h-8 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
              download
            >
              <Download className="w-3.5 h-3.5" />Excel
            </a>
            <Link href="/admin" className="text-xs text-brand underline">Importar más →</Link>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 mb-1">Gastos UYU</p>
            <p className="text-lg font-bold text-red-600">{formatUYU(gastosUYU)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 mb-1">Gastos USD</p>
            <p className="text-lg font-bold text-red-600">U$ {gastosUSD.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 mb-1">Pagos UYU</p>
            <p className="text-lg font-bold text-green-600">{formatUYU(pagosUYU)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 mb-1">Pagos USD</p>
            <p className="text-lg font-bold text-green-600">U$ {pagosUSD.toFixed(2)}</p>
          </div>
        </div>
        <BankStatementTable rows={rowsWithSaldo} isCreditCard catsNegocio={catsNegocio} catsPersonal={catsPersonal} />
      </div>
    );
  }

  // Bank accounts: compute running saldo + period continuity
  let running: number | null = null;
  const withCheck = rows.map((row) => {
    if (row.descripcion === "Saldo anterior") {
      running = row.saldo;
      return { ...row, ok: true, diff: null as null, computedSaldo: row.saldo };
    }
    if (running === null && row.saldo !== null) {
      running = row.saldo;
      return { ...row, ok: true, diff: null as null, computedSaldo: running };
    }
    if (running !== null) {
      running = running - (row.debito ?? 0) + (row.credito ?? 0);
    }
    return { ...row, ok: true, diff: null as null, computedSaldo: running };
  });

  const gaps = checkPeriodContinuity(rows, withCheck.map((r) => r.computedSaldo));

  const saldoInicial = withCheck[0].computedSaldo;
  const saldoFinal = withCheck[withCheck.length - 1].computedSaldo;
  const totalCredito = rows.reduce((s, r) => s + (r.credito ?? 0), 0);
  const totalDebito = rows.reduce((s, r) => s + (r.debito ?? 0), 0);

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/extractos" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Extractos
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{pageTitle}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{rows[0]?.cuenta && `Cuenta ${rows[0].cuenta} · `}{rows.length} movimientos · {meses[0]} a {meses[meses.length - 1]}</p>
        </div>
        <Link href="/admin" className="text-xs text-brand underline">Importar más →</Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 mb-1">Saldo inicial</p>
          <p className="text-lg font-bold">{saldoInicial != null ? formatUYU(saldoInicial) : "—"}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 mb-1">Saldo final</p>
          <p className="text-lg font-bold">{saldoFinal != null ? formatUYU(saldoFinal) : "—"}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 mb-1">Total ingresos</p>
          <p className="text-lg font-bold text-green-600">{formatUYU(totalCredito)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 mb-1">Total egresos</p>
          <p className="text-lg font-bold text-red-600">{formatUYU(totalDebito)}</p>
        </div>
      </div>

      {/* Period continuity validation */}
      <GapAdjuster gaps={gaps} banco={bancoNombre} moneda={moneda ?? "UYU"} />

      <BankStatementTable rows={withCheck} isCreditCard={false} catsNegocio={catsNegocio} catsPersonal={catsPersonal} />
    </div>
  );
}
