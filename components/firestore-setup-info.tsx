"use client"

import { AlertTriangle, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useState } from "react"

export function FirestoreSetupInfo() {
  const [copied, setCopied] = useState(false)

  const firestoreRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, update, delete: if request.auth != null && request.auth.uid == userId;
      allow create: if request.auth != null;
    }
  }
}`

  const copyRules = async () => {
    try {
      await navigator.clipboard.writeText(firestoreRules)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Error al copiar:", err)
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Configuración de Firestore Requerida
        </CardTitle>
        <CardDescription>
          Tus reglas actuales de Firestore están denegando todo acceso. Necesitas actualizarlas para permitir que los
          usuarios autenticados accedan a sus datos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            <strong>Problema detectado:</strong> Las reglas actuales tienen <code>allow read, write: if false;</code>{" "}
            que bloquea todo acceso. La aplicación está funcionando con datos temporales hasta que actualices las
            reglas.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <h4 className="font-medium">Pasos para configurar:</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li>
              Ve a la <strong>consola de Firebase</strong>
            </li>
            <li>Selecciona tu proyecto</li>
            <li>
              Ve a <strong>Firestore Database → Reglas</strong>
            </li>
            <li>
              <strong>Reemplaza completamente</strong> las reglas existentes con las siguientes:
            </li>
            <li>
              Haz clic en <strong>"Publicar"</strong> para aplicar los cambios
            </li>
          </ol>
        </div>

        <div className="relative">
          <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
            <code>{firestoreRules}</code>
          </pre>
          <Button size="sm" variant="outline" className="absolute top-2 right-2 bg-transparent" onClick={copyRules}>
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1" />
                Copiar
              </>
            )}
          </Button>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <h5 className="font-medium text-green-800 mb-1">¿Qué hacen estas reglas?</h5>
          <ul className="text-sm text-green-700 space-y-1">
            <li>• Permiten que usuarios autenticados lean solo sus propios datos</li>
            <li>• Permiten que usuarios autenticados actualicen solo sus propios perfiles</li>
            <li>• Mantienen la seguridad bloqueando acceso a datos de otros usuarios</li>
            <li>• Reemplazan las reglas restrictivas actuales que bloquean todo</li>
          </ul>
        </div>

        <Alert>
          <AlertDescription>
            <strong>Importante:</strong> Después de publicar las reglas, recarga la aplicación para que los cambios
            surtan efecto.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
