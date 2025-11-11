// app/api/comunicados/create/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

function renderHTML(com: any) {
  return `
  <div style="font-family:sans-serif;padding:20px;background:#f6fef9;">
    <h2 style="color:#065f46;margin-bottom:8px;">${com.titulo}</h2>
    <p style="color:#334155;">${com.mensaje.replace(/\n/g, "<br>")}</p>
    <p style="margin-top:12px;color:#475569;font-size:13px;">
      Prioridad: <b>${com.prioridad}</b> · ${new Date(com.fecha_publicacion).toLocaleString("es-ES")}
    </p>
    <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://tu-dominio.com"}/comunicados"
       style="display:inline-block;margin-top:14px;background:#047857;color:white;padding:8px 16px;border-radius:8px;text-decoration:none;">
      Ver en la app
    </a>
  </div>
  `;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { titulo, mensaje, prioridad, creado_por } = body;

    if (!titulo || !mensaje) {
      return NextResponse.json({ ok: false, error: "Faltan campos" }, { status: 400 });
    }

    // Supabase (usar Service Role en el backend)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1️⃣ Insertar comunicado
    const { data, error } = await supabase
      .from("comunicados")
      .insert([
        {
          titulo,
          mensaje,
          prioridad,
          creado_por,
          activo: true,
          fecha_publicacion: new Date().toISOString(),
        },
      ])
      .select("*")
      .single();

    if (error) {
      console.error("Error insertando comunicado:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // 2️⃣ Obtener emails de empleados activos
    const { data: empleados } = await supabase
      .from("profiles")
      .select("email")
      .in("rol", ["empleado", "user"])
      .eq("estado", "activo");

    const emails = (empleados || [])
      .map((e) => e.email)
      .filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

    if (emails.length > 0) {
      await resend.emails.send({
        from: "notificaciones@tu-dominio.com",
        bcc: emails,
        to: [process.env.RESEND_TO_FALLBACK || "notificaciones@tu-dominio.com"],
        subject: `📢 Nuevo comunicado: ${titulo}`,
        html: renderHTML({ titulo, mensaje, prioridad, fecha_publicacion: new Date() }),
      });
    }

    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    console.error("Error general:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
