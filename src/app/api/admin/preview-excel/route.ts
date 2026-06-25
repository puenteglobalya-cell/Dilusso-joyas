import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const buffer = await file.arrayBuffer();
  const XLSX = require("xlsx");
  const wb = XLSX.read(Buffer.from(buffer), { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];

  // raw:false (formatted strings)
  const formatted = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
  // raw:true (actual values)
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });

  // Return first 20 rows, first 10 cols, both modes
  const slice = (arr: unknown[][]) =>
    arr.slice(0, 20).map((r: unknown[]) => (r as unknown[]).slice(0, 10));

  return NextResponse.json({ formatted: slice(formatted as unknown[][]), raw: slice(raw as unknown[][]) });
}
