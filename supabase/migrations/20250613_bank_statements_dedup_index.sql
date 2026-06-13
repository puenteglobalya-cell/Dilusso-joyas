-- Elimina duplicados existentes conservando el registro más antiguo de cada grupo.
-- La clave de dedup: banco + cuenta + fecha + moneda + descripcion (normalizada) + debito + credito
DELETE FROM bank_statements
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY
               banco,
               coalesce(cuenta, ''),
               fecha,
               moneda,
               regexp_replace(trim(coalesce(descripcion, '')), '[^\x00-\x7f]', '', 'g'),
               coalesce(debito::text,  ''),
               coalesce(credito::text, '')
             ORDER BY created_at, id
           ) AS rn
    FROM bank_statements
  ) sub
  WHERE rn > 1
);

-- Índice único que previene futuros duplicados en la importación.
CREATE UNIQUE INDEX IF NOT EXISTS bank_statements_dedup_key
ON bank_statements (
  banco,
  coalesce(cuenta, ''),
  fecha,
  moneda,
  regexp_replace(trim(coalesce(descripcion, '')), '[^\x00-\x7f]', '', 'g'),
  coalesce(debito::numeric,  -999999),
  coalesce(credito::numeric, -999999)
);
