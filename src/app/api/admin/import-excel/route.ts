import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

function parseDate(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split("T")[0];
  const s = String(val).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const m2 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  return null;
}

function parseNum(val: unknown): number | null {
  if (val == null || val === "") return null;
  const n = Number(String(val).replace(",", "."));
  return isNaN(n) ? null : n;
}

function normalizeBanco(b: unknown): string {
  const s = String(b ?? "").trim().toLowerCase();
  if (s === "bbva") return "BBVA";
  if (s === "itau" || s === "itaú") return "Itaú";
  if (s === "oca") return "OCA";
  if (s.includes("scotiabank")) return "Scotiabank";
  if (s.includes("tarjeta") && s.includes("itau")) return "Tarjeta Itaú";
  if (s === "efectivo") return "Efectivo";
  if (s === "fadaval" || s === "fabadal") return "Fadaval";
  return String(b ?? "").trim();
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });

  const sb = createServerClient();
  const results: Record<string, number | string> = {};

  // ── Consolidado ──────────────────────────────────────────────────────────
  if (wb.SheetNames.includes("Consolidado")) {
    const ws = wb.Sheets["Consolidado"];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: false, defval: null });

    const transactions = [];
    for (const row of rows) {
      const fecha = parseDate(row["Fecha"]);
      if (!fecha) continue;

      const tipo = String(row["Tipo"] ?? "").toLowerCase().trim();
      let categoria: string | null = null;
      if (tipo === "negocio") {
        categoria = String(row["Categoria"] ?? "").trim() || null;
      } else {
        categoria = String(row["Categoria personal"] ?? row["Personal"] ?? "").trim() || null;
      }
      if (categoria === " " || categoria === "") categoria = null;

      const impUyu = parseNum(row["Importe en UYU"]);
      const impOrigen = parseNum(row["Importe origen"]);
      const mes = parseNum(row["Mes"]);
      const año = parseNum(row["año"]);

      transactions.push({
        banco: normalizeBanco(row["Banco"]),
        fecha,
        mes: mes ? Math.round(mes) : null,
        año: año ? Math.round(año) : null,
        detalle: row["Detalle"] ? String(row["Detalle"]).substring(0, 500) : null,
        movimiento: String(row["Movimiento"] ?? "").toLowerCase() === "salida" ? "salida" : "ingreso",
        clasificado: String(row["Clasificado"] ?? "").toLowerCase() === "si",
        tipo: tipo === "negocio" ? "negocio" : tipo === "personal" ? "personal" : null,
        categoria,
        moneda: String(row["Moneda"] ?? "UYU").trim().toUpperCase(),
        tc: parseNum(row["TC"]),
        importe_uyu: impUyu ? Math.abs(impUyu) : null,
        importe_origen: impOrigen ? Math.abs(impOrigen) : null,
        comentario: row["Comentario 1"] ? String(row["Comentario 1"]).substring(0, 500) : null,
      });
    }

    // Borrar existentes e insertar frescos
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from("transactions") as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");

    let inserted = 0;
    for (let i = 0; i < transactions.length; i += 500) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (sb.from("transactions") as any).insert(transactions.slice(i, i + 500));
      if (!error) inserted += Math.min(500, transactions.length - i);
    }
    results.transacciones = inserted;
  }

  // ── Liquidaciones ─────────────────────────────────────────────────────────
  const liqSheet = wb.SheetNames.find((n) => n.toLowerCase().includes("iquid"));
  if (liqSheet) {
    const ws2 = wb.Sheets[liqSheet];
    const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws2, { header: 1, raw: false });

    const headerIdx = allRows.findIndex((r) =>
      Array.isArray(r) && String(r[0]).toLowerCase().includes("desde")
    );

    const settlements = [];
    if (headerIdx >= 0) {
      for (let i = headerIdx + 1; i < allRows.length; i++) {
        const row = allRows[i] as unknown[];
        const desde = parseDate(row[0]);
        if (!desde) continue;
        const mes = parseNum(row[3]);
        const año = parseNum(row[2]);
        settlements.push({
          desde,
          hasta: parseDate(row[1]) ?? desde,
          año: año ? Math.round(año) : null,
          mes: mes ? Math.round(mes) : null,
          fecha_control: parseDate(row[4]),
          facturado: parseNum(row[5]),
          retiro_reserva: parseNum(row[6]),
          efectivo: parseNum(row[7]),
          tarjeta: parseNum(row[8]),
          fadaval: parseNum(row[9]),
          gastos: parseNum(row[10]),
          adelanto_sueldos: parseNum(row[11]),
        });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from("settlements") as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb.from("settlements") as any).insert(settlements);
    results.liquidaciones = error ? `Error: ${error.message}` : settlements.length;
  }

  return NextResponse.json({ ok: true, ...results });
}
