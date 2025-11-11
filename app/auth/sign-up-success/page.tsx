// app/api/comunicados/notify/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

/** ============================
 *  CONFIG
 *  ============================ */
const EMAIL_BATCH_SIZE = 90; // deja margen bajo límites de 100 por envío
const ALLOWED_ROLES = ["empleado", "user"]; // ajusta a tu esquema
const ONLY_ACTIVE = true; // si usas columna estado

// Render simple + branding Agroptimum
function renderEmailHTML(com: {
  titulo: string;
  mensaje: string;
  prioridad: string;
  fecha_publicacion: string | Date;
}) {
  const fecha = new Date(com.fecha_publicacion);
  const msgHtml = (com.mensaje || "").replace(/\n/g, "<br/>");

  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue',Arial,sans-serif;background:#f6fef9;padding:24px;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="display:flex;align-items:center;gap:12px;background:linear-gradient(90deg,#059669,#047857);padding:16px 20px;color:#fff">
        <img src="https://raw.githubusercontent.com/AgroptimumAssets/public/main/agroptimum-logo-white.png" alt="Agroptimum" width="32" height="32" style="display:block;border-radius:6px;background:rgba(255,255,255,0.1);padding:4px"/>
        <div>
          <div style="font-weight:700;font-size:16px">Agroptimum · Nuevo comunicado</div>
          <div style="opacity:.9;font-size:12px">Notificación automática</div>
        </div>
      </div>

      <div style="padding:20px 22px">
        <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a">${com.titulo}</h2>

        <div style="margin:8px 0 16px;">
          <span style="display:inline-block;background:#ecfeff;color:#0369a1;border:1px solid #bae6fd;border-radius:999px;padding:4px 10px;font-size:11px">
            Prioridad: <b style="text-transform:capitalize">${com.prioridad}</b>
          </span>
          <span style="display:inline-block;background:#ecfdf5;color:#065f46;border:1px solid #bbf7d0;border-radius:999px;padding:4px 10px;font-size:11px;margin-left:8px">
            Publicado: ${fecha.toLocaleString("es-ES")}
          </span>
        </div>

        <div style="line-height:1.55;font-size:14px;color:#334155">${msgHtml}</div>

        <div style="margin-top:18px">
          <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://tu-dominio.com"}/comunicados" 
             style="display:inline-block;background:#065f46;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;font-size:14px">
            Ver en la app
          </a>
        </div>
      </div>

      <div style="padding:14px 20px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px">
        © ${new Date().getFullYear()} Agroptimum · Este es un mensaje automático
      </div>
    </div>
  </div>`;
}

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const comunicado = body?.comunicado;
    if (!comunicado?.titulo || !comunicado?.mensaje) {
      return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
    }

    // 1) Supabase admin client (SERVER ONLY! Nunca NEXT_PUBLIC)
    const supa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,           // URL pública está bien
      process.env.SUPABASE_SERVICE_ROLE_KEY!           // Service Role (solo en server)
    );

    // 2) Lee emails
    let query = supa.from("profiles").select("email, rol, estado");
    if (ONLY_ACTIVE) query = query.eq("estado", "activo");
    const { data: employees, error } = await query;
    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ ok: false, error: "DB error" }, { status: 500 });
    }

    // 3) Filtra roles permitidos + email válido y deduplica
    const emails = Array.from(
      new Set(
        (employees || [])
          .filter((r: any) => ALLOWED_ROLES.includes((r.rol || "").toLowerCase()))
          .map((r: any) => String(r.email || "").trim())
          .filter((e) => e && isValidEmail(e))
      )
    );

    if (emails.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, msg: "Sin destinatarios" });
    }

    // 4) Prepara Resend
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const FROM =
      process.env.RESEND_FROM ?? "onboarding@resend.dev"; // usa dominio verificado cuando lo tengas

    const subject = `Nuevo comunicado: ${comunicado.titulo}`;
    const html = renderEmailHTML({
      titulo: comunicado.titulo,
      mensaje: comunicado.mensaje,
      prioridad: (comunicado.prioridad || "media").toString().toLowerCase(),
      fecha_publicacion: comunicado.fecha_publicacion || new Date(),
    });

    // 5) DRY RUN en dev si quieres (no envía, solo registra)
    if (process.env.RESEND_DRY_RUN === "1") {
      console.log("[DRY RUN] Envío a:", emails);
      return NextResponse.json({ ok: true, sent: 0, dryRun: true });
    }

    // 6) Envío por lotes (BCC)
    // Aconsejado: poner en "to" un buzón propio información@... y el lote real en bcc
    const batches = chunk(emails, EMAIL_BATCH_SIZE);
    let sentCount = 0;
    for (const group of batches) {
      const res = await resend.emails.send({
        from: FROM,
        to: [process.env.RESEND_TO_FALLBACK || FROM], // destinatario visible (puede ser un buzón propio)
        bcc: group,                                   // aquí va el lote real
        subject,
        html,
      });

      if (res.error) {
        console.error("Resend error:", res.error);
        // sigue con el resto; si prefieres abortar, haz return con 500
      } else {
        sentCount += group.length;
      }
    }

    return NextResponse.json({ ok: true, sent: sentCount });
  } catch (e: any) {
    console.error("Notify route error:", e);
    return NextResponse.json({ ok: false, error: "Unhandled" }, { status: 500 });
  }
}
