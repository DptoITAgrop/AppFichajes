"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { Draggable } from "@fullcalendar/interaction";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Filter, Home, Eraser, Download,
  Wrench, ClipboardList, Clock3, Umbrella
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

/* ========= Tipos ========= */
type Operario = { id: string; nombre: string; activo: boolean; color: string };
type TipoVista = "servicio" | "parte" | "fichaje" | "vacacion";

type AppEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  color?: string;
  extendedProps: {
    operarioId?: string;
    cliente?: string;
    tipo: TipoVista;
  };
};

/* ========= Datos demo ========= */
const OPERARIOS: Operario[] = [
  { id: "op1", nombre: "Lina Mora", activo: true, color: "#EAB308" },
  { id: "op2", nombre: "Mario Romero", activo: true, color: "#22C55E" },
  { id: "op3", nombre: "Jorge Santiago", activo: true, color: "#3B82F6" },
];

const DEMO_EVENTS: AppEvent[] = [
  {
    id: "e1",
    title: "Maderas Morales · Instalación eléctrica",
    start: "2025-11-04",
    end: "2025-11-05",
    color: OPERARIOS[0].color,
    extendedProps: { operarioId: "op1", cliente: "Maderas Morales", tipo: "servicio" },
  },
  {
    id: "e2",
    title: "Instituto Cantabria · Reparación caldera",
    start: "2025-11-10",
    end: "2025-11-11",
    color: OPERARIOS[1].color,
    extendedProps: { operarioId: "op2", cliente: "Instituto Cantabria", tipo: "servicio" },
  },
  { id: "p1", title: "Parte · Rev. preventiva Zona A", start: "2025-11-05", color: "#6366F1", extendedProps: { operarioId: "op1", tipo: "parte" } },
  { id: "f1", title: "Fichaje · 08:00", start: "2025-11-06", color: "#0EA5E9", extendedProps: { operarioId: "op2", tipo: "fichaje" } },
  { id: "v1", title: "Vacaciones · Jorge", start: "2025-11-18", end: "2025-11-22", color: "#94A3B8", extendedProps: { operarioId: "op3", tipo: "vacacion" } },
];

/* ========= Paleta y helpers de UI ========= */
const TIPO_META: Record<TipoVista, { label: string; color: string; Icon: any; bg: string }> = {
  servicio: { label: "Servicios", color: "#EAB308", Icon: Wrench,        bg: "bg-yellow-100"  },
  parte:    { label: "Partes",    color: "#6366F1", Icon: ClipboardList, bg: "bg-indigo-100"  },
  fichaje:  { label: "Fichajes",  color: "#0EA5E9", Icon: Clock3,        bg: "bg-sky-100"     },
  vacacion: { label: "Ausencias", color: "#94A3B8", Icon: Umbrella,      bg: "bg-slate-200"   },
};

function initials(name: string) {
  return name.split(" ").map(s => s[0]).slice(0,2).join("").toUpperCase();
}

