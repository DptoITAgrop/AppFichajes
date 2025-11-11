-- Crear tabla de empleados (profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  departamento TEXT,
  puesto TEXT,
  salario_base DECIMAL(10,2) DEFAULT 0,
  tarifa_hora_extra DECIMAL(10,2) DEFAULT 0,
  tarifa_fin_semana DECIMAL(10,2) DEFAULT 0,
  tarifa_nocturna DECIMAL(10,2) DEFAULT 0,
  role TEXT DEFAULT 'empleado' CHECK (role IN ('empleado', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de fichajes
CREATE TABLE IF NOT EXISTS public.fichajes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida')),
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  timestamp_completo TIMESTAMP WITH TIME ZONE NOT NULL,
  latitud DECIMAL(10, 8),
  longitud DECIMAL(11, 8),
  precision_gps INTEGER,
  direccion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de configuraciones del sistema
CREATE TABLE IF NOT EXISTS public.configuraciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave TEXT UNIQUE NOT NULL,
  valor JSONB NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fichajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuraciones ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
CREATE POLICY "profiles_select_own" ON public.profiles 
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles 
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles 
  FOR UPDATE USING (auth.uid() = id);

-- Políticas para admins en profiles
CREATE POLICY "profiles_admin_all" ON public.profiles 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Políticas para fichajes
CREATE POLICY "fichajes_select_own" ON public.fichajes 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "fichajes_insert_own" ON public.fichajes 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Políticas para admins en fichajes
CREATE POLICY "fichajes_admin_all" ON public.fichajes 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Políticas para configuraciones (solo admins)
CREATE POLICY "configuraciones_admin_all" ON public.configuraciones 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insertar configuraciones por defecto
INSERT INTO public.configuraciones (clave, valor, descripcion) VALUES
('horas_jornada_normal', '8', 'Horas de jornada normal antes de considerar horas extras'),
('multiplicador_hora_extra', '1.5', 'Multiplicador para horas extras diarias'),
('multiplicador_fin_semana', '2.0', 'Multiplicador para trabajo en fin de semana'),
('multiplicador_nocturno', '1.25', 'Multiplicador para trabajo nocturno (22:00-06:00)'),
('hora_inicio_nocturno', '22:00', 'Hora de inicio del turno nocturno'),
('hora_fin_nocturno', '06:00', 'Hora de fin del turno nocturno')
ON CONFLICT (clave) DO NOTHING;
