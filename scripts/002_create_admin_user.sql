-- Función para crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    employee_id, 
    nombre, 
    apellidos, 
    role,
    departamento,
    puesto
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'employee_id', 'EMP' || EXTRACT(EPOCH FROM NOW())::TEXT),
    COALESCE(NEW.raw_user_meta_data ->> 'nombre', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data ->> 'apellidos', 'Nuevo'),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'empleado'),
    COALESCE(NEW.raw_user_meta_data ->> 'departamento', 'General'),
    COALESCE(NEW.raw_user_meta_data ->> 'puesto', 'Empleado')
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Crear trigger para nuevos usuarios
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
