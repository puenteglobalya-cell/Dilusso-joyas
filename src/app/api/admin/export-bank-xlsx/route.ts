import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

// GET /api/admin/export-bank-xlsx?banco=BBVA&moneda=UYU
export async function GET(req: NextRequest) {
  const banco = req.nextUrl.searchParams.get("banco");
  const moneda = req.nextUrl.searchParams.get("moneda");

  if (!banco) return NextResponse.json({ error: "banco requerido" }, { status: 400 });

  const sb = createServerClient();
  const PAGE = 1000;
  type Row = {
    fecha: string; descripcion: string | null; numero: string | null;
    debito: number | null; credito: number | null; saldo: number | null;
    moneda: string; tipo: string | null; categoria_negocio: string | null;
    categoria_personal: string | null; banco: string; cuenta: string | null;
  };
  let all: Row[] = [];
  let from = 0;
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (sb.from("bank_statements") as any)
      .select("fecha,descripcion,numero,debito,credito,saldo,moneda,tipo,categoria_negocio,categoria_personal,banco,cuenta")
      .eq("banco", banco)
      .order("fecha", { ascending: true })
      .range(from, from + PAGE - 1);
    if (moneda) q = q.eq("moneda", moneda);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    all = all.concat(data as Row[]);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // Build worksheet data
  const headers = ["Fecha", "Descripción", "Nro", "Débito", "Crédito", "Saldo", "Moneda", "Tipo", "Categoría Negocio", "Categoría Personal"];
  const data = all.map(r => [
    r.fecha,
    r.descripcion ?? "",
    r.numero ?? "",
    r.debito ?? "",
    r.credito ?? "",
    r.saldo ?? "",
    r.moneda,
    r.tipo ?? "",
    r.categoria_negocio ?? "",
    r.categoria_personal ?? "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

  // Column widths
  ws["!cols"] = [
    { wch: 12 }, { wch: 40 }, { wch: 10 },
    { wch: 14 }, { wch: 14 }, { wch: 16 },
    { wch: 8 }, { wch: 10 }, { wch: 28 }, { wch: 28 },
  ];

  // Header row style (bold + light blue fill)
  const headerRange = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let c = headerRange.s.c; c <= headerRange.e.c; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[cellRef]) continue;
    ws[cellRef].s = { font: { bold: true }, fill: { fgColor: { rgb: "DBEAFE" } } };
  }

  // Color data rows by tipo
  for (let r = 1; r <= data.length; r++) {
    const tipo = data[r - 1][7]; // tipo column
    const color = tipo === "negocio" ? "DBEAFE" : tipo === "personal" ? "F3E8FF" : "FFFFFF";
    for (let c = 0; c < headers.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (!ws[cellRef]) ws[cellRef] = { v: "" };
      ws[cellRef].s = { fill: { fgColor: { rgb: color } } };
    }
  }

  const wb = XLSX.utils.book_new();
  const sheetName = moneda ? `${banco} ${moneda}` : banco;
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx", cellStyles: true });
  const filename = `${banco}${moneda ? `_${moneda}` : ""}_extracto.xlsx`;

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
