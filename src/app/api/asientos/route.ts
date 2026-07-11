import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

interface AsientoLinea {
  cuenta: string;
  tipo: "negocio" | "personal" | "ambos";
  categoria_negocio?: string;
  categoria_personal?: string;
  debe: number;
  haber: number;
  moneda?: string;
  tc?: number;
}

interface AsientoBody {
  fecha: string;
  descripcion: string;
  lineas: AsientoLinea[];
  usuario_email?: string;
}

// GET /api/asientos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const sp = req.nextUrl.searchParams;
  const desde = sp.get("desde") ?? new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10);
  const hasta = sp.get("hasta") ?? "2099-12-31";

  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from("asientos_manuales") as any)
    .select("*")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha", { ascending: false })
    .order("asiento_id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by asiento_id
  const grupos: Record<string, { fecha: string; descripcion: string; lineas: unknown[] }> = {};
  for (const row of data ?? []) {
    if (!grupos[row.asiento_id]) {
      grupos[row.asiento_id] = { fecha: row.fecha, descripcion: row.descripcion, lineas: [] };
    }
    grupos[row.asiento_id].lineas.push(row);
  }

  return NextResponse.json({ asientos: Object.entries(grupos).map(([id, g]) => ({ id, ...g })) });
}

// POST /api/asientos — crear un nuevo asiento
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json() as AsientoBody;

  if (!body.fecha) return NextResponse.json({ error: "Fecha requerida" }, { status: 400 });
  if (!body.descripcion) return NextResponse.json({ error: "Descripción requerida" }, { status: 400 });
  if (!body.lineas?.length) return NextResponse.json({ error: "Mínimo una línea" }, { status: 400 });

  // Balance check: SUM(debe) must equal SUM(haber)
  const totalDebe = body.lineas.reduce((s, l) => s + (l.debe ?? 0), 0);
  const totalHaber = body.lineas.reduce((s, l) => s + (l.haber ?? 0), 0);
  if (Math.abs(totalDebe - totalHaber) > 0.005) {
    return NextResponse.json({
      error: `Asiento desbalanceado: Debe $${totalDebe.toFixed(2)} ≠ Haber $${totalHaber.toFixed(2)}`,
      totalDebe,
      totalHaber,
    }, { status: 400 });
  }
  if (totalDebe === 0) {
    return NextResponse.json({ error: "El asiento no puede tener importe cero" }, { status: 400 });
  }

  const asiento_id = randomUUID();
  const rows = body.lineas.map(l => ({
    asiento_id,
    fecha: body.fecha,
    descripcion: body.descripcion,
    cuenta: l.cuenta,
    tipo: l.tipo ?? "personal",
    categoria_negocio: l.categoria_negocio ?? null,
    categoria_personal: l.categoria_personal ?? null,
    debe: l.debe ?? 0,
    haber: l.haber ?? 0,
    moneda: l.moneda ?? "UYU",
    tc: l.tc ?? null,
    usuario_email: body.usuario_email ?? null,
  }));

  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from("asientos_manuales") as any).insert(rows).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insertar también en bank_statements para que aparezca en Negocio/Personal/Extractos
  const BANCO_MAP: Record<string, string> = {
    "Banco BBVA":       "BBVA",
    "Banco Itaú":       "Itaú",
    "Banco Scotiabank": "Scotiabank",
    "OCA Tarjeta":      "OCA",
    "Itaú VISA":        "Itau-Card",
    "Caja / Efectivo":  "Efectivo",
  };

  const bsRows = body.lineas
    .filter(l => BANCO_MAP[l.cuenta])
    .map(l => {
      const importe = (l.debe ?? 0) - (l.haber ?? 0); // positivo = debito, negativo = credito
      return {
        banco:              BANCO_MAP[l.cuenta],
        fecha:              body.fecha,
        descripcion:        `[Asiento] ${body.descripcion}`,
        debito:             importe > 0 ? importe : 0,
        credito:            importe < 0 ? Math.abs(importe) : 0,
        moneda:             l.moneda ?? "UYU",
        tipo:               l.tipo === "ambos" ? "negocio" : (l.tipo ?? "negocio"),
        categoria_negocio:  l.categoria_negocio ?? null,
        categoria_personal: l.categoria_personal ?? null,
        clasificado:        "Si",
        asiento_id,
      };
    });

  if (bsRows.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: bsErr } = await (sb.from("bank_statements") as any).insert(bsRows);
    if (bsErr) console.error("asiento→bank_statements:", bsErr.message);
  }

  return NextResponse.json({ ok: true, asiento_id, lineas: data?.length ?? rows.length, bank_rows: bsRows.length });
}

// DELETE /api/asientos?asiento_id=UUID
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const asiento_id = req.nextUrl.searchParams.get("asiento_id");
  if (!asiento_id) return NextResponse.json({ error: "asiento_id requerido" }, { status: 400 });

  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from("asientos_manuales") as any).delete().eq("asiento_id", asiento_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
