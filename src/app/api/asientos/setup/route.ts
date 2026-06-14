import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MIGRATION_SQL = `
-- Asientos manuales con control de balanceo
-- Ejecutar en Supabase SQL Editor una sola vez

CREATE TABLE IF NOT EXISTS asientos_manuales (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  asiento_id uuid NOT NULL,
  fecha date NOT NULL,
  descripcion text NOT NULL,
  cuenta text NOT NULL,
  tipo text NOT NULL DEFAULT 'personal' CHECK (tipo IN ('negocio', 'personal', 'ambos')),
  categoria_negocio text,
  categoria_personal text,
  debe numeric(14,2) NOT NULL DEFAULT 0 CHECK (debe >= 0),
  haber numeric(14,2) NOT NULL DEFAULT 0 CHECK (haber >= 0),
  moneda text NOT NULL DEFAULT 'UYU' CHECK (moneda IN ('UYU', 'USD')),
  tc numeric(10,4),
  usuario_email text,
  creado_en timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS asientos_manuales_asiento_id_idx ON asientos_manuales(asiento_id);
CREATE INDEX IF NOT EXISTS asientos_manuales_fecha_idx ON asientos_manuales(fecha);

-- Opcional: habilitar RLS
ALTER TABLE asientos_manuales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON asientos_manuales FOR ALL USING (true);
`;

export async function GET() {
  return NextResponse.json({
    instrucciones: "Copiá el SQL de abajo y ejecutalo en el SQL Editor de Supabase (una sola vez)",
    sql: MIGRATION_SQL,
  });
}
