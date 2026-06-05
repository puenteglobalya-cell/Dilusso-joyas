-- Ejecutar en Supabase SQL Editor DESPUÉS del schema inicial

-- Tabla de perfiles con roles
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'cliente' CHECK (role IN ('contador', 'cliente')),
  nombre text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_see_own_profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "contador_see_all" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'contador')
);

-- Trigger: crear perfil automáticamente al registrar usuario
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, role)
  VALUES (new.id, new.email, 'cliente');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Actualizar RLS de todas las tablas para requerir autenticación
DROP POLICY IF EXISTS "allow_all" ON transactions;
DROP POLICY IF EXISTS "allow_all" ON settlements;
DROP POLICY IF EXISTS "allow_all" ON exchange_rates;
DROP POLICY IF EXISTS "allow_all" ON categories;
DROP POLICY IF EXISTS "allow_all" ON vendor_dictionary;
DROP POLICY IF EXISTS "allow_all" ON uploads_log;
DROP POLICY IF EXISTS "allow_all" ON transaction_comments;

-- Solo usuarios autenticados pueden leer
CREATE POLICY "auth_read" ON transactions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_read" ON settlements FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_read" ON exchange_rates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_read" ON categories FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_read" ON vendor_dictionary FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_read" ON uploads_log FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_read" ON transaction_comments FOR SELECT USING (auth.uid() IS NOT NULL);

-- Solo contador puede escribir
CREATE POLICY "contador_write" ON transactions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'contador')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'contador')
);
CREATE POLICY "contador_write" ON settlements FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'contador')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'contador')
);
CREATE POLICY "contador_write" ON exchange_rates FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'contador')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'contador')
);
CREATE POLICY "contador_write" ON categories FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'contador')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'contador')
);
CREATE POLICY "contador_write" ON vendor_dictionary FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'contador')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'contador')
);
CREATE POLICY "contador_write" ON uploads_log FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'contador')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'contador')
);
CREATE POLICY "contador_write" ON transaction_comments FOR ALL USING (
  auth.uid() IS NOT NULL
) WITH CHECK (auth.uid() IS NOT NULL);
