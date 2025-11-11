"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import {
  Card, CardHeader, CardTitle, CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PlusCircle, Trash, UploadCloud, Eye, EyeOff } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Comunicado = {
  id: string;
  titulo: string;
  mensaje: string;
  prioridad: "alta" | "media" | "baja";
  fecha_publicacion: string;
  creado_por: string | null;
  imagen_url: string | null;
  activo: boolean;
};

export default function ComunicadosAdmin() {
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [loading, setLoading] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Dialog crear
  const [open, setOpen] = useState(false);

  const [nuevo, setNuevo] = useState<{
    titulo: string;
    mensaje: string;
    prioridad: "alta" | "media" | "baja";
    file?: File | null;
  }>({
    titulo: "",
    mensaje: "",
    prioridad: "media",
    file: undefined,
  });

  const prioridadBadge = (p: Comunicado["prioridad"]) => {
    if (p === "alta") return <Badge className="bg-red-500">Alta</Badge>;
    if (p === "media") return <Badge className="bg-amber-500">Media</Badge>;
    return <Badge className="bg-emerald-600">Baja</Badge>;
  };

  const bordePrioridad = (p: Comunicado["prioridad"]) =>
    p === "alta" ? "#ef4444" : p === "media" ? "#f59e0b" : "#10b981";

  // --- Admin check (por id o email)
  const fetchUserAndRole = async () => {
    const { data: u } = await supabase.auth.getUser();
    const email = u.user?.email ?? null;
    const uid = u.user?.id ?? null;
    setUserEmail(email);

    if (!uid && !email) return setIsAdmin(false);

    const { data: profById } = uid
      ? await supabase.from("profiles").select("rol").eq("id", uid).maybeSingle()
      : { data: null as any };

    const { data: profByEmail } = !profById
      ? await supabase.from("profiles").select("rol").eq("email", email!).maybeSingle()
      : { data: null as any };

    const rol = (profById?.rol || profByEmail?.rol || "").toLowerCase();
    setIsAdmin(rol === "admin");
  };

  const fetchComunicados = async () => {
    const { data } = await supabase
      .from("comunicados")
      .select("*")
      .order("fecha_publicacion", { ascending: false });
    setComunicados((data || []) as Comunicado[]);
  };

  useEffect(() => {
    fetchUserAndRole();
    fetchComunicados();

    const ch = supabase
      .channel("comunicados_rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comunicados" },
        () => fetchComunicados()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // ---------- Storage helpers ----------
  const uploadImageIfAny = async (): Promise<string | null> => {
    if (!nuevo.file) return null;
    setSubiendo(true);
    try {
      const ext = nuevo.file.name.split(".").pop() || "jpg";
      const path = `comunicados/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("comunicados")
        .upload(path, nuevo.file, { upsert: false });
      if (error) throw error;

      const { data } = supabase.storage.from("comunicados").getPublicUrl(path);
      return data.publicUrl ?? null;
    } finally {
      setSubiendo(false);
    }
  };

  const getStoragePathFromPublicUrl = (url: string): string | null => {
    try {
      const u = new URL(url);
      const marker = "/object/public/comunicados/";
      const idx = u.pathname.indexOf(marker);
      if (idx === -1) return null;
      return u.pathname.slice(idx + marker.length);
    } catch {
      return null;
    }
  };

  // ---------- Crear (usa API /api/comunicados/create) ----------
  const crearComunicado = async () => {
    if (!isAdmin) return alert("Solo los administradores pueden publicar.");
    if (!nuevo.titulo.trim() || !nuevo.mensaje.trim()) {
      return alert("Completa título y mensaje");
    }
    setLoading(true);
    try {
      const imagen_url = await uploadImageIfAny();

      const res = await fetch("/api/comunicados/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: nuevo.titulo.trim(),
          mensaje: nuevo.mensaje.trim(),
          prioridad: (nuevo.prioridad || "media").toLowerCase(),
          creado_por: userEmail ?? "admin",
          imagen_url, // el API puede guardarlo también
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.ok) {
        console.error(result);
        return alert(result.error || "No se pudo publicar el comunicado");
      }

      setNuevo({ titulo: "", mensaje: "", prioridad: "media", file: undefined });
      setOpen(false);
      await fetchComunicados();
      alert("✅ Comunicado publicado y notificación enviada.");
    } catch (e) {
      console.error(e);
      alert("Error publicando el comunicado.");
    } finally {
      setLoading(false);
    }
  };

  // ---------- Eliminar ----------
  const eliminarComunicado = async (id: string, imagen_url: string | null) => {
    if (!isAdmin) return;
    if (!confirm("¿Eliminar comunicado?")) return;

    const storagePath = imagen_url ? getStoragePathFromPublicUrl(imagen_url) : null;
    if (storagePath) {
      await supabase.storage.from("comunicados").remove([storagePath]);
    }
    const { error } = await supabase.from("comunicados").delete().eq("id", id);
    if (error) {
      console.error(error);
      alert("No se pudo eliminar");
    }
  };

  // ---------- Publicar/Ocultar ----------
  const toggleActivo = async (id: string, activo: boolean) => {
    if (!isAdmin) return;
    const { error } = await supabase.from("comunicados").update({ activo: !activo }).eq("id", id);
    if (error) {
      console.error(error);
      alert("No se pudo actualizar el estado");
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-700 text-white">
        <div className="container mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/images/AG Cuadrado Blanco.png"
              alt="Agroptimum"
              width={48}
              height={48}
              className="rounded-md bg-white/10 p-1"
            />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Comunicados internos</h1>
              <p className="text-sm md:text-base text-emerald-100">
                Publica avisos, normas y actualizaciones para todo el equipo.
              </p>
            </div>
          </div>

          {isAdmin && (
            <Button onClick={() => setOpen(true)}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Nuevo comunicado
            </Button>
          )}
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Listado */}
        <div className="grid gap-5">
          {comunicados.map((c) => (
            <Card key={c.id} className="relative border-l-4 shadow-sm" style={{ borderColor: bordePrioridad(c.prioridad) }}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">{c.titulo}</CardTitle>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {prioridadBadge(c.prioridad)}
                      <Badge variant="outline" className={c.activo ? "text-emerald-700" : "text-slate-500"}>
                        {c.activo ? "Publicado" : "Oculto"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(c.fecha_publicacion).toLocaleString("es-ES")}
                        {c.creado_por ? ` · ${c.creado_por}` : ""}
                      </span>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="outline" onClick={() => toggleActivo(c.id, c.activo)}>
                        {c.activo ? (<><EyeOff className="h-4 w-4 mr-2" /> Ocultar</>) :
                                    (<><Eye className="h-4 w-4 mr-2" /> Publicar</>)}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => eliminarComunicado(c.id, c.imagen_url)}>
                        <Trash className="h-5 w-5 text-red-500" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-2">
                {c.imagen_url ? (
                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="md:col-span-1">
                      <Image
                        src={c.imagen_url}
                        alt="Imagen comunicado"
                        width={600}
                        height={400}
                        className="rounded-md border object-cover w-full h-[180px]"
                      />
                    </div>
                    <p className="md:col-span-3 text-slate-700 leading-relaxed">{c.mensaje}</p>
                  </div>
                ) : (
                  <p className="text-slate-700 leading-relaxed">{c.mensaje}</p>
                )}
              </CardContent>
            </Card>
          ))}

          {comunicados.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-muted-foreground">
                No hay comunicados todavía. Vuelve más tarde.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog crear */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo comunicado</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="Título del comunicado"
              value={nuevo.titulo}
              onChange={(e) => setNuevo((p) => ({ ...p, titulo: e.target.value }))}
            />
            <Textarea
              placeholder="Escribe el mensaje…"
              rows={5}
              value={nuevo.mensaje}
              onChange={(e) => setNuevo((p) => ({ ...p, mensaje: e.target.value }))}
            />
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
              <Select
                value={nuevo.prioridad}
                onValueChange={(v) => setNuevo((p) => ({ ...p, prioridad: v as any }))}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNuevo((p) => ({ ...p, file: e.target.files?.[0] }))}
                  className="w-[280px]"
                />
                <Button variant="outline" type="button" disabled={subiendo}>
                  <UploadCloud className="h-4 w-4 mr-2" />
                  {subiendo ? "Subiendo…" : "Añadir imagen"}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={crearComunicado} disabled={loading || subiendo}>
              <PlusCircle className="h-4 w-4 mr-2" />
              {loading ? "Publicando…" : "Publicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
