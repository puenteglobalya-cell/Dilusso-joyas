import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { parseExtracto } from "@/lib/parsers";
import { classifyTransactions } from "@/lib/classifier";
import type { VendorDictionary } from "@/lib/database.types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const banco = formData.get("banco") as string | null;

    if (!file || !banco) {
      return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const parsed = parseExtracto(buffer, banco);

    if (!parsed.length) {
      return NextResponse.json({ error: "No se encontraron transacciones en el archivo" }, { status: 422 });
    }

    const sb = createServerClient();

    const { data: dictData } = await sb.from("vendor_dictionary").select("*");
    const dictionary = (dictData ?? []) as VendorDictionary[];

    const { data: tcData } = await sb
      .from("exchange_rates")
      .select("rate")
      .order("date", { ascending: false })
      .limit(1)
      .single();
    const currentTC = (tcData as { rate: number } | null)?.rate ?? 42;

    const { classified, unclassified } = classifyTransactions(parsed, dictionary, currentTC);
    const all = [...classified, ...unclassified];

    const dates = all.map((t) => t.fecha).sort();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: uploadLog } = await (sb.from("uploads_log") as any)
      .insert({
        banco,
        filename: file.name,
        period_start: dates[0] ?? null,
        period_end: dates[dates.length - 1] ?? null,
        rows_total: all.length,
        rows_classified: classified.length,
        rows_unclassified: unclassified.length,
      })
      .select()
      .single();

    const uploadId = (uploadLog as { id: string } | null)?.id ?? null;

    const batch = all.map((t) => ({
      upload_id: uploadId,
      banco: t.banco,
      fecha: t.fecha,
      mes: t.mes,
      año: t.año,
      detalle: t.detalle,
      movimiento: t.movimiento,
      clasificado: t.clasificado,
      tipo: t.tipo,
      categoria: t.categoria,
      moneda: t.moneda,
      tc: t.tc,
      importe_origen: t.importe_origen,
      importe_uyu: t.importe_uyu,
    }));

    for (let i = 0; i < batch.length; i += 500) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb.from("transactions") as any).insert(batch.slice(i, i + 500));
    }

    return NextResponse.json({
      banco,
      total: all.length,
      classified: classified.length,
      unclassified: unclassified.length,
    });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  }
}
