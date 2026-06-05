-- Tabla de tipos de cambio históricos USD/UYU
CREATE TABLE IF NOT EXISTS exchange_rates (
  fecha    DATE PRIMARY KEY,
  usd_uyu  NUMERIC(8,4) NOT NULL
);

-- Función auxiliar: busca el TC más cercano a una fecha (hacia atrás hasta 7 días)
CREATE OR REPLACE FUNCTION get_tc(p_fecha DATE)
RETURNS NUMERIC AS $$
  SELECT usd_uyu FROM exchange_rates
  WHERE fecha <= p_fecha
  ORDER BY fecha DESC
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Tabla para extractos bancarios crudos (fuente: archivos del banco)
CREATE TABLE IF NOT EXISTS bank_statements (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  banco       TEXT NOT NULL,
  cuenta      TEXT,
  fecha       DATE NOT NULL,
  descripcion TEXT,
  debito      NUMERIC(14,2),
  credito     NUMERIC(14,2),
  saldo       NUMERIC(14,2),
  moneda      TEXT NOT NULL DEFAULT 'UYU',
  fuente      TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_statements_banco_fecha ON bank_statements (banco, fecha);