export default function CalendarioOperativo() {
  /* ========= Estado ========= */
  const [soloActivos, setSoloActivos] = useState(true);
  const [operarioFilter, setOperarioFilter] = useState<string | null>(null);
  const [vista, setVista] = useState<TipoVista>("servicio");
  const [events, setEvents] = useState<AppEvent[]>(DEMO_EVENTS);
  const [query, setQuery] = useState("");

  /* ========= Filtrado ========= */
  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      const byOperario = !operarioFilter || e.extendedProps.operarioId === operarioFilter;
      const byVista = e.extendedProps.tipo === vista;
      const byQuery =
        !q ||
        e.title.toLowerCase().includes(q) ||
        (e.extendedProps.cliente || "").toLowerCase().includes(q);
      return byOperario && byVista && byQuery;
    });
  }, [events, operarioFilter, vista, query]);

  /* Resumen por día: puntitos de color (sólo cuenta el día de inicio para simplificar) */
  const daySummary = useMemo(() => {
    const map: Record<string, Partial<Record<TipoVista, number>>> = {};
    for (const e of filteredEvents) {
      const d = e.start.slice(0,10);
      map[d] ||= {};
      const t = e.extendedProps.tipo;
      map[d]![t] = (map[d]![t] || 0) + 1;
    }
    return map;
  }, [filteredEvents]);

  /* ========= Draggable lateral (servicios) ========= */
  const externalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!externalRef.current) return;
    new Draggable(externalRef.current, {
      itemSelector: ".drag-chip",
      eventData: (el) => {
        const operarioId = el.getAttribute("data-id")!;
        const operario = OPERARIOS.find((o) => o.id === operarioId)!;
        return {
          title: `${operario.nombre} · Servicio`,
          extendedProps: { operarioId, tipo: "servicio" as const },
          color: operario.color,
          duration: { days: 1 },
        };
      },
    });
  }, []);

  /* ========= Callbacks de calendario ========= */
  const handleEventAdd = (addInfo: any) => {
    const ev: AppEvent = {
      id: crypto.randomUUID(),
      title: addInfo.event.title,
      start: addInfo.event.startStr,
      end: addInfo.event.endStr || undefined,
      color: addInfo.event.backgroundColor,
      extendedProps: {
        ...(addInfo.event.extendedProps || {}),
        tipo: (addInfo.event.extendedProps?.tipo ?? "servicio") as TipoVista,
      },
    };
    setEvents((prev) => [...prev, ev]);
  };

  const handleEventChange = (changeInfo: any) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === changeInfo.event.id
          ? { ...e, start: changeInfo.event.startStr, end: changeInfo.event.endStr || undefined }
          : e
      )
    );
  };

  const handleDateClick = (info: any) => {
    const op = OPERARIOS[0];
    const meta = TIPO_META[vista];
    const base: AppEvent = {
      id: crypto.randomUUID(),
      title:
        vista === "servicio" ? `${op.nombre} · Nuevo servicio`
        : vista === "parte"   ? `Parte · ${op.nombre}`
        : vista === "fichaje" ? `Fichaje · ${op.nombre}`
        : `Ausencia · ${op.nombre}`,
      start: info.dateStr,
      color: vista === "servicio" ? op.color : meta.color,
      extendedProps: { operarioId: op.id, tipo: vista },
    };
    setEvents((prev) => [...prev, base]);
  };

  /* ========= Apariencia evento ========= */
  const eventContent = (arg: any) => {
    const tipo: TipoVista = arg.event.extendedProps?.tipo;
    const { Icon } = TIPO_META[tipo];
    const opId = arg.event.extendedProps?.operarioId as string | undefined;
    const op = OPERARIOS.find((o) => o.id === opId);

    return (
      <div className="text-[11px] leading-tight flex items-start gap-1">
        <span className="mt-[2px] inline-flex items-center justify-center rounded-md bg-white/70 p-[2px]">
          <Icon className="h-3 w-3" />
        </span>
        <div className="min-w-0">
          <div className="font-medium truncate">{arg.event.title}</div>
          {op && (
            <div className="opacity-80 flex items-center gap-1">
              <span className="inline-flex items-center justify-center rounded-full bg-white/70 text-[9px] px-1.5 py-[1px] border">
                {initials(op.nombre)}
              </span>
              <span className="truncate">{op.nombre}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ========= Acciones ========= */
  const addServicioRapido = () => {
    const op =
      (operarioFilter && OPERARIOS.find((o) => o.id === operarioFilter)) || OPERARIOS[0];
    const today = new Date().toISOString().slice(0, 10);
    const ev: AppEvent = {
      id: crypto.randomUUID(),
      title: `${op.nombre} · Nuevo servicio`,
      start: today,
      color: op.color,
      extendedProps: { operarioId: op.id, tipo: "servicio" },
    };
    setEvents((prev) => [...prev, ev]);
    setVista("servicio");
    setOperarioFilter(op.id);
  };

  const limpiarCalendario = () => {
    if (!confirm("¿Deseas eliminar todos los eventos del calendario?")) return;
    setEvents([]);
  };

  const exportICS = () => {
    const toICSDate = (s: string) => s.replace(/-/g, "").replace(/:/g, "").split(".")[0] + "Z";
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Agroptimum//Calendario Operativo//ES",
    ];
    for (const e of filteredEvents) {
      lines.push(
        "BEGIN:VEVENT",
        `UID:${e.id}@agroptimum`,
        `DTSTAMP:${toICSDate(new Date().toISOString())}`,
        `DTSTART:${toICSDate(e.start + "T08:00:00")}`,
        `DTEND:${toICSDate((e.end ?? e.start) + "T18:00:00")}`,
        `SUMMARY:${e.title}`,
        "END:VEVENT"
      );
    }
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "calendario-operativo.ics"; a.click();
    URL.revokeObjectURL(url);
  };

  /* ========= UI helpers ========= */
  const vistaBtn = (value: TipoVista) => {
    const meta = TIPO_META[value];
    const active = vista === value;
    return (
      <Button
        type="button"
        variant={active ? "default" : "outline"}
        className={`w-full justify-start gap-2 ${active ? "" : ""}`}
        onClick={() => setVista(value)}
      >
        <meta.Icon className="h-4 w-4" />
        {meta.label}
      </Button>
    );
  };

  /* ========= Render ========= */
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header vistoso */}
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-500 px-6 py-5 text-white shadow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/images/AG Cuadrado Blanco.png"
              alt="Agroptimum Logo"
              width={44}
              height={44}
              className="rounded-md bg-white/10 p-1"
            />
            <div>
              <h1 className="text-2xl font-bold">Calendario Operativo</h1>
              <p className="text-emerald-50/90">Planifica servicios, partes, fichajes y ausencias.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar por título o cliente…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-56 bg-white/90 text-gray-800"
            />
            <Button type="button" variant="secondary" onClick={exportICS} className="gap-2">
              <Download className="h-4 w-4" /> Exportar
            </Button>
            <Button type="button" variant="secondary" onClick={limpiarCalendario} className="gap-2">
              <Eraser className="h-4 w-4" /> Limpiar
            </Button>
            <Link href="/admin">
              <Button variant="secondary" className="gap-2">
                <Home className="h-4 w-4" /> Volver al Panel
              </Button>
            </Link>
          </div>
        </div>

        {/* KPIs */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["servicio","parte","fichaje","vacacion"] as TipoVista[]).map((t) => {
            const meta = TIPO_META[t];
            const count = filteredEvents.filter(e => e.extendedProps.tipo === t).length;
            return (
              <div key={t} className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <meta.Icon className="h-4 w-4" />
                  <span className="text-sm">{meta.label}</span>
                </div>
                <div className="mt-1 text-2xl font-semibold">{count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Lateral */}
        <aside className="col-span-12 lg:col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vistas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {vistaBtn("servicio")}
              {vistaBtn("parte")}
              {vistaBtn("fichaje")}
              {vistaBtn("vacacion")}
              <div className="mt-3 rounded-lg border bg-white p-3">
                <div className="mb-2 text-sm font-medium">Leyenda</div>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(TIPO_META) as TipoVista[]).map((k) => {
                    const m = TIPO_META[k];
                    return (
                      <span key={k} className="inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-xs"
                        style={{ background: m.bg, borderColor: "#e5e7eb" }}>
                        <m.Icon className="h-3 w-3" /> {m.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Operarios</CardTitle>
              <div className="flex items-center gap-2 text-sm">
                <span>Solo activos</span>
                <input
                  type="checkbox"
                  checked={soloActivos}
                  onChange={(e) => setSoloActivos(e.target.checked)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div ref={externalRef} className="space-y-2">
                {OPERARIOS.filter((o) => (soloActivos ? o.activo : true)).map((o) => {
                  const active = operarioFilter === o.id;
                  return (
                    <button
                      key={o.id}
                      className={`drag-chip w-full rounded-xl border px-3 py-2 text-left flex items-center gap-2 transition hover:bg-gray-50 ${active ? "ring-2 ring-emerald-500" : ""}`}
                      style={{ borderColor: "#e5e7eb", background: "#fff" }}
                      data-id={o.id}
                      onClick={() => setOperarioFilter(active ? null : o.id)}
                      title="Arrastra para crear un servicio en el calendario"
                    >
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                        style={{ background: o.color }}>
                        {initials(o.nombre)}
                      </span>
                      <span className="truncate">{o.nombre}</span>
                      {active && <span className="ml-auto text-xs text-emerald-700">filtrando</span>}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Calendario */}
        <section className="col-span-12 lg:col-span-9">
          <Card className="shadow-md">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-xl font-semibold">Calendario</CardTitle>
              <div className="flex items-center gap-2 mt-2 sm:mt-0">
                <Button type="button" onClick={addServicioRapido} className="gap-2">
                  <Plus className="h-4 w-4" /> Añadir servicio
                </Button>
                <Button type="button" variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" /> Filtros
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{
                  left: "prev,next today",
                  center: "title",
                  right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
                }}
                locale="es"
                weekends
                editable
                droppable
                selectable
                events={filteredEvents}
                eventContent={eventContent}
                eventAdd={handleEventAdd}
                eventChange={handleEventChange}
                dateClick={handleDateClick}
                height="auto"
                dayCellDidMount={(info) => {
                  // puntitos por tipo
                  const d = info.date.toISOString().slice(0,10);
                  const summary = daySummary[d];
                  if (!summary) return;
                  const container = document.createElement("div");
                  container.className = "absolute bottom-1 left-1 right-1 flex flex-wrap gap-1 px-1";
                  (Object.keys(summary) as TipoVista[]).forEach((t) => {
                    const dot = document.createElement("span");
                    dot.className = "inline-block h-1.5 w-1.5 rounded-full";
                    dot.style.background = TIPO_META[t].color;
                    container.appendChild(dot);
                  });
                  info.el.style.position = "relative";
                  info.el.appendChild(container);
                }}
              />
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Estilos de FullCalendar (tema suave) */}
      <style jsx global>{`
        .fc .fc-toolbar-title { font-weight: 700; color: #111827; }
        .fc .fc-daygrid-day-number { font-weight: 600; color: #6b7280; }
        .fc .fc-daygrid-day.fc-day-today { background: #ecfeff; }
        .fc .fc-button { border-radius: 10px; }
        .fc .fc-event {
          border: 0 !important;
          border-radius: 10px;
          padding: 2px 6px;
          box-shadow: 0 1px 0 rgba(0,0,0,.04);
        }
        .fc .fc-col-header-cell { background: #f8fafc; }
        .fc .fc-daygrid-day:hover { background: #fbfbfb; }
      `}</style>
    </div>
  );
}
