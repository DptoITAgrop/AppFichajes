"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, CreditCard, CheckCircle, XCircle, Loader2, MapPin } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import Image from "next/image"
import { createBrowserClient } from "@/lib/supabase/client"

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

interface Employee {
  id: string
  employee_id: string
  name: string
  card_id: string | null
  department: string | null
  position: string | null
}

export default function TerminalPage() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [cardInput, setCardInput] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastEntry, setLastEntry] = useState<TimeEntry | null>(null)
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | null
    message: string
  }>({ type: null, message: "" })
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createBrowserClient()

  // Keep input focused for card reader
  useEffect(() => {
    const focusInput = () => {
      if (inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus()
      }
    }

    focusInput()
    const interval = setInterval(focusInput, 1000)

    return () => clearInterval(interval)
  }, [])

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Load recent entries
  useEffect(() => {
    const loadRecentEntries = async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(10)

      if (data && !error) {
        setRecentEntries(
          data.map((entry) => ({
            id: entry.id,
            employee_id: entry.employee_id,
            employee_name: entry.employee_name,
            type: entry.type as "entrada" | "salida",
            timestamp: new Date(entry.timestamp),
            location: entry.location,
          })),
        )
      }
    }

    loadRecentEntries()
    const interval = setInterval(loadRecentEntries, 5000)
    return () => clearInterval(interval)
  }, [supabase])

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

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          })
        },
        () => {
          // Silently fail and continue without location
          resolve({
            latitude: 0,
            longitude: 0,
            accuracy: 0,
          })
        },
        {
          enableHighAccuracy: false,
          timeout: 3000,
          maximumAge: 300000,
        },
      )
    })
  }

  const getAddressFromCoords = async (lat: number, lng: number): Promise<string> => {
    if (lat === 0 && lng === 0) return ""
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

  const handleCardRead = async (cardId: string) => {
    if (!cardId.trim() || isProcessing) return

    setIsProcessing(true)
    setFeedback({ type: null, message: "" })

    try {
      // Find employee by card_id
      const { data: employee, error: employeeError } = await supabase
        .from("profiles")
        .select("*")
        .eq("card_id", cardId)
        .single()

      if (employeeError || !employee) {
        setFeedback({
          type: "error",
          message: "Tarjeta no reconocida. Contacte al administrador.",
        })
        setIsProcessing(false)
        return
      }

      // Get last entry for this employee
      const { data: lastEntryData } = await supabase
        .from("time_entries")
        .select("*")
        .eq("employee_id", employee.employee_id)
        .order("timestamp", { ascending: false })
        .limit(1)
        .single()

      // Determine entry type (entrada or salida)
      const entryType: "entrada" | "salida" = !lastEntryData || lastEntryData.type === "salida" ? "entrada" : "salida"

      // Get location
      const location = await getCurrentLocation()
      let address: string | undefined
      if (location.latitude !== 0) {
        try {
          address = await getAddressFromCoords(location.latitude, location.longitude)
        } catch (error) {
          console.log("No se pudo obtener la dirección")
        }
      }

      // Create time entry
      const newEntry = {
        employee_id: employee.employee_id,
        employee_name: employee.name,
        type: entryType,
        timestamp: new Date().toISOString(),
        location:
          location.latitude !== 0
            ? {
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: Math.round(location.accuracy),
                address: address,
              }
            : null,
      }

      const { data: insertedEntry, error: insertError } = await supabase
        .from("time_entries")
        .insert(newEntry)
        .select()
        .single()

      if (insertError) {
        throw new Error("Error al registrar fichaje")
      }

      const timeEntry: TimeEntry = {
        id: insertedEntry.id,
        employee_id: insertedEntry.employee_id,
        employee_name: insertedEntry.employee_name,
        type: insertedEntry.type as "entrada" | "salida",
        timestamp: new Date(insertedEntry.timestamp),
        location: insertedEntry.location,
      }

      setLastEntry(timeEntry)
      setRecentEntries([timeEntry, ...recentEntries.slice(0, 9)])
      setFeedback({
        type: "success",
        message: `${employee.name} - ${entryType.toUpperCase()} registrada correctamente`,
      })
    } catch (error) {
      console.error("Error processing card:", error)
      setFeedback({
        type: "error",
        message: "Error al procesar el fichaje. Intente nuevamente.",
      })
    } finally {
      setIsProcessing(false)
      setCardInput("")

      // Clear feedback after 3 seconds
      setTimeout(() => {
        setFeedback({ type: null, message: "" })
      }, 3000)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleCardRead(cardInput)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Image
              src="/images/AG Cuadrado (2).png"
              alt="ACEMISPAIN Nursery"
              width={200}
              height={80}
              className="h-16 w-auto"
              priority
            />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Terminal de Fichaje</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">Sistema de Lector de Tarjetas</p>
        </div>

        {/* Hidden input for card reader */}
        <input
          ref={inputRef}
          type="text"
          value={cardInput}
          onChange={(e) => setCardInput(e.target.value)}
          onKeyPress={handleKeyPress}
          className="sr-only"
          autoFocus
          placeholder="Esperando lectura de tarjeta..."
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Clock Card */}
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl">
            <CardContent className="p-8">
              <div className="text-center">
                <div className="flex items-center justify-center mb-4">
                  <Clock className="h-8 w-8 text-blue-600 mr-3" />
                  <span className="text-2xl font-semibold text-gray-700 dark:text-gray-200">Hora Actual</span>
                </div>
                <div className="text-6xl font-mono font-bold text-blue-600 dark:text-blue-400 mb-2">
                  {format(currentTime, "HH:mm:ss")}
                </div>
                <div className="text-xl text-gray-600 dark:text-gray-300">
                  {format(currentTime, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card Reader Status */}
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl">
                <CreditCard className="h-6 w-6 mr-2 text-blue-600" />
                Estado del Lector
              </CardTitle>
              <CardDescription>Acerque su tarjeta al lector</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-center p-8 rounded-lg bg-gray-50 dark:bg-gray-700">
                  {isProcessing ? (
                    <div className="text-center">
                      <Loader2 className="h-16 w-16 animate-spin text-blue-600 mx-auto mb-4" />
                      <p className="text-lg font-medium">Procesando...</p>
                    </div>
                  ) : feedback.type ? (
                    <div className="text-center">
                      {feedback.type === "success" ? (
                        <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                      ) : (
                        <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
                      )}
                      <p
                        className={`text-lg font-medium ${feedback.type === "success" ? "text-green-600" : "text-red-600"}`}
                      >
                        {feedback.message}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <CreditCard className="h-16 w-16 text-gray-400 mx-auto mb-4 animate-pulse" />
                      <p className="text-lg font-medium text-gray-600 dark:text-gray-300">Esperando tarjeta...</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        Acerque su tarjeta al lector para fichar
                      </p>
                    </div>
                  )}
                </div>

                {lastEntry && (
                  <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Último fichaje:</div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-blue-900 dark:text-blue-100">
                          {lastEntry.employee_name}
                        </span>
                        <Badge
                          variant={lastEntry.type === "entrada" ? "default" : "secondary"}
                          className={lastEntry.type === "entrada" ? "bg-green-500" : "bg-red-500"}
                        >
                          {lastEntry.type.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="text-sm text-blue-600 dark:text-blue-300">
                        {format(lastEntry.timestamp, "HH:mm:ss 'del' dd/MM/yyyy")}
                      </div>
                      {lastEntry.location && lastEntry.location.latitude !== 0 && (
                        <div className="text-xs text-blue-500 dark:text-blue-400 flex items-center">
                          <MapPin className="h-3 w-3 mr-1" />
                          {lastEntry.location.address ||
                            `${lastEntry.location.latitude.toFixed(4)}, ${lastEntry.location.longitude.toFixed(4)}`}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Entries */}
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center text-2xl">
              <Clock className="h-6 w-6 mr-2 text-blue-600" />
              Fichajes Recientes
            </CardTitle>
            <CardDescription>Últimos 10 fichajes registrados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recentEntries.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">No hay fichajes registrados</div>
              ) : (
                recentEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">{entry.employee_name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">ID: {entry.employee_id}</div>
                      {entry.location && entry.location.latitude !== 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center">
                          <MapPin className="h-3 w-3 mr-1" />
                          <span className="truncate">
                            {entry.location.address ||
                              `${entry.location.latitude.toFixed(4)}, ${entry.location.longitude.toFixed(4)}`}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <Badge
                        variant={entry.type === "entrada" ? "default" : "secondary"}
                        className={entry.type === "entrada" ? "bg-green-500" : "bg-red-500"}
                      >
                        {entry.type.toUpperCase()}
                      </Badge>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
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
  )
}
