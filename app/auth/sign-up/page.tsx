"use client"

import type React from "react"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { SupabaseAuth } from "@/lib/auth/supabase"

export default function EmployeeSignUpPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [employeeId, setEmployeeId] = useState("")
  const [phone, setPhone] = useState("")
  const [department, setDepartment] = useState("")
  const [position, setPosition] = useState("")
  const [salary, setSalary] = useState("")
  const [address, setAddress] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    if (!email || !password || !name || !employeeId || !phone || !department || !position) {
      setError("Por favor, completa todos los campos obligatorios")
      setLoading(false)
      return
    }

    try {
      const { user, error: authError } = await SupabaseAuth.register({
        email,
        password,
        name,
        role: "empleado", // Siempre empleado
        employeeId,
        phone,
        department,
        position,
        salary: salary ? Number.parseFloat(salary) : 0,
        address: address || undefined,
        hireDate: new Date(),
      })

      if (authError || !user) {
        setError(authError || "Error al crear la cuenta")
        setLoading(false)
        return
      }

      console.log("[v0] Employee created successfully:", user.name)
      setSuccess(true)
      setTimeout(() => {
        router.push("/auth/sign-up-success")
      }, 2000)
    } catch (err) {
      console.error("[v0] Registration error:", err)
      setError("Error al crear la cuenta")
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl">
          <CardContent className="text-center py-8">
            <div className="text-green-500 text-6xl mb-4">✓</div>
            <h2 className="text-2xl font-bold mb-2">¡Empleado registrado!</h2>
            <p className="text-gray-600 dark:text-gray-400">Tu cuenta de empleado ha sido creada exitosamente</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl">
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
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">Registro de Empleado</CardTitle>
          <CardDescription>Completa tu información para crear tu cuenta de empleado</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nombre Completo *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Juan Pérez"
                  className="mt-1"
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="employeeId">ID de Empleado *</Label>
                <Input
                  id="employeeId"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="EMP001"
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
                  placeholder="juan@acemispain.com"
                  className="mt-1"
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="phone">Teléfono *</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+34 600 000 000"
                  className="mt-1"
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="department">Departamento *</Label>
                <Select value={department} onValueChange={setDepartment} disabled={loading}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecciona departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Recursos Humanos">Recursos Humanos</SelectItem>
                    <SelectItem value="Tecnología">Tecnología</SelectItem>
                    <SelectItem value="Ventas">Ventas</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Finanzas">Finanzas</SelectItem>
                    <SelectItem value="Operaciones">Operaciones</SelectItem>
                    <SelectItem value="Administración">Administración</SelectItem>
                    <SelectItem value="Producción">Producción</SelectItem>
                    <SelectItem value="Logística">Logística</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="position">Posición *</Label>
                <Input
                  id="position"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="Analista, Desarrollador, etc."
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

              <div>
                <Label htmlFor="salary">Salario Anual (€)</Label>
                <Input
                  id="salary"
                  type="number"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  placeholder="30000"
                  className="mt-1"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="address">Dirección</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Calle Principal 123, Madrid"
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
              <UserCheck className="h-4 w-4 mr-2" />
              {loading ? "Registrando empleado..." : "Registrar Empleado"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Button variant="ghost" onClick={() => router.push("/auth/login")} className="text-sm" disabled={loading}>
              ¿Ya tienes cuenta? Inicia sesión
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
