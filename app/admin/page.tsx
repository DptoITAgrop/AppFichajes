"use client";

import { useMemo } from "react";
import Sidebar from "@/components/admin/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock4, Activity, CalendarDays } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

// ====== Colores marca
const BRAND = {
  green: "#009640",        // verde Agróptimum
  greenDark: "#006b40",
  purple: "#7C3AED",
};

// ====== Datos DEMO (cámbialos por tus consultas)
const semanaDemo = [
  { d: "lun", h: 0 },
  { d: "mar", h: 0 },
  { d: "mié", h: 0 },
  { d: "jue", h: 0 },
  { d: "vie", h: 0 },
  { d: "sáb", h: 0 },
  { d: "dom", h: 0 },
];

export default function AdminDashboard() {
  // TODO: trae datos reales (empleados activos, trabajando ahora, horas hoy, semana actual, etc.)
  const empleadosActivos = 5;
  const trabajandoAhora = 0;
  const horasHoy = 0;
  const semanaStr = useMemo(() => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
    return new Intl.DateTimeFormat("es-ES", options).format(now);
  }, []);

  const donutData = [{ name: "Activo", value: 100 }];

  return (
    <div className="min-h-screen bg-muted/30">
      <Sidebar current="dashboard" />

      <main className="ml-64 px-6 md:px-10 py-6">
        {/* Encabezado */}
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Panel de Control</h1>
          <p className="text-sm text-muted-foreground">{semanaStr}</p>
        </div>

     

        {/* KPIs */}
        <section className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Empleados Activos"
            value={empleadosActivos}
            subtitle="En plantilla"
            icon={<Users className="h-5 w-5" />}
          />
          <StatCard
            title="Trabajando Ahora"
            value={trabajandoAhora}
            subtitle="En sus puestos"
            icon={<Clock4 className="h-5 w-5" />}
            accent="green"
          />
          <StatCard
            title="Horas Hoy"
            value={`${horasHoy}h`}
            subtitle="Registradas (cap. 8h)"
            icon={<Activity className="h-5 w-5" />}
            accent="purple"
          />
          <StatCard
            title="Semana"
            value={rangoSemanaLabel()}
            subtitle=""
            icon={<CalendarDays className="h-5 w-5" />}
          />
        </section>

        {/* Gráficas */}
        <section className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Horas Trabajadas · Esta Semana</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={semanaDemo} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="d" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="h" stroke={BRAND.green} strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estado de Empleados</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] grid place-items-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={60}
                  >
                    <Cell fill={BRAND.green} />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="text-sm text-emerald-700 font-medium bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1">
                Activo 100%
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Fichajes recientes */}
        <section className="mt-5">
          <Card>
            <CardHeader>
              <CardTitle>Fichajes Recientes</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              No hay fichajes hoy
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

// ----- Componentes auxiliares -----

function StatCard({
  title,
  value,
  subtitle,
  icon,
  accent,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  accent?: "green" | "purple";
}) {
  const accentStyles =
    accent === "green"
      ? "bg-emerald-50 text-emerald-700"
      : accent === "purple"
      ? "bg-purple-50 text-purple-700"
      : "bg-blue-50 text-blue-700";

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-1 text-3xl font-semibold">{value}</p>
            {subtitle ? (
              <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          <div className={`size-10 rounded-xl grid place-items-center ${accentStyles}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function rangoSemanaLabel() {
  const d = new Date();
  const day = d.getDay(); // 0 dom .. 6 sab
  const diffToMon = (day + 6) % 7; // días hasta lunes
  const monday = new Date(d);
  monday.setDate(d.getDate() - diffToMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (x: Date) =>
    x.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
  return `${fmt(monday)} - ${fmt(sunday)}`;
}
