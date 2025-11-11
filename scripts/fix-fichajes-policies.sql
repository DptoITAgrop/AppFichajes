-- Asegurando que las políticas de fichajes también funcionen correctamente
-- Eliminar políticas problemáticas de fichajes si existen
DROP POLICY IF EXISTS "Users can view own fichajes" ON fichajes;
DROP POLICY IF EXISTS "Users can insert own fichajes" ON fichajes;

-- Deshabilitar RLS temporalmente
ALTER TABLE fichajes DISABLE ROW LEVEL SECURITY;

-- Habilitar RLS con políticas simples
ALTER TABLE fichajes ENABLE ROW LEVEL SECURITY;

-- Política para que los usuarios puedan ver sus propios fichajes
CREATE POLICY "Allow users to view own fichajes" ON fichajes
    FOR SELECT USING (empleado_id IN (
        SELECT empleado_id FROM profiles WHERE id = auth.uid()
    ));

-- Política para que los usuarios puedan insertar sus propios fichajes
CREATE POLICY "Allow users to insert own fichajes" ON fichajes
    FOR INSERT WITH CHECK (empleado_id IN (
        SELECT empleado_id FROM profiles WHERE id = auth.uid()
    ));

-- Política para que los administradores puedan ver todos los fichajes
CREATE POLICY "Allow admins to view all fichajes" ON fichajes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND empleado_id LIKE 'ADMIN%'
        )
    );
