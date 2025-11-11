"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { format } from "date-fns";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Search,
  Mail,
  Phone,
  Calendar,
  UserCheck,
  AlertCircle,
  CreditCard,
  Scan,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { ExcelExporter } from "@/lib/excel-export";

/* ========= Supabase ========= */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/* ========= Tipos ========= */
type Empleado = {
  id: string;
  empleadoId: string;
  nombre: string;
  email: string;
  telefono: string;
  departamento: string;
  puesto: string;
  fechaAlta: Date | null;
  salario: number;
  estado: "activo" | "inactivo";
  direccion: string;
  tarjetaId?: string;
  rol: "empleado";
};

type Marcaje = {
  id: string;
  empleadoId: string;
  empleadoNombre: string;
  tipo: "entrada" | "salida";
  ts: Date;
};

/* ========= Página ========= */
export default function EmpleadosPage() {
  const router = useRouter();

  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [marcajes, setMarcajes] = useState<Marcaje[]>([]);

  const [search, setSearch] = useState("");
  const [filtroDept, setFiltroDept] = useState<string>("all");
  const [filtroEstado, setFiltroEstado] = useState<string>("all");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Empleado | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ¿Es admin?
  const [isAdmin, setIsAdmin] = useState(false);

  // Escáner
  const scanRef = useRef<HTMLInputElement>(null);
  const [scanValue, setScanValue] = useState("");
  const [scanStatus, setScanStatus] = useState<"idle" | "ok" | "error" | "loading">("idle");
  const [scanMsg, setScanMsg] = useState("");

  // Formulario
  const [form, setForm] = useState<Partial<Empleado>>({
    empleadoId: "",
    nombre: "",
    email: "",
    telefono: "",
    departamento: "",
    puesto: "",
    fechaAlta: new Date(),
    salario: 0,
    estado: "activo",
    direccion: "",
    tarjetaId: "",
    rol: "empleado",
  });

  /* ========= Auth mínima: solo admins =========
     (Si tienes middleware ya protege; esto es defensa extra en el cliente)
  */
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;

      if (!user) {
        router.push("/auth/login");
        return;
      }

      // Intenta por id
      let rol: string | null = null;

      const { data: byId } = await supabase
        .from("profiles")
        .select("rol")
        .eq("id", user.id)
        .maybeSingle();

      if (byId?.rol) rol = byId.rol;

      // Fallback por email si no hay fila por id
      if (!rol && user.email) {
        const { data: byEmail } = await supabase
          .from("profiles")
          .select("rol")
          .eq("email", user.email)
          .maybeSingle();
        if (byEmail?.rol) rol = byEmail.rol;
      }

      const admin = rol === "admin" || rol === "super_admin";
      setIsAdmin(!!admin);

      if (!admin) {
        alert("Acceso denegado. Solo administradores.");
        router.push("/");
        return;
      }

      setIsLoading(false);
    })();
  }, [router]);

  /* ========= Carga ========= */
  const loadEmpleados = async () => {
    const { data, error } = await supabase
      .from("empleados")
      .select(
        "id, empleado_id, nombre, email, telefono, departamento, puesto, fecha_alta, salario, estado, direccion, tarjeta_id, rol"
      )
      .order("nombre", { ascending: true });

    if (!error) {
      const list: Empleado[] = (data || []).map((e: any) => ({
        id: e.id,
        empleadoId: e.empleado_id || "",
        nombre: e.nombre || "",
        email: e.email || "",
        telefono: e.telefono || "",
        departamento: e.departamento || "Sin asignar",
        puesto: e.puesto || "Sin asignar",
        fechaAlta: e.fecha_alta ? new Date(e.fecha_alta) : null,
        salario: Number(e.salario || 0),
        estado: (e.estado as "activo" | "inactivo") || "activo",
        direccion: e.direccion || "",
        tarjetaId: e.tarjeta_id || "",
        rol: "empleado",
      }));
      setEmpleados(list);
    }
  };

  const loadMarcajes = async () => {
    const { data, error } = await supabase
      .from("marcajes")
      .select("id, empleado_id, empleado_nombre, tipo, ts")
      .order("ts", { ascending: false });

    if (!error) {
      setMarcajes(
        (data || []).map((m: any) => ({
          id: m.id,
          empleadoId: m.empleado_id,
          empleadoNombre: m.empleado_nombre,
          tipo: m.tipo,
          ts: new Date(m.ts),
        }))
      );
    }
  };

  useEffect(() => {
    if (!isLoading) {
      loadEmpleados();
      loadMarcajes();
      setTimeout(() => scanRef.current?.focus(), 200);
    }
  }, [isLoading]);

  /* ========= Realtime ========= */
  useEffect(() => {
    if (isLoading) return;

    const chEmp = supabase
      .channel("rt-empleados")
      .on("postgres_changes", { event: "*", schema: "public", table: "empleados" }, () => {
        loadEmpleados();
      })
      .subscribe();

    const chMar = supabase
      .channel("rt-marcajes")
      .on("postgres_changes", { event: "*", schema: "public", table: "marcajes" }, () => {
        loadMarcajes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chEmp);
      supabase.removeChannel(chMar);
    };
  }, [isLoading]);

  /* ========= Filtros ========= */
  const departamentos = useMemo(
    () => [...new Set(empleados.map((e) => e.departamento).filter(Boolean))],
    [empleados]
  );

  const filtrados = empleados.filter((e) => {
    const q = search.toLowerCase().trim();
    const matches =
      e.nombre.toLowerCase().includes(q) ||
      e.empleadoId.toLowerCase().includes(q) ||
      (e.email || "").toLowerCase().includes(q) ||
      (e.tarjetaId || "").toLowerCase().includes(q);
    const md = filtroDept === "all" || e.departamento === filtroDept;
    const me = filtroEstado === "all" || e.estado === filtroEstado;
    return matches && md && me;
  });

  /* ========= Acciones CRUD (solo admins) ========= */

  const requireAdmin = () => {
    if (!isAdmin) {
      alert("Solo los administradores pueden realizar esta acción.");
      return false;
    }
    return true;
  };

  const abrirNuevo = () => {
    if (!requireAdmin()) return;
    setEditando(null);
    setForm({
      empleadoId: `EMP${String(empleados.length + 1).padStart(3, "0")}`,
      nombre: "",
      email: "",
      telefono: "",
      departamento: "",
      puesto: "",
      fechaAlta: new Date(),
      salario: 0,
      estado: "activo",
      direccion: "",
      tarjetaId: "",
      rol: "empleado",
    });
    setIsDialogOpen(true);
  };

  const abrirEditar = (e: Empleado) => {
    if (!requireAdmin()) return;
    setEditando(e);
    setForm(e);
    setIsDialogOpen(true);
  };

  const guardar = async () => {
    if (!requireAdmin()) return;

    if (!form.nombre || !form.empleadoId) {
      alert("Completa ID Empleado y Nombre.");
      return;
    }

    const payload = {
      empleado_id: form.empleadoId.trim(),
      nombre: (form.nombre || "").trim(),
      email: (form.email || "").trim(),
      telefono: (form.telefono || "").trim(),
      departamento: (form.departamento || "").trim(),
      puesto: (form.puesto || "").trim(),
      fecha_alta: form.fechaAlta ? new Date(form.fechaAlta).toISOString() : null,
      salario: form.salario ?? 0,
      estado: form.estado,
      direccion: (form.direccion || "").trim(),
      tarjeta_id: (form.tarjetaId || "").trim() || null,
      rol: "empleado" as const,
    };

    try {
      if (editando) {
        const { error } = await supabase.from("empleados").update(payload).eq("id", editando.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("empleados").insert(payload).select().single();
        if (error) throw error;
      }

      setIsDialogOpen(false);
      await loadEmpleados();
    } catch (err: any) {
      alert(`Error al ${editando ? "guardar" : "crear"}: ${err?.message || err}`);
    }
  };

  const eliminar = async (id: string) => {
    if (!requireAdmin()) return;
    if (!confirm("¿Eliminar empleado definitivamente?")) return;
    try {
      const { error } = await supabase.from("empleados").delete().eq("id", id);
      if (error) throw error;
      await loadEmpleados();
    } catch (err: any) {
      alert(`Error al eliminar: ${err?.message || err}`);
    }
  };

  const toggleEstado = async (id: string) => {
    if (!requireAdmin()) return;
    const e = empleados.find((x) => x.id === id);
    if (!e) return;
    const nuevo = e.estado === "activo" ? "inactivo" : "activo";
    try {
      const { error } = await supabase.from("empleados").update({ estado: nuevo }).eq("id", id);
      if (error) throw error;
      await loadEmpleados();
    } catch (err: any) {
      alert(`No se pudo actualizar el estado: ${err?.message || err}`);
    }
  };

  /* ========= KPIs ========= */
  const activos = empleados.filter((e) => e.estado === "activo").length;
  const nominaTotal = empleados
    .filter((e) => e.estado === "activo")
    .reduce((s, e) => s + (e.salario || 0), 0);
  const conTarjeta = empleados.filter((e) => !!e.tarjetaId).length;

  /* ========= Escáner ========= */

  const tipoSiguiente = async (empleadoId: string): Promise<"entrada" | "salida"> => {
    const { data } = await supabase
      .from("marcajes")
      .select("tipo")
      .eq("empleado_id", empleadoId)
      .order("ts", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.tipo === "entrada" ? "salida" : "entrada";
  };

  const handleScan = async (code: string) => {
    if (!code) return;
    setScanStatus("loading");
    setScanMsg("Buscando empleado…");

    const { data: emp } = await supabase
      .from("empleados")
      .select("id, nombre, estado")
      .eq("tarjeta_id", code.trim())
      .maybeSingle();

    if (!emp) {
      setScanStatus("error");
      setScanMsg("Código no reconocido");
      setScanValue("");
      scanRef.current?.focus();
      return;
    }
    if (emp.estado !== "activo") {
      setScanStatus("error");
      setScanMsg("Empleado inactivo");
      setScanValue("");
      scanRef.current?.focus();
      return;
    }

    const tipo = await tipoSiguiente(emp.id);

    const { error } = await supabase.from("marcajes").insert({
      empleado_id: emp.id,
      empleado_nombre: emp.nombre,
      tipo,
      ts: new Date().toISOString(),
      origen: "web-scanner",
    });

    if (error) {
      setScanStatus("error");
      setScanMsg("Error al registrar fichaje");
      setScanValue("");
      scanRef.current?.focus();
      return;
    }

    setScanStatus("ok");
    setScanMsg(`Fichaje de ${emp.nombre}: ${tipo.toUpperCase()} registrado`);
    setScanValue("");
    scanRef.current?.focus();
    loadMarcajes();
  };

  const onScanKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleScan(scanValue);
    }
  };

  /* ========= Exportar ========= */
  const exportar = () => {
    ExcelExporter.exportEmployeesReport(
      empleados.map((e) => ({
        empleadoId: e.empleadoId,
        nombre: e.nombre,
        email: e.email,
        telefono: e.telefono,
        departamento: e.departamento,
        puesto: e.puesto,
        fechaAlta: e.fechaAlta,
        salario: e.salario,
        estado: e.estado,
        direccion: e.direccion,
        tarjetaId: e.tarjetaId,
      }))
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header con logo */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div className="flex items-center gap-4">
            <Image
              src="/images/AG Cuadrado (2).png"
              alt="Agróptimum"
              width={140}
              height={40}
              className="h-8 w-auto"
              priority
            />
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Gestión de Empleados</h1>
              <p className="text-lg text-gray-600">Administra la información de tu equipo</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={exportar} variant="outline">
              <Users className="h-4 w-4 mr-2" />
              Exportar XLSX
            </Button>

            {/* Crear sólo si admin */}
            {isAdmin && (
              <Button onClick={abrirNuevo}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Empleado
              </Button>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/80 border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-purple-600 mr-3" />
                <div>
                  <p className="text-sm text-gray-600">Total Empleados</p>
                  <p className="text-2xl font-bold">{empleados.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/80 border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center">
                <UserCheck className="h-8 w-8 text-green-600 mr-3" />
                <div>
                  <p className="text-sm text-gray-600">Empleados Activos</p>
                  <p className="text-2xl font-bold">{activos}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/80 border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center">
                <CreditCard className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <p className="text-sm text-gray-600">Con Tarjeta</p>
                  <p className="text-2xl font-bold">{conTarjeta}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/80 border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-orange-600 mr-3" />
                <div>
                  <p className="text-sm text-gray-600">Nómina Total</p>
                  <p className="text-2xl font-bold">€{nominaTotal.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lector */}
        <Card className="mb-8 bg-white/90 border-0 shadow-xl">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-end gap-4">
              <div className="flex-1">
                <Label>Lector de tarjeta / código</Label>
                <div className="flex gap-2">
                  <Input
                    ref={scanRef}
                    value={scanValue}
                    onChange={(e) => setScanValue(e.target.value)}
                    onKeyDown={onScanKeyDown}
                    placeholder="Enfoque aquí y escanee la tarjeta (o escriba el código y pulse Enter)"
                    className="text-lg"
                  />
                  <Button type="button" onClick={() => handleScan(scanValue)}>
                    <Scan className="h-4 w-4 mr-2" />
                    Registrar
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  El lector USB actúa como teclado y envía el código seguido de Enter. Mantén este campo con foco.
                </p>
              </div>

              <div className="min-w-[240px]">
                <Label>Estado</Label>
                <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-gray-50">
                  {scanStatus === "loading" && (
                    <div className="animate-spin h-4 w-4 border-b-2 border-purple-600 rounded-full" />
                  )}
                  {scanStatus === "ok" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                  {scanStatus === "error" && <XCircle className="h-5 w-5 text-red-600" />}
                  <span className="text-sm text-gray-700">
                    {scanStatus === "idle" ? "Esperando lectura..." : scanMsg}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filtros */}
        <Card className="mb-8 bg-white/80 border-0 shadow-xl">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <Label>Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Nombre, ID, email o tarjeta…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label>Departamento</Label>
                <Select value={filtroDept} onValueChange={setFiltroDept}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los departamentos</SelectItem>
                    {departamentos.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="activo">Activos</SelectItem>
                    <SelectItem value="inactivo">Inactivos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-gray-600">
                {filtrados.length} empleado(s) encontrado(s)
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Listado */}
        <div className="grid gap-6">
          {filtrados.length === 0 ? (
            <Card className="bg-white/80 border-0 shadow-xl">
              <CardContent className="p-12 text-center">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron empleados</h3>
                <p className="text-gray-500 mb-4">
                  {empleados.length === 0
                    ? "Comienza agregando tu primer empleado"
                    : "Prueba a ajustar los filtros de búsqueda"}
                </p>
                {isAdmin && empleados.length === 0 && (
                  <Button onClick={abrirNuevo}>
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Primer Empleado
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filtrados.map((e) => {
              const entradasEmpleado = marcajes.filter((m) => m.empleadoId === e.id);
              const esteMes = entradasEmpleado.filter(
                (m) => format(m.ts, "yyyy-MM") === format(new Date(), "yyyy-MM")
              );
              const ultimo = entradasEmpleado.sort(
                (a, b) => b.ts.getTime() - a.ts.getTime()
              )[0];
              return (
                <Card key={e.id} className="bg-white/80 border-0 shadow-xl">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          <h3 className="text-xl font-semibold">{e.nombre}</h3>
                          <Badge variant="outline">ID: {e.empleadoId}</Badge>
                          {e.tarjetaId && (
                            <Badge variant="outline" className="bg-blue-50">
                              <CreditCard className="h-3 w-3 mr-1" />
                              {e.tarjetaId}
                            </Badge>
                          )}
                          <Badge className={e.estado === "activo" ? "bg-green-500" : "bg-gray-500"}>
                            {e.estado === "activo" ? "Activo" : "Inactivo"}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div className="space-y-2">
                            <div className="flex items-center text-gray-600">
                              <Mail className="h-4 w-4 mr-2" />
                              {e.email || "No especificado"}
                            </div>
                            <div className="flex items-center text-gray-600">
                              <Phone className="h-4 w-4 mr-2" />
                              {e.telefono || "No especificado"}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <span className="text-gray-500">Departamento:</span>{" "}
                              <span className="ml-1 font-medium">
                                {e.departamento || "No asignado"}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Puesto:</span>{" "}
                              <span className="ml-1 font-medium">{e.puesto || "No especificado"}</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <span className="text-gray-500">Fecha alta:</span>{" "}
                              <span className="ml-1 font-medium">
                                {e.fechaAlta ? format(e.fechaAlta, "dd/MM/yyyy") : "—"}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Salario:</span>{" "}
                              <span className="ml-1 font-medium">
                                €{(e.salario || 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Total fichajes:</span>{" "}
                              <span className="ml-1 font-medium">{entradasEmpleado.length}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Este mes:</span>{" "}
                              <span className="ml-1 font-medium">{esteMes.length}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Último fichaje:</span>{" "}
                              <span className="ml-1 font-medium">
                                {ultimo ? format(ultimo.ts, "dd/MM HH:mm") : "Nunca"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Acciones sólo si admin */}
                      {isAdmin && (
                        <div className="flex flex-col gap-2">
                          <Button variant="outline" size="sm" onClick={() => abrirEditar(e)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleEstado(e.id)}
                            className={e.estado === "activo" ? "text-orange-600" : "text-green-600"}
                          >
                            {e.estado === "activo" ? "Desactivar" : "Activar"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => eliminar(e.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Modal crear/editar (sólo visible si admin está abriéndolo) */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editando ? "Editar Empleado" : "Nuevo Empleado"}</DialogTitle>
              <DialogDescription>
                {editando
                  ? "Modifica la información del empleado"
                  : "Completa la información del nuevo empleado"}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>ID Empleado *</Label>
                <Input
                  value={form.empleadoId || ""}
                  onChange={(e) => setForm((p) => ({ ...p, empleadoId: e.target.value }))}
                  placeholder="EMP001"
                />
              </div>
              <div>
                <Label>Nombre Completo *</Label>
                <Input
                  value={form.nombre || ""}
                  onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                  placeholder="Juan Pérez"
                />
              </div>
              <div className="md:col-span-2">
                <Label>ID de Tarjeta (para lector)</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.tarjetaId || ""}
                    onChange={(e) => setForm((p) => ({ ...p, tarjetaId: e.target.value }))}
                    placeholder="Escanee la tarjeta o ingrese el ID"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        tarjetaId: `CARD${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
                      }))
                    }
                  >
                    Generar
                  </Button>
                </div>
              </div>

              <div>
                <Label>Email</Label>
                <Input
                  value={form.email || ""}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input
                  value={form.telefono || ""}
                  onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
                />
              </div>
              <div>
                <Label>Departamento</Label>
                <Input
                  value={form.departamento || ""}
                  onChange={(e) => setForm((p) => ({ ...p, departamento: e.target.value }))}
                />
              </div>
              <div>
                <Label>Puesto</Label>
                <Input
                  value={form.puesto || ""}
                  onChange={(e) => setForm((p) => ({ ...p, puesto: e.target.value }))}
                />
              </div>
              <div>
                <Label>Fecha de Contratación</Label>
                <Input
                  type="date"
                  value={form.fechaAlta ? format(form.fechaAlta, "yyyy-MM-dd") : ""}
                  onChange={(e) => setForm((p) => ({ ...p, fechaAlta: new Date(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Salario Anual (€)</Label>
                <Input
                  type="number"
                  value={form.salario ?? 0}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, salario: Number(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="md:col-span-2">
                <Label>Dirección</Label>
                <Input
                  value={form.direccion || ""}
                  onChange={(e) => setForm((p) => ({ ...p, direccion: e.target.value }))}
                />
              </div>
              <div>
                <Label>Estado</Label>
                <Select
                  value={form.estado}
                  onValueChange={(v: "activo" | "inactivo") => setForm((p) => ({ ...p, estado: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="inactivo">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={guardar}>{editando ? "Guardar Cambios" : "Crear Empleado"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
