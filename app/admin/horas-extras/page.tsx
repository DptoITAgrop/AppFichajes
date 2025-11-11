"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import {
  addMonths, endOfMonth, format, isMatch, parse, startOfMonth,
} from "date-fns";

// UI
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, Calendar, Users, BarChart2, Award } from "lucide-react";

// Charts
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

// Excel
import { ExcelExporter } from "@/lib/excel-export";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Fichaje = {
  id: string;
  empleado_id: string;
  empleado_nombre: string;
  tipo: "entrada" | "salida";
  ts: string; // ISO
};

type DiaEmpleado = {
  fecha: string;              // yyyy-MM-dd
  empleadoId: string;
  empleadoNombre: string;
  totalHoras: number;
  horasRegulares: number;
  horasExtras: number;
};

const HORAS_JORNADA = 8;

export default function HorasExtrasPage() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [canView, setCanView] = useState(false);

  // filtros
  const [mesBase, setMesBase] = useState<Date>(startOfMonth(new Date()));
  const [empleadoSel, setEmpleadoSel] = useState<string>("all");
  const [query, setQuery] = useState("");

  // data
  const [empleados, setEmpleados] = useState<{ id: string; nombre: string }[]>([]);
  const [fichajes, setFichajes] = useState<Fichaje[]>([]);

  // ---------- Auth ----------
 // ...
