-- ============================================================
-- Dilusso Joyas · Schema inicial
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- EXCHANGE RATES
CREATE TABLE exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  rate numeric(10, 4) NOT NULL,
  source text,
  created_at timestamptz DEFAULT now()
);

-- CATEGORIES
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('negocio', 'personal')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (name, type)
);

-- VENDOR DICTIONARY
CREATE TABLE vendor_dictionary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL UNIQUE,
  categoria text,
  tipo text CHECK (tipo IN ('negocio', 'personal')),
  banco text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- UPLOADS LOG
CREATE TABLE uploads_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  banco text NOT NULL,
  filename text NOT NULL,
  period_start date,
  period_end date,
  rows_total int,
  rows_classified int,
  rows_unclassified int,
  uploaded_at timestamptz DEFAULT now()
);

-- TRANSACTIONS (Consolidado)
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid REFERENCES uploads_log(id) ON DELETE SET NULL,
  banco text NOT NULL,
  fecha date NOT NULL,
  mes int,
  año int,
  detalle text,
  movimiento text CHECK (movimiento IN ('salida', 'ingreso')),
  clasificado boolean DEFAULT false,
  tipo text CHECK (tipo IN ('negocio', 'personal')),
  categoria text,
  moneda text DEFAULT 'UYU',
  tc numeric(10, 4),
  importe_origen numeric(15, 2),
  importe_uyu numeric(15, 2),
  comentario text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_transactions_fecha ON transactions (fecha);
CREATE INDEX idx_transactions_mes_año ON transactions (año, mes);
CREATE INDEX idx_transactions_tipo ON transactions (tipo);
CREATE INDEX idx_transactions_banco ON transactions (banco);
CREATE INDEX idx_transactions_clasificado ON transactions (clasificado);

-- SETTLEMENTS (Liquidaciones diarias)
CREATE TABLE settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  desde date NOT NULL,
  hasta date NOT NULL,
  año int,
  mes int,
  fecha_control date,
  facturado numeric(15, 2),
  retiro_reserva numeric(15, 2),
  efectivo numeric(15, 2),
  tarjeta numeric(15, 2),
  fadaval numeric(15, 2),
  gastos numeric(15, 2),
  adelanto_sueldos numeric(15, 2),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_settlements_mes_año ON settlements (año, mes);

-- TRANSACTION COMMENTS
CREATE TABLE transaction_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  author text NOT NULL CHECK (author IN ('contador', 'cliente')),
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- CATEGORÍAS BASE
-- ============================================================

INSERT INTO categories (name, type) VALUES
  -- Negocio
  ('Venta tarjeta', 'negocio'),
  ('Venta efectivo', 'negocio'),
  ('Fadaval cobranza', 'negocio'),
  ('Proveedor joyería', 'negocio'),
  ('Empleados / sueldos', 'negocio'),
  ('Alquiler local', 'negocio'),
  ('Servicios (OSE/UTE/Antel)', 'negocio'),
  ('Seguro negocio', 'negocio'),
  ('Gastos bancarios', 'negocio'),
  ('Impuestos / DGI', 'negocio'),
  ('Publicidad / marketing', 'negocio'),
  ('Gastos varios negocio', 'negocio'),
  ('Transferencia entre cuentas', 'negocio'),
  -- Personal
  ('Alquiler vivienda', 'personal'),
  ('Supermercado / provisiones', 'personal'),
  ('Restaurantes', 'personal'),
  ('Médicos / salud', 'personal'),
  ('Farmacia', 'personal'),
  ('Educación / escuela', 'personal'),
  ('Cuidado de niños', 'personal'),
  ('Psicólogo / terapia', 'personal'),
  ('Tarjeta de crédito', 'personal'),
  ('Ropa / calzado', 'personal'),
  ('Transporte', 'personal'),
  ('Entretenimiento', 'personal'),
  ('Servicios del hogar', 'personal'),
  ('Gastos varios personales', 'personal');

-- ============================================================
-- ROW LEVEL SECURITY (básico — ajustar según usuarios)
-- ============================================================

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_dictionary ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_comments ENABLE ROW LEVEL SECURITY;

-- Política permisiva temporal (cambiar por auth cuando configures usuarios)
CREATE POLICY "allow_all" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON settlements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON exchange_rates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON vendor_dictionary FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON uploads_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON transaction_comments FOR ALL USING (true) WITH CHECK (true);
