import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const buffer = await file.arrayBuffer();
  const pdf = require("pdf-parse/lib/pdf-parse");
  const data = await pdf(Buffer.from(buffer));
  return NextResponse.json({ text: data.text.substring(0, 5000) });
}
