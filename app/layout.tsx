// app/layout.tsx
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import AuthSync from "./_auth-sync";
import "./globals.css";

export const metadata: Metadata = {
  title: "v0 App",
  description: "Created with v0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">
        <AuthSync />      {/* 👈 añade esto */}
        {children}
        <Analytics />
      </body>
    </html>
  );
}
