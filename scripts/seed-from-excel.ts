// Script para importar datos del Excel a Supabase
// Ejecutar: npx tsx scripts/seed-from-excel.ts

import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env.local") });

const EXCEL_PATH = "/root/.claude/uploads/493f5f6d-dc72-4a2a-b8d7-3ae0b1d54176/d65da48c-2025_Cecilia_SCLEIDOROVICH_1.xlsx";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function parseDate(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split("T")[0];
  const s = String(val).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

function parseNum(val: unknown): number | null {
  if (val == null || val === "") return null;
  const n = Number(val);
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

async function seedTransactions() {
  console.log("📖 Leyendo Consolidado...");
  const wb = XLSX.readFile(EXCEL_PATH, { cellDates: true });
  const ws = wb.Sheets["Consolidado"];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: false, defval: null });

  const transactions = [];
  for (const row of rows) {
    const fecha = parseDate(row["Fecha"]);
    if (!fecha) continue;

    const impUyu = parseNum(row["Importe en UYU"]);
    const impOrigen = parseNum(row["Importe origen"]);
    const movimiento = String(row["Movimiento"] ?? "").toLowerCase().trim();
    const tipo = String(row["Tipo"] ?? "").toLowerCase().trim();
    const clasificado = String(row["Clasificado"] ?? "").toLowerCase() === "si";

    // Determinar categoría según tipo
    let categoria: string | null = null;
    if (tipo === "negocio") {
      categoria = String(row["Categoria"] ?? "").trim() || null;
    } else {
      categoria = String(row["Categoria personal"] ?? row["Personal"] ?? "").trim() || null;
    }
    if (categoria === " " || categoria === "") categoria = null;

    const mes = parseNum(row["Mes"]);
    const año = parseNum(row["año"]);

    transactions.push({
      banco: normalizeBanco(row["Banco"]),
      fecha,
      mes: mes ? Math.round(mes) : null,
      año: año ? Math.round(año) : null,
      detalle: row["Detalle"] ? String(row["Detalle"]).substring(0, 500) : null,
      movimiento: movimiento === "salida" ? "salida" : movimiento === "ingreso" ? "ingreso" : null,
      clasificado,
      tipo: tipo === "negocio" ? "negocio" : tipo === "personal" ? "personal" : null,
      categoria,
      moneda: String(row["Moneda"] ?? "UYU").trim().toUpperCase(),
      tc: parseNum(row["TC"]),
      importe_uyu: impUyu ? Math.abs(impUyu) : null,
      importe_origen: impOrigen ? Math.abs(impOrigen) : null,
      comentario: row["Comentario 1"] ? String(row["Comentario 1"]).substring(0, 500) : null,
    });
  }

  console.log(`✅ ${transactions.length} transacciones parseadas`);

  // Insertar en batches de 500
  let inserted = 0;
  for (let i = 0; i < transactions.length; i += 500) {
    const batch = transactions.slice(i, i + 500);
    const { error } = await sb.from("transactions").insert(batch as Parameters<typeof sb.from>[0] extends never ? never : unknown[]);
    if (error) {
      console.error(`❌ Error en batch ${i}-${i + 500}:`, error.message);
    } else {
      inserted += batch.length;
      console.log(`  → ${inserted}/${transactions.length}`);
    }
  }
  console.log(`✅ Transacciones insertadas: ${inserted}`);
}

async function seedSettlements() {
  console.log("📖 Leyendo Liquidaciones...");
  const wb = XLSX.readFile(EXCEL_PATH, { cellDates: true });

  // Encontrar la hoja de liquidaciones
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes("iquid")) ?? "";
  if (!sheetName) { console.error("❌ No se encontró hoja de liquidaciones"); return; }

  const ws = wb.Sheets[sheetName];
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false });

  // Encontrar fila de headers
  const headerIdx = allRows.findIndex((r) => Array.isArray(r) && String(r[0]).toLowerCase().includes("desde"));
  if (headerIdx < 0) { console.error("❌ No se encontró header de liquidaciones"); return; }

  const headers = (allRows[headerIdx] as unknown[]).map((h) => String(h ?? "").trim());
  const settlements = [];

  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const row = allRows[i] as unknown[];
    const desde = parseDate(row[0]);
    if (!desde) continue;

    settlements.push({
      desde,
      hasta: parseDate(row[1]) ?? desde,
      año: parseNum(row[2]) ? Math.round(parseNum(row[2])!) : null,
      mes: parseNum(row[3]) ? Math.round(parseNum(row[3])!) : null,
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

  console.log(`✅ ${settlements.length} liquidaciones parseadas`);
  const { error } = await sb.from("settlements").insert(settlements as unknown[]);
  if (error) {
    console.error("❌ Error insertando liquidaciones:", error.message);
  } else {
    console.log(`✅ Liquidaciones insertadas: ${settlements.length}`);
  }
}

async function main() {
  console.log("🚀 Iniciando seed desde Excel...\n");
  await seedTransactions();
  console.log("");
  await seedSettlements();
  console.log("\n🎉 Seed completado");
}

main().catch(console.error);
