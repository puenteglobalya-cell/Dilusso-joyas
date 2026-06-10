-- Agregar columna nota a bank_statements
-- Ejecutar en: https://supabase.com/dashboard/project/acruykhrkugckpjcqwmb/sql/new
ALTER TABLE bank_statements ADD COLUMN IF NOT EXISTS nota text;
