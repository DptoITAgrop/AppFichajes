// lib/excel-export.ts
import ExcelJS from "exceljs"

interface ExcelExportOptions {
  filename: string
  sheetName: string
  title: string
  subtitle?: string
  data: any[]
  headers: string[]
  logoPath?: string
}

const AGRO_GREEN = "FF006B40"       // #006B40
const AGRO_GREEN_LIGHT = "FFE6F2EC" // verde suave para zebra
const TEXT_DARK = "FF1F2937"
const TEXT_MID = "FF374151"
const BORDER_SOFT = "FFE5E7EB"

// 1 -> A, 27 -> AA, etc.
function colLetter(n: number) {
  let s = ""
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export class ExcelExporter {
  /** Añade el logo centrado en la parte superior (rango dinámico) */
  private static async addLogo(
    workbook: ExcelJS.Workbook,
    worksheet: ExcelJS.Worksheet,
    totalCols: number,
    logoPath?: string,
  ) {
    if (!logoPath) return
    try {
      const res = await fetch(logoPath)
      const blob = await res.blob()
      const buffer = await blob.arrayBuffer()

      const ext =
        logoPath.toLowerCase().endsWith(".jpg") || logoPath.toLowerCase().endsWith(".jpeg") ? "jpeg" : "png"

      // En navegadores, exceljs acepta Uint8Array como "buffer"
      const imageId = workbook.addImage({
        buffer: new Uint8Array(buffer) as any,
        extension: ext as "png" | "jpeg",
      })

      // centramos en 3 columnas
      const span = 3
      const startCol = Math.max(1, Math.floor(totalCols / 2) - Math.floor(span / 2))
      const endCol = startCol + span - 1
      const from = `${colLetter(startCol)}1`
      const to = `${colLetter(endCol)}3`

      worksheet.addImage(imageId, `${from}:${to}`)

      // Alturas para respirar
      worksheet.getRow(1).height = 40
      worksheet.getRow(2).height = 28
      worksheet.getRow(3).height = 18
    } catch (e) {
      console.warn("[excel] No se pudo cargar el logo:", e)
    }
  }

  /** Crea el libro con estilo y branding Agroptimum */
  private static async createStyledWorkbook(options: ExcelExportOptions): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(options.sheetName)

    // Branding
    workbook.creator = "Agroptimum"
    workbook.lastModifiedBy = "Agroptimum – Sistema de Gestión"
    workbook.created = new Date()
    workbook.modified = new Date()

    // Layout
    worksheet.properties.defaultRowHeight = 18
    worksheet.pageSetup = { margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.4 } }

    // ==== CABECERA ====
    const totalCols = Math.max(options.headers.length, 8) // mínimo cómodo para centrar
    await this.addLogo(workbook, worksheet, totalCols, options.logoPath)

    // Título
    let currentRow = 4 // filas 1–3 reservadas al logo
    const titleCell = worksheet.getCell(`A${currentRow}`)
    titleCell.value = options.title
    titleCell.font = { name: "Arial", size: 18, bold: true, color: { argb: TEXT_DARK } }
    titleCell.alignment = { horizontal: "center", vertical: "middle" }
    worksheet.mergeCells(`A${currentRow}:${colLetter(totalCols)}${currentRow}`)
    worksheet.getRow(currentRow).height = 30
    currentRow += 1

    // Subtítulo (opcional)
    if (options.subtitle) {
      const subtitleCell = worksheet.getCell(`A${currentRow}`)
      subtitleCell.value = options.subtitle
      subtitleCell.font = { name: "Arial", size: 12, bold: true, color: { argb: TEXT_MID } }
      subtitleCell.alignment = { horizontal: "center", vertical: "middle" }
      worksheet.mergeCells(`A${currentRow}:${colLetter(totalCols)}${currentRow}`)
      worksheet.getRow(currentRow).height = 20
      currentRow += 1
    }

    // Fecha de generación
    const now = new Date()
    const months = [
      "enero","febrero","marzo","abril","mayo","junio",
      "julio","agosto","septiembre","octubre","noviembre","diciembre",
    ]
    const generatedDate = `Generado el ${now.getDate()} de ${months[now.getMonth()]} de ${now.getFullYear()} a las ${now
      .getHours()
      .toString()
      .padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`

    const dateCell = worksheet.getCell(`A${currentRow}`)
    dateCell.value = generatedDate
    dateCell.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF6B7280" } }
    dateCell.alignment = { horizontal: "center", vertical: "middle" }
    worksheet.mergeCells(`A${currentRow}:${colLetter(totalCols)}${currentRow}`)
    currentRow += 2

    // ==== ENCABEZADOS (verde Agroptimum) ====
    const headerRow = worksheet.getRow(currentRow)
    options.headers.forEach((header, i) => {
      const cell = headerRow.getCell(i + 1)
      cell.value = header
      cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } }
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AGRO_GREEN } }
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
      cell.border = {
        top: { style: "thin", color: { argb: BORDER_SOFT } },
        left: { style: "thin", color: { argb: BORDER_SOFT } },
        bottom: { style: "thin", color: { argb: BORDER_SOFT } },
        right: { style: "thin", color: { argb: BORDER_SOFT } },
      }
    })
    headerRow.height = 26
    currentRow += 1

    // ==== DATOS (zebra + bordes suaves) ====
    options.data.forEach((row, r) => {
      const dataRow = worksheet.getRow(currentRow + r)
      row.forEach((val: any, c: number) => {
        const cell = dataRow.getCell(c + 1)
        cell.value = val
        cell.font = { name: "Arial", size: 10, color: { argb: TEXT_MID } }
        cell.alignment = { horizontal: "center", vertical: "middle" }

        if (r % 2 === 0) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AGRO_GREEN_LIGHT } }
        }

        cell.border = {
          top: { style: "thin", color: { argb: BORDER_SOFT } },
          left: { style: "thin", color: { argb: BORDER_SOFT } },
          bottom: { style: "thin", color: { argb: BORDER_SOFT } },
          right: { style: "thin", color: { argb: BORDER_SOFT } },
        }
      })
      dataRow.height = 20
    })

    // Anchura de columnas
    options.headers.forEach((h, i) => {
      const col = worksheet.getColumn(i + 1)
      if (h.toLowerCase().includes("fecha")) col.width = 14
      else if (/(hora|entrada|salida)/i.test(h)) col.width = 10
      else if (/(empleado|nombre)/i.test(h)) col.width = 28
      else if (/email/i.test(h)) col.width = 34
      else if (/(departamento|posición|puesto)/i.test(h)) col.width = 20
      else if (/(salario|total)/i.test(h)) col.width = 16
      else col.width = 16
    })

    // Congelar encabezados
    worksheet.views = [{ state: "frozen", ySplit: currentRow - 1 }]

    return workbook
  }

  // ==== Exportadores base ====
  static async exportToXLSX(options: ExcelExportOptions): Promise<void> {
    try {
      const workbook = await this.createStyledWorkbook(options)
      const stamp = new Date()
        .toISOString()
        .slice(0, 16)
        .replace(/[-:T]/g, "")
        .slice(0, 12)

      const fileName = `${options.filename}_${stamp}.xlsx`
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("[excel] Error generating Excel, fallback CSV:", error)
      this.exportToCSV(options)
    }
  }

  private static exportToCSV(options: ExcelExportOptions): void {
    const csvContent = [
      [options.title],
      options.subtitle ? [options.subtitle] : [],
      [`Generado el ${new Date().toLocaleString("es-ES")}`],
      [],
      options.headers,
      ...options.data,
    ]
      .filter((r) => r.length > 0)
      .map((r) => r.map((c) => `"${c}"`).join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const fileName = `${options.filename}_${new Date().toISOString().slice(0, 10)}.csv`
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  // ==== Reporte: Horas extra (Agroptimum) ====
  static exportOvertimeReport(employeeReports: any[], selectedDate: Date, selectedEmployee: string, payrollSettings: any): void {
    const data = employeeReports.flatMap((report) =>
      report.sessions.map((session: any) => {
        const dIn = new Date(session.entrada)
        const dOut = new Date(session.salida)
        const f = (d: Date) =>
          `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`
        const t = (d: Date) => `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
        return [
          report.employeeName,
          f(dIn),
          t(dIn),
          t(dOut),
          session.totalHours.toFixed(2),
          session.regularHours.toFixed(2),
          session.extraHours.toFixed(2),
          session.weekendHours.toFixed(2),
          session.nightHours.toFixed(2),
          (
            session.regularHours * payrollSettings.regularHourRate +
            session.extraHours * payrollSettings.regularHourRate * payrollSettings.extraHourMultiplier +
            session.weekendHours * payrollSettings.regularHourRate * payrollSettings.weekendMultiplier +
            session.nightHours * payrollSettings.regularHourRate * payrollSettings.nightMultiplier
          ).toFixed(2) + "€",
        ]
      }),
    )

    const headers = [
      "Empleado","Fecha","Entrada","Salida","Horas Totales","Horas Regulares","Horas Extras","Horas Fin de Semana","Horas Nocturnas","Salario Total",
    ]

    const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
    const employeeName =
      selectedEmployee === "all"
        ? "Todos los empleados"
        : employeeReports.find((r) => r.employeeId === selectedEmployee)?.employeeName || "Empleado"
    const subtitle = `${employeeName} - ${months[selectedDate.getMonth()]} de ${selectedDate.getFullYear()}`

    this.exportToXLSX({
      filename: "reporte_horas_extras",
      sheetName: "Horas Extras",
      title: "REPORTE DE HORAS EXTRAS - AGROPTIMUM",
      subtitle,
      data,
      headers,
      logoPath: "/images/agroptimum-logo.png",
    })
  }

  // ==== Reporte: Empleados (toda la info conocida) ====
  static exportEmployeesReport(employees: any[]): void {
    const fmtDate = (d?: Date | string) => {
      if (!d) return "N/A"
      const date = typeof d === "string" ? new Date(d) : d
      return isNaN(date.getTime())
        ? "N/A"
        : `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1)
            .toString()
            .padStart(2, "0")}/${date.getFullYear()}`
    }

    const data = employees.map((e) => {
      const empleadoId   = e.empleadoId ?? e.employeeId ?? e.id ?? ""
      const nombre       = e.nombre ?? e.name ?? ""
      const email        = e.email ?? ""
      const telefono     = e.telefono ?? e.phone ?? "N/A"
      const departamento = e.departamento ?? e.department ?? "N/A"
      const puesto       = e.puesto ?? e.position ?? "N/A"
      const fechaAlta    = fmtDate(e.fechaAlta ?? e.hireDate)
      const salario      = e.salario ?? e.salary
      const direccion    = e.direccion ?? e.address ?? "N/A"
      const estado       = e.estado ?? e.status ?? "Activo"

      return [
        empleadoId,
        nombre,
        email,
        telefono,
        departamento,
        puesto,
        fechaAlta,
        salario ? `${salario}€` : "N/A",
        direccion,
        estado,
      ]
    })

    const headers = [
      "ID Empleado","Nombre Completo","Email","Teléfono","Departamento","Posición","Fecha Contratación","Salario Anual","Dirección","Estado",
    ]

    this.exportToXLSX({
      filename: "empleados",
      sheetName: "Empleados",
      title: "LISTADO DE EMPLEADOS - AGROPTIMUM",
      subtitle: `Total de empleados: ${employees.length}`,
      data,
      headers,
      logoPath: "/images/agroptimum-logo.png",
    })
  }

  // ==== Reporte: Fichajes (branding Agroptimum) ====
  static exportTimeEntriesReport(timeEntries: any[]): void {
    const data = timeEntries.map((entry) => {
      const ts = new Date(entry.timestamp)
      const fd = `${ts.getDate().toString().padStart(2,"0")}/${(ts.getMonth()+1).toString().padStart(2,"0")}/${ts.getFullYear()}`
      const ft = `${ts.getHours().toString().padStart(2,"0")}:${ts.getMinutes().toString().padStart(2,"0")}:${ts.getSeconds().toString().padStart(2,"0")}`
      return [
        entry.employeeName,
        entry.employeeId,
        fd,
        ft,
        entry.type === "entrada" ? "Entrada" : "Salida",
        entry.location?.address || "N/A",
      ]
    })

    const headers = ["Empleado","ID Empleado","Fecha","Hora","Tipo","Ubicación"]

    const now = new Date()
    const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
    const subtitle = `Registros del ${now.getDate()} de ${months[now.getMonth()]} de ${now.getFullYear()}`

    this.exportToXLSX({
      filename: "fichajes",
      sheetName: "Fichajes",
      title: "REGISTRO DE FICHAJES - AGROPTIMUM",
      subtitle,
      data,
      headers,
      logoPath: "/images/AG Cuadrado (2).png", // o tu logo redondo
    })
  }
}
