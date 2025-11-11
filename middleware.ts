import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function createSupabase(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: any) =>
          res.cookies.set({ name, value, ...options }),
        remove: (name: string, options: any) =>
          res.cookies.set({ name, value: "", ...options }),
      },
    }
  );
  return { supabase, res };
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Deja pasar estáticos
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/favicon") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const { supabase, res } = createSupabase(req);
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user ?? null;

  // Rutas ADMIN
  if (pathname.startsWith("/admin")) {
    if (!user) {
      const url = req.nextUrl.clone();
      url.pathname = "/auth/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    // Leer rol
    let rol: string | null = null;
    const { data: byId } = await supabase.from("profiles").select("rol").eq("id", user.id).maybeSingle();
    if (byId?.rol) rol = byId.rol;
    if (!rol && user.email) {
      const { data: byEmail } = await supabase.from("profiles").select("rol").eq("email", user.email).maybeSingle();
      if (byEmail?.rol) rol = byEmail.rol;
    }

    // horas-extras: solo super_admin
    if (pathname.startsWith("/admin/horas-extras")) {
      if (rol !== "super_admin") {
        const url = req.nextUrl.clone();
        url.pathname = "/admin";
        return NextResponse.redirect(url);
      }
      return res; // OK super_admin
    }

    // resto admin: admin o super_admin
    if (rol !== "admin" && rol !== "super_admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/fichaje";
      return NextResponse.redirect(url);
    }

    return res;
  }

  // Rutas de empleado (públicas autenticadas): refrescamos sesión igualmente
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/).*)"],
};
