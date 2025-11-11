// app/api/comunicados/notify/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const comunicado = body?.comunicado;
  if (!comunicado) return NextResponse.json({ ok: false }, { status: 400 });

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // <<< IMPORTANTE: Service Role
  );

  // recoge emails de empleados activos
  const { data: empleados, error } = await supa
    .from("profiles")
    .select("email")
    .or("rol.eq.empleado,rol.eq.user") // ajusta a tu esquema
    .eq("estado", "activo")            // si tienes columna estado
    ;

  if (error) {
    console.error(error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const to = (empleados || []).map((e: any) => e.email).filter(Boolean);
  if (to.length === 0) return NextResponse.json({ ok: true });

  const resend = new Resend(process.env.RESEND_API_KEY!);

  await resend.emails.send({
    from: "notificaciones@tu-dominio.com", // configura un remitente verificado en Resend
    to,
    subject: `Nuevo comunicado: ${comunicado.titulo}`,
    html: `
      <div style="font-family:sans-serif">
        <h2>${comunicado.titulo}</h2>
        <p>${comunicado.mensaje.replace(/\n/g, "<br/>")}</p>
        <p style="color:#64748b;font-size:12px">
          Prioridad: <b>${comunicado.prioridad}</b> · Publicado: ${new Date(comunicado.fecha_publicacion).toLocaleString("es-ES")}
        </p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
