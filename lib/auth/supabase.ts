import { createBrowserClient } from "@/lib/supabase/client";

export class SupabaseAuth {
  static async login(
    email: string,
    password: string
  ): Promise<{ user: {
    id: string; email: string; name: string; role: "admin" | "empleado" | "super_admin"; employeeId: string;
  } | null; error: string | null }> {
    try {
      const supabase = createBrowserClient();

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { user: null, error: error.message || "Email o contraseña incorrectos" };
      if (!data?.user) return { user: null, error: "No se pudo iniciar sesión" };

      // lee SOLO columnas reales
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("id,email,nombre,empleado_id,rol,activo")
        .eq("id", data.user.id)
        .maybeSingle();

      // Si no existe perfil, lo creamos (por si el trigger no corrió)
      let row = profile;
      if (profileErr || !profile) {
        const { data: inserted, error: insertErr } = await supabase
          .from("profiles")
          .insert([{
            id: data.user.id,
            email: data.user.email,
            nombre: data.user.user_metadata?.name ?? "Usuario",
            empleado_id: data.user.user_metadata?.employee_id ?? null,
            rol: (data.user.user_metadata?.role ?? "empleado"),
            activo: true,
          }])
          .select("id,email,nombre,empleado_id,rol,activo")
          .maybeSingle();

        if (insertErr || !inserted) {
          console.error("[auth] profiles insert error:", insertErr);
          return { user: null, error: "No se pudo cargar el perfil del usuario" };
        }
        row = inserted;
      }

      return {
        user: {
          id: data.user.id,
          email: data.user.email!,
          name: row?.nombre ?? "",
          role: (row?.rol ?? "empleado") as any,   // acepta "super_admin"
          employeeId: row?.empleado_id ?? "",
        },
        error: null,
      };
    } catch (err: any) {
      console.error("[auth] login exception:", err);
      return { user: null, error: err?.message || "Error al iniciar sesión" };
    }
  }

  // ... el resto déjalo igual
}
