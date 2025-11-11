"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import es from "date-fns/locale/es";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Fichaje = {
  id: string;
  empleado_id: string;
  fecha: string;               // 'yyyy-MM-dd'
  inicio: string | null;       // ISO
  fin: string | null;          // ISO
  minutos_pausa: number | null;
  horas_trabajadas_min: number | null;
  estado: string | null;       // 'en_curso' | 'finalizada' | 'ausente'...
  notas: string | null;
};

const WORK_TARGET_MIN = 8 * 60; // 8h

const fmtHM = (minutes: number) => {
  const h = Math.floor(Math.max(0, minutes) / 60);
  const m = Math.max(0, minutes) % 60;
  return `${h}:${String(m).padStart(2, "0")}h`;
};

const fmtTime = (ts?: string | null) =>
  ts ? new Date(ts).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "—";

const todayStr = () =>
  format(new Date(), "yyyy-MM-dd", { locale: es });

export default function FichajeEmpleadoBonito() {
  const [uid, setUid] = useState<string | null>(null);
  const [nombre, setNombre] = useState<string>("Mi jornada");
  const [hoy, setHoy] = useState<Fichaje | null>(null);
  const [historial, setHistorial] = useState<Fichaje[]>([]);
  const [loading, setLoading] = useState(true);

  // Estado de pausa local (para sumar a minutos_pausa al reanudar)
  const pausaDesdeRef = useRef<number | null>(null);

  // ===== Helpers de cálculo =====
  const minutosHoy = useMemo(() => {
    if (!hoy?.inicio) return 0;
    const start = new Date(hoy.inicio).getTime();
    const end = hoy.fin ? new Date(hoy.fin).getTime() : Date.now();
    const pausas = (hoy.minutos_pausa || 0) + (pausaDesdeRef.current ? Math.floor((Date.now() - pausaDesdeRef.current) / 60000) : 0);
    const total = Math.floor((end - start) / 60000) - pausas;
    return Math.max(0, total);
  }, [hoy, hoy?.inicio, hoy?.fin]);

  const progreso = Math.min(100, Math.round((minutosHoy / WORK_TARGET_MIN) * 100));

  // ===== Carga inicial =====
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: ses } = await supabase.auth.getSession();
      const userId = ses.session?.user.id || null;
      setUid(userId);

      if (!userId) {
        setLoading(false);
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("nombre, apellidos, email")
        .eq("id", userId)
        .maybeSingle();

      const etiqueta =
        [prof?.nombre, prof?.apellidos].filter(Boolean).join(" ") ||
        prof?.email ||
        "Mi jornada";
      setNombre(etiqueta);

      await reload(userId);

      // Realtime
      const ch = supabase
        .channel("rt_fichajes_empleado")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "fichajes", filter: `empleado_id=eq.${userId}` },
          () => reload(userId)
        )
        .subscribe();

      setLoading(false);
      return () => supabase.removeChannel(ch);
    })();
  }, []);

  const reload = async (userId: string) => {
    const hoyIso = todayStr();

    // Fichaje de hoy (si existe)
    const { data: actual } = await supabase
      .from("fichajes")
      .select("*")
      .eq("empleado_id", userId)
      .eq("fecha", hoyIso)
      .order("inicio", { ascending: false })
      .limit(1)
      .maybeSingle();

    setHoy((actual || null) as Fichaje | null);

    // Últimos 10 días (excluyendo hoy)
    const { data: ult } = await supabase
      .from("fichajes")
      .select("*")
      .eq("empleado_id", userId)
      .neq("fecha", hoyIso)
      .order("fecha", { ascending: false })
      .limit(10);

    setHistorial((ult || []) as Fichaje[]);
  };

  // ===== Acciones =====
  const startShift = async () => {
    if (!uid) return;
    const hoyIso = todayStr();

    const { error } = await supabase.from("fichajes").insert({
      empleado_id: uid,
      fecha: hoyIso,
      inicio: new Date().toISOString(),
      fin: null,
      minutos_pausa: 0,
      horas_trabajadas_min: 0,
      estado: "en_curso",
      notas: null,
    });
    if (!error) {
      pausaDesdeRef.current = null;
      reload(uid);
    }
  };

  const pauseShift = async () => {
    // No tocamos BD aún; solo arrancamos cronómetro de pausa.
    if (!hoy || hoy.fin || pausaDesdeRef.current) return;
    pausaDesdeRef.current = Date.now();
    // El estado visual "En pausa":
    setHoy({ ...hoy, estado: "en_pausa" as any });
  };

  const resumeShift = async () => {
    if (!uid || !hoy) return;
    const startedAt = pausaDesdeRef.current;
    pausaDesdeRef.current = null;
    const extra = startedAt ? Math.floor((Date.now() - startedAt) / 60000) : 0;

    const nuevosMin = (hoy.minutos_pausa || 0) + extra;

    const { error } = await supabase
      .from("fichajes")
      .update({ minutos_pausa: nuevosMin, estado: "en_curso" })
      .eq("id", hoy.id);
    if (!error) reload(uid);
  };

  const endShift = async () => {
    if (!uid || !hoy) return;

    // si está pausado localmente, lo sumamos antes de cerrar
    const startedAt = pausaDesdeRef.current;
    let sumaPausa = 0;
    if (startedAt) {
      sumaPausa = Math.floor((Date.now() - startedAt) / 60000);
      pausaDesdeRef.current = null;
    }

    const fin = new Date();
    const inicioMs = hoy.inicio ? new Date(hoy.inicio).getTime() : fin.getTime();
    const total = Math.floor((fin.getTime() - inicioMs) / 60000);
    const minutos_pausa = (hoy.minutos_pausa || 0) + sumaPausa;
    const trabajadas = Math.max(0, total - minutos_pausa);

    const { error } = await supabase
      .from("fichajes")
      .update({
        fin: fin.toISOString(),
        minutos_pausa,
        horas_trabajadas_min: trabajadas,
        estado: "finalizada",
      })
      .eq("id", hoy.id);

    if (!error) reload(uid);
  };

  // ===== UI =====
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-emerald-50 py-8">
      <div className="max-w-4xl mx-auto px-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
              ¡Hola, {nombre.split(" ")[0]}!
            </h1>
            <p className="text-slate-500">
              {format(new Date(), "EEEE d 'de' MMMM • HH:mm", { locale: es })}
            </p>
          </div>
        </div>

        {/* Tarjeta HOY */}
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-800">Hoy</h2>
            <EstadoPill estado={hoy?.estado} fin={hoy?.fin} />
          </div>

          <div className="space-y-4">
            {/* Línea de progreso */}
            <ProgressBar value={progreso} />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-slate-600">
                <p className="text-sm">Total hoy</p>
                <p className="text-2xl font-bold text-slate-800">{fmtHM(minutosHoy)}</p>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <MiniStat label="Inicio" value={fmtTime(hoy?.inicio)} />
                <MiniStat label="Pausa" value={fmtHM((hoy?.minutos_pausa || 0) + (pausaDesdeRef.current ? Math.floor((Date.now() - (pausaDesdeRef.current || 0)) / 60000) : 0))} />
                <MiniStat label="Fin" value={fmtTime(hoy?.fin)} />
              </div>
            </div>

            {/* Acciones */}
            <Acciones
              hoy={hoy}
              loading={loading}
              onStart={startShift}
              onPause={pauseShift}
              onResume={resumeShift}
              onEnd={endShift}
              hasLocalPause={!!pausaDesdeRef.current}
            />
          </div>
        </div>

        {/* Últimos días */}
        <div className="space-y-3">
          <h3 className="text-slate-700 font-medium">Últimos días</h3>
          {historial.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-slate-500 bg-white">
              Aún no hay historial de días anteriores.
            </div>
          ) : (
            <div className="space-y-3">
              {historial.map((d) => {
                const min = d.horas_trabajadas_min || 0;
                const pct = Math.min(100, Math.round((min / WORK_TARGET_MIN) * 100));
                return (
                  <div key={d.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <InitialAvatar text={nombre} />
                        <div className="leading-tight">
                          <p className="font-medium text-slate-800">
                            {format(new Date(d.fecha), "EEEE d 'de' MMMM", { locale: es })}
                          </p>
                          <p className="text-xs text-slate-500">
                            {fmtTime(d.inicio)} — {fmtTime(d.fin)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-slate-500">Total día</p>
                        <p className="text-lg font-semibold text-slate-800">
                          {fmtHM(min)}
                        </p>
                      </div>
                    </div>
                    <ProgressBar value={pct} tone={pct >= 100 ? "emerald" : pct > 60 ? "amber" : "sky"} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================== Sub-componentes ================== */

function InitialAvatar({ text }: { text: string }) {
  const ini = (text || "U").trim().charAt(0).toUpperCase();
  return (
    <div className="h-10 w-10 rounded-full grid place-items-center font-semibold text-white"
      style={{ background: "linear-gradient(135deg,#34d399,#06b6d4)" }}>
      {ini}
    </div>
  );
}

function ProgressBar({ value, tone = "emerald" }: { value: number; tone?: "emerald" | "amber" | "sky" }) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    sky: "bg-sky-500",
  };
  return (
    <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full ${tones[tone]} transition-all`} style={{ width: `${value}%` }} />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-medium text-slate-800">{value}</p>
    </div>
  );
}

function EstadoPill({ estado, fin }: { estado?: string | null; fin?: string | null }) {
  const s = (estado || (fin ? "finalizada" : "sin_fichaje")).toLowerCase();
  const base = "px-2 py-1 rounded-full text-xs font-medium";
  if (s === "en_pausa") return <span className={`${base} bg-amber-100 text-amber-800`}>En pausa</span>;
  if (s === "en_curso") return <span className={`${base} bg-emerald-100 text-emerald-700`}>En curso</span>;
  if (s === "finalizada") return <span className={`${base} bg-sky-100 text-sky-700`}>Finalizada</span>;
  return <span className={`${base} bg-slate-100 text-slate-700`}>Sin fichaje</span>;
}

function Acciones({
  hoy,
  loading,
  hasLocalPause,
  onStart,
  onPause,
  onResume,
  onEnd,
}: {
  hoy: Fichaje | null;
  loading: boolean;
  hasLocalPause: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
}) {
  if (loading) return null;

  // Sin fichaje hoy
  if (!hoy) {
    return (
      <div className="flex flex-wrap gap-3">
        <button
          onClick={onStart}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
        >
          Comenzar jornada
        </button>
      </div>
    );
  }

  // Con fichaje hoy
  const enCurso = hoy.estado === "en_curso" && !hoy.fin;
  const finalizada = hoy.fin !== null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {enCurso && !hasLocalPause && (
        <button
          onClick={onPause}
          className="px-4 py-2 rounded-lg bg-amber-500/90 text-white hover:bg-amber-600 transition"
        >
          Pausar
        </button>
      )}

      {enCurso && hasLocalPause && (
        <button
          onClick={onResume}
          className="px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 transition"
        >
          Reanudar
        </button>
      )}

      {enCurso && (
        <button
          onClick={onEnd}
          className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-black transition"
        >
          Finalizar jornada
        </button>
      )}

      {finalizada && (
        <span className="text-slate-500 text-sm">
          Jornada finalizada. ¡Buen trabajo! ✨
        </span>
      )}
    </div>
  );
}
