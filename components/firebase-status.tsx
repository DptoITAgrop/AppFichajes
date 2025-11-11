"use client"

import { useState, useEffect } from "react"
import { FIREBASE_CONFIGURED } from "@/lib/firebase/config"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CheckCircle, AlertTriangle, Settings } from "lucide-react"
import { FirebaseAuth } from "@/lib/auth/firebase"
import { useRouter } from "next/navigation"

export function FirebaseStatus() {
  const [firestorePermissionError, setFirestorePermissionError] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkFirestorePermissions = async () => {
      try {
        const user = await FirebaseAuth.getCurrentUser()
        if (user && user.employeeId?.startsWith("temp-")) {
          setFirestorePermissionError(true)
        }
      } catch (error) {
        console.log("[v0] Error checking Firestore permissions:", error)
      }
    }

    if (FIREBASE_CONFIGURED) {
      checkFirestorePermissions()
    }
  }, [])

  if (FIREBASE_CONFIGURED) {
    return (
      <div className="mb-4 space-y-2">
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Conectado a Firebase proyecto: <strong>fichajes-19688</strong>
          </AlertDescription>
        </Alert>

        {firestorePermissionError && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <div className="flex items-center justify-between">
                <span>
                  <strong>Configuración Pendiente:</strong> Tu sesión se inició correctamente, pero los datos del perfil
                  no se pudieron cargar desde Firestore. Esto es normal en la primera configuración.
                </span>
                <div className="flex gap-2 ml-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push("/admin/firestore-setup")}
                    className="bg-transparent"
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    Ver Instrucciones de Configuración
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => setFirestorePermissionError(false)}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Continuar con Datos Temporales
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  return (
    <Alert className="mb-4 border-yellow-200 bg-yellow-50">
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <AlertDescription className="text-yellow-800">
        <strong>Modo de emergencia:</strong> Usando autenticación local. Para usar Firebase, configura las variables de
        entorno.
      </AlertDescription>
    </Alert>
  )
}
