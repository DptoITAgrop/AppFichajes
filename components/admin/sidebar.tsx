"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  Clock,
  Users,
  BarChart3,
  CalendarDays,
  Settings,
  Shield,
  FileClock,
  MapPin,
  Megaphone,
  History,
  LogOut,
  ClipboardList,
} from "lucide-react";

const BRAND_GREEN = "#009640";

// ——— Supabase client (front) ———
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function NavItem({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted transition
        ${active ? "bg-muted font-medium ring-1 ring-black/5" : ""}`}
      style={active ? { borderLeft: `3px solid ${BRAND_GREEN}` } : undefined}
    >
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const router = useRouter();
  const [rol, setRol] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("usuario");
  const [loading, setLoading] = useState(true);

  // Carga rol (id -> email fallback)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        if (!user) {
          router.replace("/auth/login");
          return;
        }

        setDisplayName(user.email?.split("@")[0] || "usuario");

        let role: string | null = null;

        const { data: byId } = await supabase
          .from("profiles")
          .select("rol")
          .eq("id", user.id)
          .maybeSingle();

        role = byId?.rol ?? null;

        if (!role && user.email) {
          const { data: byEmail } = await supabase
            .from("profiles")
            .select("rol")
            .eq("email", user.email)
            .maybeSingle();
          role = byEmail?.rol ?? null;
        }

        if (mounted) setRol(role ?? "admin"); // por defecto admin si no hay valor
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  // Logout con redirección a /auth/login
  const handleLogout = async () => {
  try {
    await supabase.auth.signOut();
    await fetch("/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "SIGNED_OUT", session: null }),
    });
  } finally {
    router.replace("/auth/login");
  }
};


  const roleBadge =
    rol === "super_admin"
      ? { text: "Super Admin", style: { color: BRAND_GREEN, backgroundColor: "#E9F7EF", borderColor: "#D2F0DF" } }
      : { text: "Administrador", style: { color: BRAND_GREEN, backgroundColor: "#E9F7EF", borderColor: "#D2F0DF" } };

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-white/95 backdrop-blur border-r border-black/5 shadow-sm z-40">
      {/* Branding */}
      <div className="flex items-center gap-3 px-5 py-4">
        <Image
          src="/images/AG Cuadrado (2).png"
          alt="Agróptimum"
          width={28}
          height={28}
          className="h-7 w-7"
          priority
        />
        <div className="leading-tight">
          <p className="font-semibold">Agrocheck</p>
          <p className="text-xs text-muted-foreground">Sistema de Control Horario</p>
        </div>
      </div>

      <nav className="px-2 pt-2 space-y-1">
        {/* Gestión */}
        <p className="px-3 mt-2 mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Gestión
        </p>
        <NavItem href="/admin" icon={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" />
        <NavItem href="/fichaje" icon={<Clock className="h-4 w-4" />} label="Fichajes" />
        <NavItem href="/empleados" icon={<Users className="h-4 w-4" />} label="Empleados" />
        <NavItem href="/admin/reportes" icon={<BarChart3 className="h-4 w-4" />} label="Reportes" />
        <NavItem href="/admin/calendario" icon={<CalendarDays className="h-4 w-4" />} label="Calendario" />

        {/* Gestión de fichajes */}
        <p className="px-3 mt-4 mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Gestión de fichajes
        </p>
        <NavItem
          href="/admin/fichaje"
          icon={<ClipboardList className="h-4 w-4" />}
          label="Gestión de fichajes"
        />

        {/* Operativa */}
        <p className="px-3 mt-4 mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Operativa
        </p>

        {/* 👇 SOLO SUPER ADMIN ve “Horas extras” */}
        {!loading && rol === "super_admin" && (
          <NavItem href="/admin/horas-extras" icon={<FileClock className="h-4 w-4" />} label="Horas extras" />
        )}

        <NavItem href="/admin/mapa-fichajes" icon={<MapPin className="h-4 w-4" />} label="Mapa de fichajes" />
        <NavItem href="/admin/comunicados" icon={<Megaphone className="h-4 w-4" />} label="Comunicados" />
        <NavItem href="/admin/auditoria" icon={<History className="h-4 w-4" />} label="Auditoría" />

        {/* Configuración */}
        <p className="px-3 mt-4 mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Configuración
        </p>
        <NavItem href="/admin/usuarios" icon={<Shield className="h-4 w-4" />} label="Administradores" />
        <NavItem href="/admin/configuracion" icon={<Settings className="h-4 w-4" />} label="Configuración" />
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 inset-x-0 p-4 border-t border-black/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="size-8 rounded-full grid place-items-center text-sm text-white"
              style={{ backgroundColor: BRAND_GREEN }}
            >
              {displayName?.[0]?.toLowerCase() || "u"}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-medium">{displayName}</p>
              <span
                className="text-xs rounded-full px-2 py-0.5 border"
                style={roleBadge.style as React.CSSProperties}
              >
                {roleBadge.text}
              </span>
            </div>
          </div>
          <button
            className="text-muted-foreground hover:text-foreground"
            title="Cerrar sesión"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
