import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import type { Transaction } from "@/lib/database.types";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const sp = req.nextUrl.searchParams;
  const sb = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (sb.from("transactions") as any).select("*").order("fecha", { ascending: false });
  if (sp.get("año")) query = query.eq("año", parseInt(sp.get("año")!));
  if (sp.get("mes")) query = query.eq("mes", parseInt(sp.get("mes")!));
  if (sp.get("tipo")) query = query.eq("tipo", sp.get("tipo")!);
  if (sp.get("banco")) query = query.eq("banco", sp.get("banco")!);

  const { data } = await query;
  const rows = (data ?? []) as Transaction[];

  if (!rows.length) return new NextResponse("Sin datos", { status: 404 });

  const headers: (keyof Transaction)[] = ["fecha", "banco", "detalle", "movimiento", "tipo", "categoria", "moneda", "importe_origen", "tc", "importe_uyu", "clasificado"];
  const csvRows = rows.map((r) =>
    headers.map((h) => {
      const v = r[h];
      if (v == null) return "";
      if (typeof v === "string" && v.includes(",")) return `"${v}"`;
      return String(v);
    }).join(",")
  );

  const csv = [headers.join(","), ...csvRows].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dilusso-transacciones.csv"`,
    },
  });
}
