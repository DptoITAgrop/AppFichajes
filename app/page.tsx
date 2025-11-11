"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, LogIn, LogOut, UserIcon, Calendar, MapPin, Loader2, Shield } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { SupabaseAuth, type User } from "@/lib/auth/supabase"

interface TimeEntry {
  id: string
  employee_id: string
  employee_name: string
  type: "entrada" | "salida"
  timestamp: Date
  location?: {
    latitude: number
    longitude: number
    accuracy: number
    address?: string
  }
}

export default function HomePage() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [lastEntry, setLastEntry] = useState<TimeEntry | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [locationPermission, setLocationPermission] = useState<"granted" | "denied" | "prompt">("prompt")
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number
    longitude: number
    accuracy: number
  } | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const user = await SupabaseAuth.getCurrentUser()

      if (!user) {
        router.push("/auth/login")
        return
      }

      setCurrentUser(user)
      setLoading(false)
    }

    checkUser()
  }, [router])

  useEffect(() => {
    if (!currentUser) return

    const savedEntries = localStorage.getItem("timeEntries")

    if (savedEntries) {
      try {
        const entries = JSON.parse(savedEntries).map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
        }))
        setTimeEntries(entries)
      } catch (error) {
        console.error("Error cargando fichajes:", error)
        setTimeEntries([])
      }
    }
  }, [currentUser])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleLogout = async () => {
    await SupabaseAuth.logout()
    router.push("/auth/login")
  }

  const getCurrentLocation = (): Promise<{
    latitude: number
    longitude: number
    accuracy: number
  }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocalización no soportada"))
        return
      }

      setIsGettingLocation(true)

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          }
          setCurrentLocation(location)
          setIsGettingLocation(false)
          resolve(location)
        },
        (error) => {
          setIsGettingLocation(false)
          let errorMessage = "Error obteniendo ubicación"

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Permiso de ubicación denegado"
              setLocationPermission("denied")
              break
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Ubicación no disponible"
              break
            case error.TIMEOUT:
              errorMessage = "Tiempo de espera agotado"
              break
          }

          reject(new Error(errorMessage))
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000, // 5 minutos
        },
      )
    })
  }

  const getAddressFromCoords = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=es`,
      )
      const data = await response.json()
      return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    } catch (error) {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    }
  }

  useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        setLocationPermission(result.state as "granted" | "denied" | "prompt")
      })
    }
  }, [])

  const handleTimeEntry = async (type: "entrada" | "salida") => {
    if (!currentUser) return

    try {
      const location = await getCurrentLocation()

      let address: string | undefined
      try {
        address = await getAddressFromCoords(location.latitude, location.longitude)
      } catch (error) {
        console.log("No se pudo obtener la dirección:", error)
      }

      const newEntry: TimeEntry = {
        id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        employee_id: currentUser.employeeId || currentUser.id,
        employee_name: currentUser.name,
        type: type,
        timestamp: new Date(),
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: Math.round(location.accuracy),
          address: address,
        },
      }

      const updatedEntries = [newEntry, ...timeEntries]
      setTimeEntries(updatedEntries)
      localStorage.setItem("timeEntries", JSON.stringify(updatedEntries))
      setLastEntry(newEntry)
    } catch (error) {
      const continueWithoutLocation = confirm(
        `No se pudo obtener la ubicación: ${error instanceof Error ? error.message : "Error desconocido"}\n\n¿Deseas continuar el fichaje sin ubicación?`,
      )

      if (continueWithoutLocation) {
        const newEntry: TimeEntry = {
          id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          employee_id: currentUser.employeeId || currentUser.id,
          employee_name: currentUser.name,
          type: type,
          timestamp: new Date(),
        }

        const updatedEntries = [newEntry, ...timeEntries]
        setTimeEntries(updatedEntries)
        localStorage.setItem("timeEntries", JSON.stringify(updatedEntries))
        setLastEntry(newEntry)
      }
    }
  }

  const getCurrentStatus = () => {
    if (!currentUser) return null
    const empId = currentUser.employeeId || currentUser.id
    const lastEmployeeEntry = getLastEntryForEmployee(empId)
    return lastEmployeeEntry?.type === "entrada" ? "trabajando" : "fuera"
  }

  const getLastEntryForEmployee = (empId: string) => {
    return timeEntries
      .filter((entry) => entry.employee_id === empId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return <div>Cargando...</div>
  }

  const currentStatus = getCurrentStatus()
  const todayEntries = timeEntries.filter(
    (entry) => format(entry.timestamp, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"),
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
            <Image
              src="/images/acemispain-logo.png"
              alt="ACEMISPAIN Nursery"
              width={200}
              height={80}
              className="h-12 sm:h-16 w-auto"
              priority
            />
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Sistema de Fichajes
          </h1>
          <p className="text-lg sm:text-xl lg:text-2xl text-blue-600 dark:text-blue-400 font-semibold px-4 mb-2">
            ¡Bienvenido, {currentUser.name}!
          </p>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 px-4">
            {currentUser.role === "admin" ? "Panel de Administrador" : "Panel de Empleado"}
          </p>

          <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2">
            <Badge variant="outline" className="text-xs">
              {currentUser.role === "admin" ? "Administrador" : "Empleado"}
              {currentUser.employeeId && ` - ID: ${currentUser.employeeId}`}
            </Badge>
            <div className="flex gap-2">
              {currentUser.role === "admin" && (
                <Button asChild variant="outline" size="sm" className="text-xs sm:text-sm bg-transparent">
                  <a href="/admin">
                    <Shield className="h-4 w-4 mr-1" />
                    Dashboard Admin
                  </a>
                </Button>
              )}
              <Button onClick={handleLogout} variant="outline" size="sm" className="text-xs sm:text-sm bg-transparent">
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>

        <Card className="mb-6 sm:mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl">
          <CardContent className="p-4 sm:p-6 lg:p-8">
            <div className="text-center">
              <div className="flex items-center justify-center mb-3 sm:mb-4">
                <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 mr-2 sm:mr-3" />
                <span className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-700 dark:text-gray-200">
                  Hora Actual
                </span>
              </div>
              <div className="text-3xl sm:text-4xl lg:text-6xl font-mono font-bold text-blue-600 dark:text-blue-400 mb-2">
                {format(currentTime, "HH:mm:ss")}
              </div>
              <div className="text-sm sm:text-base lg:text-xl text-gray-600 dark:text-gray-300 px-2">
                {format(currentTime, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl">
            <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6">
              <CardTitle className="flex items-center text-lg sm:text-xl lg:text-2xl">
                <UserIcon className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-blue-600" />
                Fichar Entrada/Salida
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">
                Registra tu fichaje con ubicación automática
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
              <div className="p-3 sm:p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium flex items-center">
                    <MapPin className="h-4 w-4 mr-1" />
                    Estado de ubicación:
                  </span>
                  <Badge
                    variant={locationPermission === "granted" ? "default" : "secondary"}
                    className={
                      locationPermission === "granted"
                        ? "bg-green-500"
                        : locationPermission === "denied"
                          ? "bg-red-500"
                          : "bg-yellow-500"
                    }
                  >
                    {locationPermission === "granted"
                      ? "Permitida"
                      : locationPermission === "denied"
                        ? "Denegada"
                        : "Pendiente"}
                  </Badge>
                </div>
                {currentLocation && (
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    Precisión: {Math.round(currentLocation.accuracy)}m
                  </div>
                )}
                {locationPermission === "denied" && (
                  <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                    Para habilitar la ubicación, permite el acceso en la configuración del navegador
                  </div>
                )}
              </div>

              {currentStatus && (
                <div className="p-3 sm:p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Estado actual:</span>
                    <Badge
                      variant={currentStatus === "trabajando" ? "default" : "secondary"}
                      className={currentStatus === "trabajando" ? "bg-green-500" : "bg-gray-500"}
                    >
                      {currentStatus === "trabajando" ? "Trabajando" : "Fuera"}
                    </Badge>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Button
                  onClick={() => handleTimeEntry("entrada")}
                  disabled={isGettingLocation}
                  className="h-14 sm:h-16 text-base sm:text-lg bg-green-600 hover:bg-green-700 touch-manipulation"
                >
                  {isGettingLocation ? (
                    <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 mr-2 animate-spin" />
                  ) : (
                    <LogIn className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />
                  )}
                  Entrada
                </Button>
                <Button
                  onClick={() => handleTimeEntry("salida")}
                  disabled={isGettingLocation}
                  variant="destructive"
                  className="h-14 sm:h-16 text-base sm:text-lg touch-manipulation"
                >
                  {isGettingLocation ? (
                    <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 mr-2 animate-spin" />
                  ) : (
                    <LogOut className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />
                  )}
                  Salida
                </Button>
              </div>

              {lastEntry && (
                <div className="p-3 sm:p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                    Último fichaje registrado:
                  </div>
                  <div className="text-sm sm:text-base text-blue-600 dark:text-blue-300">
                    <strong>{lastEntry.employee_name}</strong> - {lastEntry.type.toUpperCase()}
                    <br />
                    {format(lastEntry.timestamp, "HH:mm:ss 'del' dd/MM/yyyy")}
                    {lastEntry.location && (
                      <div className="text-xs mt-1 text-blue-500 dark:text-blue-400">
                        <MapPin className="h-3 w-3 inline mr-1" />
                        {lastEntry.location.address ||
                          `${lastEntry.location.latitude.toFixed(6)}, ${lastEntry.location.longitude.toFixed(6)}`}
                        <span className="ml-2">(±{Math.round(lastEntry.location.accuracy)}m)</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl">
            <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6">
              <CardTitle className="flex items-center text-lg sm:text-xl lg:text-2xl">
                <Calendar className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-blue-600" />
                Mis Fichajes de Hoy
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">
                Registro de tus fichajes del día actual con ubicación
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="space-y-2 sm:space-y-3 max-h-80 sm:max-h-96 overflow-y-auto">
                {todayEntries.filter((entry) => entry.employee_id === (currentUser.employeeId || currentUser.id))
                  .length === 0 ? (
                  <div className="text-center py-6 sm:py-8 text-gray-500 dark:text-gray-400 text-sm sm:text-base">
                    No tienes fichajes registrados hoy
                  </div>
                ) : (
                  todayEntries
                    .filter((entry) => entry.employee_id === (currentUser.employeeId || currentUser.id))
                    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                    .map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 dark:text-white text-sm sm:text-base truncate">
                            {entry.employee_name}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                            ID: {entry.employee_id}
                          </div>
                          {entry.location && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center">
                              <MapPin className="h-3 w-3 mr-1" />
                              <span className="truncate">
                                {entry.location.address ||
                                  `${entry.location.latitude.toFixed(4)}, ${entry.location.longitude.toFixed(4)}`}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-right ml-3">
                          <Badge
                            variant={entry.type === "entrada" ? "default" : "secondary"}
                            className={`${entry.type === "entrada" ? "bg-green-500" : "bg-red-500"} text-xs`}
                          >
                            {entry.type.toUpperCase()}
                          </Badge>
                          <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {format(entry.timestamp, "HH:mm:ss")}
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
