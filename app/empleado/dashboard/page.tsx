"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";
import { Calendar, Clock, Megaphone } from "lucide-react";

export default function EmpleadoDashboard() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Bienvenido 👋</h1>
            <p className="text-slate-500">Panel del empleado de Agrocheck</p>
          </div>
          <Image
            src="/images/AG Cuadrado (2).png"
            alt="Agróptimum"
            width={120}
            height={40}
            className="h-10 w-auto"
            priority
          />
        </div>

        {/* Secciones principales */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card
            className="cursor-pointer hover:shadow-lg transition"
            onClick={() => router.push("/empleado/fichajes")}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">Fichajes</CardTitle>
              <Clock className="h-6 w-6 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-sm">
                Consulta tus horas trabajadas, tus pausas y registra tu jornada diaria.
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition"
            onClick={() => router.push("/empleado/comunicados")}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">Comunicados</CardTitle>
              <Megaphone className="h-6 w-6 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-sm">
                Accede a los comunicados internos, avisos y novedades de la empresa.
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition"
            onClick={() => router.push("/empleado/calendario")}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">Calendario</CardTitle>
              <Calendar className="h-6 w-6 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-sm">
                Consulta tus turnos, festivos y planificación de trabajo.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-slate-500 mt-10">
          © {new Date().getFullYear()} Agrocheck · Sistema de Control Horario
        </div>
      </div>
    </div>
  );
}