useEffect(() => {
  (async () => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) { router.push("/auth/login"); return; }

    let rol: string | null = null;
    const { data: byId } = await supabase.from("profiles").select("rol").eq("id", user.id).maybeSingle();
    if (byId?.rol) rol = byId.rol;
    if (!rol && user.email) {
      const { data: byEmail } = await supabase.from("profiles").select("rol").eq("email", user.email).maybeSingle();
      if (byEmail?.rol) rol = byEmail.rol;
    }

    // 🔒 aquí endurecemos: sólo SUPER ADMIN
    if (rol !== "super_admin") {
      router.push("/admin"); // o "/"
      return;
    }
    setCanView(true);
    setIsLoading(false);
  })();
}, [router]);
// ...


  // ---------- Empleados ----------
  useEffect(() => {
    if (!canView) return;
    (async () => {
      const { data } = await supabase.from("empleados").select("id, nombre").order("nombre", { ascending: true });
      setEmpleados((data || []).map((e: any) => ({ id: e.id, nombre: e.nombre || "Empleado" })));
    })();
  }, [canView]);

  // ---------- Fichajes del mes ----------
  const loadFichajes = async () => {
    const from = startOfMonth(mesBase).toISOString();
    const to   = endOfMonth(mesBase).toISOString();

    const { data } = await supabase
      .from("fichajes")
      .select("id, empleado_id, empleado_nombre, tipo, ts")
      .gte("ts", from)
      .lte("ts", to)
      .order("ts", { ascending: true });

    setFichajes((data || []) as Fichaje[]);
  };

  useEffect(() => {
    if (!canView) return;
    loadFichajes();
  }, [canView, mesBase]);

  useEffect(() => {
    if (!canView) return;
    const ch = supabase
      .channel("rt-fichajes")
      .on("postgres_changes", { event: "*", schema: "public", table: "fichajes" }, () => {
        loadFichajes();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [canView, mesBase]);

  // ---------- Cálculo ----------
  const resumen: DiaEmpleado[] = useMemo(() => {
    if (!fichajes.length) return [];

    const porEmpleado = new Map<string, Fichaje[]>();
    for (const f of fichajes) {
      if (empleadoSel !== "all" && f.empleado_id !== empleadoSel) continue;
      porEmpleado.set(f.empleado_id, [...(porEmpleado.get(f.empleado_id) || []), f]);
    }

    const out: DiaEmpleado[] = [];
    porEmpleado.forEach((arr, empId) => {
      const porDia = new Map<string, Fichaje[]>();
      for (const f of arr) {
        const key = format(new Date(f.ts), "yyyy-MM-dd");
        porDia.set(key, [...(porDia.get(key) || []), f]);
      }

      porDia.forEach((lista, dia) => {
        let horas = 0;
        let entrada: Date | null = null;

        for (const f of lista) {
          if (f.tipo === "entrada") entrada = new Date(f.ts);
          else if (f.tipo === "salida" && entrada) {
            const h = (new Date(f.ts).getTime() - entrada.getTime()) / 36e5;
            if (h > 0) horas += h;
            entrada = null;
          }
        }

        const reg = Math.min(horas, HORAS_JORNADA);
        const ext = Math.max(horas - HORAS_JORNADA, 0);

        out.push({
          fecha: dia,
          empleadoId: empId,
          empleadoNombre: lista[0]?.empleado_nombre || "Empleado",
          totalHoras: Number(horas.toFixed(2)),
          horasRegulares: Number(reg.toFixed(2)),
          horasExtras: Number(ext.toFixed(2)),
        });
      });
    });

    // filtro por búsqueda (nombre o fecha dd/MM/yyyy)
    const q = query.trim().toLowerCase();
    if (!q) return out.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    return out
      .filter(r => {
        const byName = r.empleadoNombre.toLowerCase().includes(q);
        const byDate =
          isMatch(q, "dd/MM/yyyy") &&
          format(parse(q, "dd/MM/yyyy", new Date()), "yyyy-MM-dd") === r.fecha;
        return byName || byDate;
      })
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }, [fichajes, empleadoSel, query]);

  // KPI
  const totalExtrasMes = useMemo(() => resumen.reduce((s, d) => s + d.horasExtras, 0), [resumen]);
  const empleadosConExtra = useMemo(() => new Set(resumen.filter(r => r.horasExtras > 0).map(r => r.empleadoId)).size, [resumen]);
  const ranking = useMemo(() => {
    const map = new Map<string, { empleadoId: string; empleadoNombre: string; extras: number }>();
    for (const r of resumen) {
      const k = r.empleadoId;
      const prev = map.get(k) || { empleadoId: k, empleadoNombre: r.empleadoNombre, extras: 0 };
      prev.extras += r.horasExtras;
      map.set(k, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.extras - a.extras);
  }, [resumen]);
  const top = ranking[0];

  // Chart: extras por día
  const chartData = useMemo(() => {
    const d = new Map<string, number>();
    for (const r of resumen) d.set(r.fecha, (d.get(r.fecha) || 0) + r.horasExtras);
    return Array.from(d.entries())
      .map(([fecha, horas]) => ({ fecha: format(new Date(fecha), "dd/MM"), horas: Number(horas.toFixed(2)) }))
      .sort((a, b) => parse(a.fecha, "dd/MM", new Date()).getTime() - parse(b.fecha, "dd/MM", new Date()).getTime());
  }, [resumen]);

  // -------- Export --------
  const exportarExcel = () => {
    const employeeReports = Object.values(
      resumen.reduce((acc: any, r) => {
        if (!acc[r.empleadoId]) acc[r.empleadoId] = { employeeId: r.empleadoId, employeeName: r.empleadoNombre, sessions: [] };
        const [y, m, d] = r.fecha.split("-");
        const entrada = new Date(Number(y), Number(m) - 1, Number(d), 8, 0, 0);
        const salida  = new Date(entrada.getTime() + r.totalHoras * 3600 * 1000);
        acc[r.empleadoId].sessions.push({
          entrada: entrada.toISOString(),
          salida:  salida.toISOString(),
          totalHours: r.totalHoras,
          regularHours: r.horasRegulares,
          extraHours: r.horasExtras,
          weekendHours: 0,
          nightHours: 0,
        });
        return acc;
      }, {} as Record<string, any>)
    );

    const payrollSettings = {
      regularHourRate: 1,
      extraHourMultiplier: 1.25,
      weekendMultiplier: 1.5,
      nightMultiplier: 1.2,
    };

    ExcelExporter.exportOvertimeReport(
      employeeReports,
      mesBase,
      empleadoSel,
      payrollSettings
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cargando…</p>
      </div>
    );
  }
  if (!canView) return null;

  return (
    <div className="min-h-screen bg-[#f7f9f7]">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Image src="/images/AG Cuadrado (2).png" alt="Agroptimum" width={36} height={36} className="rounded" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Horas Extras</h1>
              <p className="text-sm text-gray-500">Cálculo por día y empleado. Las horas extras se generan cuando el total diario supera 8h.</p>
            </div>
          </div>
          <Button onClick={exportarExcel} className="bg-emerald-600 hover:bg-emerald-700">
            <Download className="h-4 w-4 mr-2" /> Exportar Excel
          </Button>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Mes</Label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setMesBase(addMonths(mesBase, -1))}>◀</Button>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-white">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{format(mesBase, "MMMM 'de' yyyy")}</span>
                  </div>
                  <Button variant="outline" onClick={() => setMesBase(addMonths(mesBase, 1))}>▶</Button>
                </div>
              </div>

              <div>
                <Label>Empleado</Label>
                <Select value={empleadoSel} onValueChange={setEmpleadoSel}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Empleado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {empleados.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Buscar</Label>
                <Input
                  className="bg-white"
                  placeholder="Nombre o fecha (dd/mm/aaaa)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-full bg-emerald-50 text-emerald-700"><BarChart2 /></div>
              <div>
                <p className="text-sm text-gray-500">Horas extras en {format(mesBase, "MMMM yyyy")}</p>
                <p className="text-2xl font-semibold">{totalExtrasMes.toFixed(2)} h</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-full bg-emerald-50 text-emerald-700"><Users /></div>
              <div>
                <p className="text-sm text-gray-500">Empleados con extra</p>
                <p className="text-2xl font-semibold">{empleadosConExtra}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-full bg-emerald-50 text-emerald-700"><Award /></div>
              <div>
                <p className="text-sm text-gray-500">Top empleado (mes)</p>
                <p className="text-2xl font-semibold">
                  {top ? `${top.empleadoNombre} · ${top.extras.toFixed(2)} h` : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart + ranking */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="lg:col-span-2">
            <CardContent className="p-5">
              <p className="text-sm text-gray-500 mb-3">Extras por día</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="horas" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500 mb-3">Ranking por empleado</p>
              <div className="space-y-2 max-h-64 overflow-auto">
                {ranking.length === 0 ? (
                  <p className="text-gray-400 text-sm">Sin datos</p>
                ) : ranking.map((r, i) => (
                  <div key={r.empleadoId} className="flex items-center justify-between">
                    <span className="text-sm">{i + 1}. {r.empleadoNombre}</span>
                    <Badge className="bg-emerald-600">{r.extras.toFixed(2)} h</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detalle diario */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-emerald-700">
                  <tr>
                    <th className="text-left text-white font-medium px-4 py-3">Fecha</th>
                    <th className="text-left text-white font-medium px-4 py-3">Empleado</th>
                    <th className="text-center text-white font-medium px-4 py-3">Horas totales</th>
                    <th className="text-center text-white font-medium px-4 py-3">Regulares</th>
                    <th className="text-center text-white font-medium px-4 py-3">Extras</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.length === 0 ? (
                    <tr><td colSpan={5} className="text-center text-gray-500 py-10">Sin datos para los filtros seleccionados</td></tr>
                  ) : resumen.map((r) => (
                    <tr key={`${r.empleadoId}-${r.fecha}`} className="border-b">
                      <td className="px-4 py-2">{format(new Date(r.fecha), "dd/MM/yyyy")}</td>
                      <td className="px-4 py-2">{r.empleadoNombre}</td>
                      <td className="text-center px-4 py-2">{r.totalHoras.toFixed(2)} h</td>
                      <td className="text-center px-4 py-2">{r.horasRegulares.toFixed(2)} h</td>
                      <td className="text-center px-4 py-2">
                        <span className={r.horasExtras > 0 ? "text-emerald-700 font-medium" : ""}>
                          {r.horasExtras.toFixed(2)} h
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
