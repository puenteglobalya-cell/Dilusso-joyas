-- Registro de cheques emitidos
-- Ejecutar en: https://supabase.com/dashboard/project/acruykhrkugckpjcqwmb/sql/new
CREATE TABLE IF NOT EXISTS cheques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  fecha_cobro date,
  proveedor text,
  tipo_mercaderia text,
  monto_uyu numeric,
  monto_usd numeric,
  banco text,
  nota text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (numero, fecha_cobro, monto_uyu, monto_usd)
);
