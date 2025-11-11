"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck, FileWarning, FileText, Search } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Input } from "@/components/ui/input";
import { createClient } from "@supabase/supabase-js";

const COLORS = ["#009640", "#3B82F6", "#FACC15", "#EF4444"];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AuditoriaPanel() {
  const [auditorias, setAuditorias] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase.from("auditoria").select("*");
      setAuditorias(data || []);
    };
    fetchData();
  }, []);

  const estados = [
    { titulo: "Activas", color: "bg-blue-100", valor: auditorias.filter((a) => a.estado === "Activa").length, icon: <Search className="text-blue-600" /> },
    { titulo: "Completadas", color: "bg-green-100", valor: auditorias.filter((a) => a.estado === "Completada").length, icon: <ClipboardCheck className="text-green-600" /> },
    { titulo: "Borrador", color: "bg-yellow-100", valor: auditorias.filter((a) => a.estado === "Borrador").length, icon: <FileText className="text-yellow-600" /> },
    { titulo: "Incompletas", color: "bg-red-100", valor: auditorias.filter((a) => a.estado === "Incompleta").length, icon: <FileWarning className="text-red-600" /> },
  ];

  const datosGrafico = estados.map((e, i) => ({
    name: e.titulo,
    value: e.valor,
    fill: COLORS[i],
  }));

  const filtradas = auditorias.filter((a) =>
    a.titulo?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-muted/30 p-8 ml-64">
      <h1 className="text-3xl font-bold mb-2">Panel de Auditoría</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Seguimiento de auditorías internas y estados de avance
      </p>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {estados.map((e, i) => (
          <Card key={i} className={`${e.color} border-0 shadow-md`}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-gray-500">{e.titulo}</p>
                <p className="text-3xl font-bold">{e.valor}</p>
              </div>
              <div className="p-3 rounded-full bg-white shadow-inner">{e.icon}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráfico circular */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Lista de Auditorías</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative mb-3">
              <Search className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar auditoría..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="text-left p-2">Título</th>
                    <th className="text-left p-2">Inicio</th>
                    <th className="text-left p-2">Fin</th>
                    <th className="text-left p-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((a, i) => (
                    <tr
                      key={i}
                      className="border-b hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-2">{a.titulo}</td>
                      <td className="p-2">{a.inicio ? new Date(a.inicio).toLocaleDateString() : "-"}</td>
                      <td className="p-2">{a.fin ? new Date(a.fin).toLocaleDateString() : "-"}</td>
                      <td className="p-2 font-medium">{a.estado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtradas.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No hay auditorías registradas
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumen Gráfico</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={datosGrafico}
                  dataKey="value"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  label
                >
                  {datosGrafico.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
