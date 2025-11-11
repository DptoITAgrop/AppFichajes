-- Eliminando políticas RLS problemáticas y creando nuevas que funcionen
-- Eliminar todas las políticas existentes que causan recursión
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on email" ON profiles;

-- Deshabilitar RLS temporalmente para limpiar
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Crear políticas simples sin recursión
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Política para que los usuarios puedan ver todos los perfiles (necesario para el sistema de fichajes)
CREATE POLICY "Allow read access to all profiles" ON profiles
    FOR SELECT USING (true);

-- Política para que los usuarios puedan actualizar su propio perfil
CREATE POLICY "Allow users to update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Política para insertar nuevos perfiles
CREATE POLICY "Allow insert for authenticated users" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);
