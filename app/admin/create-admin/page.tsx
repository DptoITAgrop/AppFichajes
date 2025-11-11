"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Shield, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import Image from "next/image"

import { SupabaseAuth, type User } from "@/lib/auth/supabase"

export default function CreateAdminPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const user = await SupabaseAuth.getCurrentUser()

      if (!user) {
        router.push("/auth/login")
        return
      }

      if (user.role !== "admin") {
        alert("Acceso denegado. Solo los administradores pueden crear otros administradores.")
        router.push("/")
        return
      }

      setCurrentUser(user)
      setIsLoading(false)
    }

    checkUser()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    if (!email || !password || !name) {
      setError("Por favor, completa todos los campos")
      setLoading(false)
      return
    }

    try {
      const { user, error: authError } = await SupabaseAuth.register({
        email,
        password,
        name,
        role: "admin",
        employeeId: `ADMIN${Date.now()}`,
      })

      if (authError || !user) {
        setError(authError || "Error al crear el administrador")
        setLoading(false)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        router.push("/admin")
      }, 1500)
    } catch (err) {
      console.error("[admin] Admin creation error:", err)
      setError("Error al crear el administrador")
      setLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Verificando permisos...</p>
        </div>
      </div>
    )
  }

  if (!currentUser) return null

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl">
          <CardContent className="text-center py-8">
            <div className="text-green-500 text-6xl mb-4">✓</div>
            <h2 className="text-2xl font-bold mb-2">¡Administrador creado!</h2>
            <p className="text-gray-600 dark:text-gray-400">La cuenta de administrador ha sido creada exitosamente</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <Image
              src="/images/acemispain-logo.png"
              alt="ACEMISPAIN Nursery"
              width={150}
              height={60}
              className="h-12 w-auto"
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">Crear Administrador</CardTitle>
          <CardDescription>Crea una nueva cuenta de administrador</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre Completo *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Administrador Sistema"
                className="mt-1"
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@acemispain.com"
                className="mt-1"
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="password">Contraseña *</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="mt-1"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full h-12" disabled={loading}>
              <Shield className="h-4 w-4 mr-2" />
              {loading ? "Creando administrador..." : "Crear Administrador"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Button variant="ghost" onClick={() => router.push("/admin")} className="text-sm" disabled={loading}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
