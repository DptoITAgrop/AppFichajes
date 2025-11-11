import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function createSupabase(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: any) =>
          res.cookies.set({ name, value, ...options }),
        remove: (name: string, options: any) =>
          res.cookies.set({ name, value: "", ...options }),
      },
    }
  );
  return { supabase, res };
}

export async function POST(req: NextRequest) {
  const { supabase, res } = createSupabase(req);
  const { event, session } = await req.json();

  if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
    await supabase.auth.setSession(session);
  }
  if (event === "SIGNED_OUT") {
    await supabase.auth.signOut();
  }

  return res;
}
