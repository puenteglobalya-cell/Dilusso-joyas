-- Run this in the Supabase SQL editor to enable classification audit log
CREATE TABLE IF NOT EXISTS clasificacion_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_statement_id uuid,
  banco text,
  fecha date,
  descripcion text,
  tipo_anterior text,
  tipo_nuevo text,
  cat_negocio_anterior text,
  cat_negocio_nueva text,
  cat_personal_anterior text,
  cat_personal_nueva text,
  usuario_email text,
  bulk_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clasificacion_log_bs_id ON clasificacion_log(bank_statement_id);
CREATE INDEX IF NOT EXISTS clasificacion_log_created_at ON clasificacion_log(created_at DESC);
