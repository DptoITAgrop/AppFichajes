"use client";

import type React from "react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import { SupabaseAuth } from "@/lib/auth/supabase";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const resolveRole = async (): Promise<"admin" | "empleado" | "unknown"> => {
    const { data: session } = await supabase.auth.getUser();
    const user = session?.user;
    if (!user) return "unknown";

    // 1) intenta por id
    const { data: byId } = await supabase
      .from("profiles")
      .select("rol")
      .eq("id", user.id)
      .maybeSingle();

    let rol = byId?.rol as string | undefined;

    // 2) fallback por email
    if (!rol && user.email) {
      const { data: byEmail } = await supabase
        .from("profiles")
        .select("rol")
        .eq("email", user.email)
        .maybeSingle();
      rol = byEmail?.rol;
    }

    if (rol === "admin" || rol === "super_admin") return "admin";
    if (rol === "empleado") return "empleado";
    return "unknown";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!email || !password) {
      setError("Por favor, completa todos los campos");
      setLoading(false);
      return;
    }

    try {
      const { user, error: authError } = await SupabaseAuth.login(email, password);
      if (authError || !user) {
        setError(authError || "Error de autenticación");
        setLoading(false);
        return;
      }

      // Determina destino
      const next = searchParams.get("next");
      if (next) {
        window.location.href = next; // respeta NEXT param del middleware
        return;
      }

      const rol = await resolveRole();
      if (rol === "admin") {
        window.location.href = "/admin";
      } else {
        window.location.href = "/"; // o tu dashboard de empleado
      }
    } catch (err) {
      console.error("Error en login:", err);
      setError("Error al iniciar sesión");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* Fondo */}
      <Image
        src="/images/agroptimum.jpg"
        alt="Fondo Agróptimum"
        fill
        priority
        className="absolute inset-0 object-cover"
      />
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />

      {/* Card */}
      <Card className="relative w-full max-w-md bg-white/55 backdrop-blur-2xl border border-white/40 shadow-2xl rounded-3xl">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <Image
              src="/images/AG Cuadrado (2).png"
              alt="Logo Agróptimum"
              width={150}
              height={80}
              className="h-16 w-auto"
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">Iniciar Sesión</CardTitle>
          <CardDescription className="text-gray-700">
            Accede a tu cuenta de fichajes
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu.email@agroptimum.com"
                className="mt-1"
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa tu contraseña"
                className="mt-1"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50/80 border border-red-200">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 bg-[#006b40] hover:bg-[#005733] shadow-lg"
              disabled={loading}
            >
              <Lock className="h-4 w-4 mr-2" />
              {loading ? "Iniciando..." : "Iniciar Sesión"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Button
              variant="ghost"
              onClick={() => router.push("/auth/sign-up")}
              className="text-sm text-[#006b40] hover:text-[#004d2a]"
              disabled={loading}
            >
              ¿No tienes cuenta? Regístrate aquí
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
