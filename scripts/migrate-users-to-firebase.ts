import { FirebaseAuth } from "../lib/auth/firebase"

// Usuarios existentes del sistema local
const EXISTING_USERS = [
  {
    email: "alvaro.lopez@agroptimum.com",
    name: "Alvaro López Cano",
    role: "admin" as const,
    employeeId: "ADMIN2",
    password: "admin123",
  },
  {
    email: "cristina.dediego@acemispain.com",
    name: "Cristina",
    role: "empleado" as const,
    employeeId: "EM001",
    password: "emp123",
  },
  {
    email: "admin1@agroptimum.com",
    name: "AdminT",
    role: "admin" as const,
    employeeId: "ADMIN1",
    password: "admin123",
  },
]

async function migrateUsers() {
  console.log("🔄 Iniciando migración de usuarios a Firebase...")

  for (const user of EXISTING_USERS) {
    try {
      console.log(`📝 Migrando usuario: ${user.email}`)

      const result = await FirebaseAuth.register({
        email: user.email,
        password: user.password,
        name: user.name,
        role: user.role,
        employeeId: user.employeeId,
      })

      if (result.error) {
        console.error(`❌ Error migrando ${user.email}:`, result.error)
      } else {
        console.log(`✅ Usuario ${user.email} migrado exitosamente`)
      }
    } catch (error) {
      console.error(`❌ Error inesperado migrando ${user.email}:`, error)
    }
  }

  console.log("🎉 Migración completada")
}

// Ejecutar migración
migrateUsers().catch(console.error)
