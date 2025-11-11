"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { addDays, format } from "date-fns";
import es from "date-fns/locale/es";
import Image from "next/image";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  FileSpreadsheet,
  Clock,
} from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Empleado = {
  id: string;
  nombre: string | null;
  email: string | null;
  estado: string | null;
};
type Fichaje = {
  id: string;
  empleado_id: string;
  fecha: string; // yyyy-mm-dd
  check_in: string | null;
  check_out: string | null;
  minutos_pausa: number;
  horas_trabajadas_min: number;
  estado: string; // pendiente | aprobado | ausente | festivo | en_curso | finalizada...
  notas: string | null;
  empleado?: Empleado;
};

// Sentinel para Select (evitamos el error por value vacío)
const ALL = "__ALL__";

const ESTADOS = [
  { v: ALL, t: "Todos" },
  { v: "pendiente", t: "Pendiente" },
  { v: "aprobado", t: "Aprobado" },
  { v: "en_curso", t: "En curso" },
  { v: "finalizada", t: "Finalizada" },
  { v: "ausente", t: "Ausente" },
  { v: "festivo", t: "Festivo" },
];

function fmtDate(d: string) {
  try {
    return format(new Date(d), "dd/MM/yyyy", { locale: es });
  } catch {
    return d;
  }
}
function fmtTime(ts: string | null) {
  if (!ts) return "—";
  try {
    return format(new Date(ts), "HH:mm", { locale: es });
  } catch {
    return "—";
  }
}
function fmtMin(m: number) {
  const h = Math.floor((m || 0) / 60);
  const min = Math.round((m || 0) % 60);
  return `${h}h ${min}m`;
}

