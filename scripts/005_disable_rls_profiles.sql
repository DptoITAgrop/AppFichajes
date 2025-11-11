-- Deshabilitar RLS temporalmente para la tabla profiles
-- y crear políticas más simples que no causen recursión

-- Eliminar todas las políticas existentes
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Deshabilitar RLS temporalmente
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Crear una política muy simple que no cause recursión
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Política simple: los usuarios pueden ver y editar solo su propio perfil
CREATE POLICY "Simple profile access" ON profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = id);
