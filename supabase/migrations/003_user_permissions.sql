-- Ejecutar DESPUÉS del 002_auth.sql

-- Permisos por sección por usuario
-- El contador puede habilitar/deshabilitar secciones para cada cliente
CREATE TABLE user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seccion text NOT NULL,  -- 'dashboard', 'negocio', 'personal', 'liquidaciones', 'consolidado', 'tc'
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, seccion)
);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- El usuario ve sus propios permisos
CREATE POLICY "see_own" ON user_permissions FOR SELECT USING (auth.uid() = user_id);

-- El contador ve y gestiona todos
CREATE POLICY "contador_all" ON user_permissions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'contador')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'contador')
);

-- Función helper para verificar permiso de sección
CREATE OR REPLACE FUNCTION has_section_access(p_user_id uuid, p_seccion text)
RETURNS boolean AS $$
  SELECT COALESCE(
    (SELECT enabled FROM user_permissions WHERE user_id = p_user_id AND seccion = p_seccion),
    true  -- si no hay registro, por defecto permitido
  );
$$ LANGUAGE sql SECURITY DEFINER;
