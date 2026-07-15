import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireUser } from "@/lib/admin-auth";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const sp = req.nextUrl.searchParams;
  const tipo = sp.get("tipo");       // "negocio" | "personal" | null (todos)
  const banco = sp.get("banco");
  const año = sp.get("año");
  const mes = sp.get("mes");
  const categoria = sp.get("categoria");
  const clasificado = sp.get("clasificado"); // "Si" | "No" | null

  const sb = createServerClient();
  const PAGE = 2000;
  let all: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (sb.from("bank_statements") as any)
      .select("fecha,banco,descripcion,debito,credito,saldo,moneda,importe_uyu,tc,tipo,categoria_negocio,categoria_personal,clasificado,nota,numero")
      .neq("descripcion", "Saldo anterior")
      .order("fecha", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + PAGE - 1);

    if (tipo) q = q.eq("tipo", tipo);
    if (banco) q = q.eq("banco", banco);
    if (clasificado) q = q.eq("clasificado", clasificado);

    if (año && mes) {
      const y = parseInt(año), m = parseInt(mes);
      const nextM = m === 12 ? 1 : m + 1;
      const nextY = m === 12 ? y + 1 : y;
      const pad = (n: number) => String(n).padStart(2, "0");
      q = q.gte("fecha", `${y}-${pad(m)}-01`).lt("fecha", `${nextY}-${pad(nextM)}-01`);
    } else if (año) {
      q = q.gte("fecha", `${año}-01-01`).lt("fecha", `${parseInt(año) + 1}-01-01`);
    }

    if (tipo === "negocio" && categoria) q = q.eq("categoria_negocio", categoria);
    if (tipo === "personal" && categoria) q = q.eq("categoria_personal", categoria);

    const { data } = await q;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  if (!all.length) {
    return new NextResponse("Sin datos", { status: 404 });
  }

  // Build worksheet rows
  const rows = all.map(r => ({
    Fecha: r.fecha,
    Banco: r.banco,
    Descripción: r.descripcion ?? "",
    "N° Cheque": r.numero ?? "",
    Débito: r.debito ?? "",
    Crédito: r.credito ?? "",
    Saldo: r.saldo ?? "",
    Moneda: r.moneda,
    "Imp. UYU": r.importe_uyu ?? "",
    TC: r.tc ?? "",
    Tipo: r.tipo ?? "",
    "Cat. Negocio": r.categoria_negocio ?? "",
    "Cat. Personal": r.categoria_personal ?? "",
    Clasificado: r.clasificado ?? "",
    Nota: r.nota ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 12 }, { wch: 12 }, { wch: 40 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 8 },
    { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 22 },
    { wch: 22 }, { wch: 12 }, { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  const sheetName = tipo ? (tipo === "negocio" ? "Negocio" : "Personal") : banco ? banco : "Movimientos";
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  // Build filename
  const parts = [banco ?? tipo ?? "todos"];
  if (año) parts.push(año);
  if (mes) parts.push(String(mes).padStart(2, "0"));
  const filename = `dilusso-${parts.join("-")}.xlsx`;

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
