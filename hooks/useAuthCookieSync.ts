"use client";
import { useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

export function useAuthCookieSync() {
  useEffect(() => {
    const supabase = createBrowserClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      fetch("/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, session }),
      });
    });
    return () => sub?.subscription.unsubscribe();
  }, []);
}
