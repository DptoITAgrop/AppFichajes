// app/_auth-sync.tsx
"use client";
import { useAuthCookieSync } from "@/hooks/useAuthCookieSync";
export default function AuthSync() {
  useAuthCookieSync();
  return null;
}