export default function HistorialFichajesAdmin() {
  const [cargando, setCargando] = useState(true);
  const [fichajes, setFichajes] = useState<Fichaje[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [empleadoId, setEmpleadoId] = useState<string>(ALL);
  const [estado, setEstado] = useState<string>(ALL);
  const [desde, setDesde] = useState<string>(
    format(addDays(new Date(), -14), "yyyy-MM-dd")
  );
  const [hasta, setHasta] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Ausentes hoy
  const [ausentesHoy, setAusentesHoy] = useState<Empleado[]>([]);
  const hoy = format(new Date(), "yyyy-MM-dd");

  const dicebear = (name?: string | null, email?: string | null) =>
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
      name || email || "User"
    )}&backgroundType=gradientLinear&fontSize=36`;

  // cargar empleados
  const loadEmpleados = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id,nombre,email,estado")
      .order("nombre", { ascending: true });
    setEmpleados((data || []) as Empleado[]);
  };

  const loadFichajes = async () => {
    setCargando(true);
    let q = supabase
      .from("fichajes")
      .select("*, empleado:profiles(id,nombre,email,estado)", {
        count: "exact",
      })
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: false })
      .order("check_in", { ascending: false });

    if (empleadoId !== ALL) q = q.eq("empleado_id", empleadoId);
    if (estado !== ALL) q = q.eq("estado", estado);

    const { data, error } = await q;
    if (!error) setFichajes((data || []) as Fichaje[]);
    setCargando(false);
  };

  // ausentes hoy (empleados activos sin fichaje hoy)
  const loadAusentesHoy = async () => {
    const { data: emps } = await supabase
      .from("profiles")
      .select("id,nombre,email,estado");
    const activos = (emps || []).filter(
      (e) => (e.estado || "activo") === "activo"
    );

    const { data: fHoy } = await supabase
      .from("fichajes")
      .select("empleado_id")
      .eq("fecha", hoy);

    const conFichaje = new Set((fHoy || []).map((f: any) => f.empleado_id));
    setAusentesHoy(activos.filter((e) => !conFichaje.has(e.id)));
  };

  useEffect(() => {
    loadEmpleados();
    loadFichajes();
    loadAusentesHoy();

    const ch = supabase
      .channel("rt_fichajes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fichajes" },
        () => {
          loadFichajes();
          loadAusentesHoy();
        }
      )
      .subscribe();

    return () => supabase.removeChannel(ch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadFichajes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empleadoId, estado, desde, hasta]);

  const rows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return fichajes.slice(start, start + pageSize);
  }, [fichajes, page]);

  const totalPages = Math.max(1, Math.ceil(fichajes.length / pageSize));

  // Exportar Excel
  const exportXLSX = async () => {
    const XLSX = await import("xlsx");
    const data = fichajes.map((f) => ({
      Empleado: f.empleado?.nombre || f.empleado?.email,
      Fecha: fmtDate(f.fecha),
      Inicio: fmtTime(f.check_in),
      Fin: fmtTime(f.check_out),
      "Pausas (min)": f.minutos_pausa || 0,
      "Horas trabajadas": fmtMin(f.horas_trabajadas_min || 0),
      Total: fmtMin(
        (f.horas_trabajadas_min || 0) + (f.minutos_pausa || 0)
      ),
      Estado: f.estado,
      Notas: f.notas || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fichajes");
    XLSX.writeFile(wb, `fichajes_${desde}_a_${hasta}.xlsx`);
  };

  const EstadoBadge = ({ v }: { v: string }) => {
    switch ((v || "").toLowerCase()) {
      case "aprobado":
        return <Badge className="bg-emerald-600 text-white">Aprobado</Badge>;
      case "finalizada":
        return <Badge className="bg-sky-600 text-white">Finalizada</Badge>;
      case "en_curso":
        return <Badge className="bg-amber-500 text-white">En curso</Badge>;
      case "ausente":
        return <Badge className="bg-rose-600 text-white">Ausente</Badge>;
      case "festivo":
        return <Badge className="bg-slate-500 text-white">Festivo</Badge>;
      default:
        return <Badge variant="secondary">Pendiente</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      {/* Hero */}
      <div className="border-b bg-white/60 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 p-[2px]">
              <div className="size-full rounded-[10px] bg-white/90 grid place-items-center">
                <Image
                  src="/images/AG Cuadrado Blanco.png"
                  alt="Agroptimum"
                  width={28}
                  height={28}
                />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Historial de fichajes
              </h1>
              <p className="text-gray-500 text-sm">
                Consulta, filtra y exporta los fichajes del equipo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={exportXLSX} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Exportar Excel
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {/* Ausentes hoy */}
        {ausentesHoy.length > 0 && (
          <Card className="border-rose-200 bg-rose-50/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-rose-700">
                Ausentes hoy
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-rose-700">
              {ausentesHoy.map((e) => e.nombre || e.email).join(" · ")}
            </CardContent>
          </Card>
        )}

        {/* Filtros */}
        <Card className="border-emerald-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4 text-emerald-600" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="col-span-1 md:col-span-2 flex items-center gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500">Desde</label>
                <Input
                  type="date"
                  value={desde}
                  onChange={(e) => {
                    setDesde(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500">Hasta</label>
                <Input
                  type="date"
                  value={hasta}
                  onChange={(e) => {
                    setHasta(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500">Empleado</label>
              <Select
                value={empleadoId}
                onValueChange={(v) => {
                  setEmpleadoId(v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {empleados.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nombre || e.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-gray-500">Estado</label>
              <Select
                value={estado}
                onValueChange={(v) => {
                  setEstado(v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((s) => (
                    <SelectItem key={s.v} value={s.v}>
                      {s.t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setEmpleadoId(ALL);
                  setEstado(ALL);
                  setDesde(format(addDays(new Date(), -14), "yyyy-MM-dd"));
                  setHasta(format(new Date(), "yyyy-MM-dd"));
                  setPage(1);
                }}
              >
                Limpiar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabla */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Resultados ({fichajes.length})
            </CardTitle>
          </CardHeader>

          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader className="sticky top-0 bg-emerald-50/70 backdrop-blur z-10">
                <TableRow className="[&_th]:text-gray-700">
                  <TableHead className="w-[240px]">Usuario</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead>Pausas</TableHead>
                  <TableHead>Horas trabajadas</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="w-[280px]">Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cargando && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10">
                      <span className="inline-flex items-center gap-2 text-gray-500">
                        <Clock className="h-4 w-4 animate-spin" />
                        Cargando…
                      </span>
                    </TableCell>
                  </TableRow>
                )}

                {!cargando && rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center py-10 text-gray-500"
                    >
                      No hay fichajes para los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                )}

                {rows.map((f, i) => (
                  <TableRow
                    key={f.id}
                    className={i % 2 ? "bg-emerald-50/40" : "bg-white"}
                  >
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <img
                          src={dicebear(f.empleado?.nombre, f.empleado?.email)}
                          alt=""
                          className="size-8 rounded-full ring-1 ring-emerald-100"
                        />
                        <div>
                          <div className="font-medium">
                            {f.empleado?.nombre || f.empleado?.email}
                          </div>
                          <div className="text-xs text-gray-500">
                            {f.empleado?.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <EstadoBadge v={f.estado} />
                    </TableCell>

                    <TableCell>{fmtDate(f.fecha)}</TableCell>
                    <TableCell>{fmtTime(f.check_in)}</TableCell>
                    <TableCell>{fmtTime(f.check_out)}</TableCell>

                    <TableCell>
                      <Badge variant="outline" className="bg-white">
                        {fmtMin(f.minutos_pausa || 0)}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="bg-white">
                        {fmtMin(f.horas_trabajadas_min || 0)}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <Badge className="bg-emerald-600 text-white">
                        {fmtMin(
                          (f.horas_trabajadas_min || 0) +
                            (f.minutos_pausa || 0)
                        )}
                      </Badge>
                    </TableCell>

                    <TableCell className="max-w-[280px] truncate">
                      {f.notas || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Paginación */}
            {fichajes.length > pageSize && (
              <div className="border-t bg-white px-4 py-3 flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-600">
                  Página {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
