import ExcelJS from 'exceljs'

export const ENCABEZADOS_DISTRIBUCION_R3 = [
  'ID ITEC',
  'Nro POS',
  'Fecha 1° Carga',
  'Fecha Activación',
  'Nro Serie',
  'NIM',
  'Monto 1° Carga',
  'Monto Total Mes',
  'Nombre PSR',
  'Dirección',
  'Altura',
  'Localidad',
  'Zona',
  'Caminante',
  'Rubro',
] as const

export const POS_DISTRIBUCION_R3: Record<string, string> = {
  '3512407226': 'PDV CHANGO MAS TALLERES',
  '3512071928': 'PDV DINO RODRIGUEZ DEL BUSTO',
  '3515141704': 'PDV HIPER LIBERTAD GRAL PAZ',
  '3512261836': 'PDV HIPER LIBERTAD LUUGONES',
  '3512018166': 'PDV LA CALERA',
  '3513454757': 'PDV PASEO RIVERA',
  '3493445796': 'PDV SUNCHALES SCHNELL',
  '3518090949': 'PDV VILLA ALLENDE SECULIN',
  '3518601632': 'PDV RIO CEBALLOS DIAZ',
  '3564338668': 'PDV SAN FRANCISCO BALDISARRI',
  '3564330909': 'PDV SAN FRANCISCO BOC-HO',
}

export type RegistroDistribucionR3 = {
  id_itec: string | null
  nro_pos: string
  fecha_primera_carga: string | null
  fecha_activacion: string | null
  nro_serie: string
  nim: string | null
  monto_primera_carga: number | null
  monto_total_mes: number | null
  nombre_psr: string
  direccion: string | null
  altura: string | null
  localidad: string | null
  zona: string | null
  caminante: string | null
  rubro: string
  periodo: string
}

export type ResultadoLecturaDistribucionR3 = {
  periodo: string
  totalFilas: number
  seleccionados: number
  descartados: number
  registros: RegistroDistribucionR3[]
  posDesconocidos: { nroPos: string; cantidad: number }[]
  seriesDuplicadas: string[]
  filasSinSerie: number[]
}

function texto(celda: ExcelJS.Cell): string {
  const valor = celda.value
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'object' && !(valor instanceof Date)) {
    if ('result' in valor && valor.result != null) return String(valor.result).trim()
    if ('text' in valor && typeof valor.text === 'string') return valor.text.trim()
  }
  return celda.text.trim()
}

function opcional(valor: string): string | null {
  return valor || null
}

function fecha(celda: ExcelJS.Cell, numeroFila: number, date1904: boolean): string | null {
  const valor = celda.value
  if (valor === null || valor === undefined || valor === '') return null

  let anio: number
  let mes: number
  let dia: number

  if (valor instanceof Date) {
    anio = valor.getUTCFullYear()
    mes = valor.getUTCMonth() + 1
    dia = valor.getUTCDate()
  } else if (typeof valor === 'number') {
    const base = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30)
    const fechaExcel = new Date(base + Math.floor(valor) * 86400000)
    anio = fechaExcel.getUTCFullYear()
    mes = fechaExcel.getUTCMonth() + 1
    dia = fechaExcel.getUTCDate()
  } else {
    const cadena = texto(celda)
    const dmy = cadena.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
    const iso = cadena.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (dmy) {
      anio = Number(dmy[3]); mes = Number(dmy[2]); dia = Number(dmy[1])
    } else if (iso) {
      anio = Number(iso[1]); mes = Number(iso[2]); dia = Number(iso[3])
    } else {
      throw new Error(`Fecha no reconocida en fila ${numeroFila}: ${cadena}`)
    }
  }

  const comprobacion = new Date(Date.UTC(anio, mes - 1, dia))
  if (
    !Number.isFinite(comprobacion.getTime()) ||
    comprobacion.getUTCFullYear() !== anio ||
    comprobacion.getUTCMonth() + 1 !== mes ||
    comprobacion.getUTCDate() !== dia
  ) {
    throw new Error(`Fecha inválida en fila ${numeroFila}, columna ${celda.col}`)
  }
  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

function monto(celda: ExcelJS.Cell, numeroFila: number): number | null {
  const valor = celda.value
  if (valor === null || valor === undefined || valor === '') return null
  let numero: number
  if (typeof valor === 'number') {
    numero = valor
  } else {
    let cadena = texto(celda).replace(/\s/g, '').replace(/\$/g, '')
    if (cadena.includes(',') && cadena.includes('.')) {
      cadena = cadena.lastIndexOf(',') > cadena.lastIndexOf('.')
        ? cadena.replace(/\./g, '').replace(',', '.')
        : cadena.replace(/,/g, '')
    } else if (cadena.includes(',')) {
      cadena = cadena.replace(',', '.')
    }
    numero = Number(cadena)
  }
  if (!Number.isFinite(numero)) {
    throw new Error(`Monto inválido en fila ${numeroFila}: ${texto(celda)}`)
  }
  return numero
}

function obtenerPeriodo(nombreArchivo: string): string {
  const coincidencia = nombreArchivo.match(
    /_(\d{4})-(\d{2})-(\d{2})_(\d{4})-(\d{2})-(\d{2})(?:\s*\(\d+\))?\.xlsx$/i,
  )
  if (!coincidencia) {
    throw new Error('No se pudo identificar el período en el nombre del archivo.')
  }
  const [, anioInicio, mesInicio, , anioFin, mesFin] = coincidencia
  if (
    anioInicio !== anioFin || mesInicio !== mesFin ||
    Number(mesInicio) < 1 || Number(mesInicio) > 12
  ) {
    throw new Error('El archivo debe corresponder a un único mes.')
  }
  return `${anioInicio}${mesInicio}`
}

export async function leerXlsxDistribucionR3(
  buffer: ArrayBuffer | Buffer,
  nombreArchivo: string,
): Promise<ResultadoLecturaDistribucionR3> {
  const periodo = obtenerPeriodo(nombreArchivo)
  const libro = new ExcelJS.Workbook()
  await libro.xlsx.load(Buffer.from(new Uint8Array(buffer)) as any)
  const hoja = libro.getWorksheet('ICB Primera Carga')
  if (!hoja) throw new Error('No se encontró la hoja ICB Primera Carga.')

  const encabezados = ENCABEZADOS_DISTRIBUCION_R3.map(
    (_, indice) => texto(hoja.getRow(1).getCell(indice + 1)),
  )
  if (
    hoja.getRow(1).cellCount !== ENCABEZADOS_DISTRIBUCION_R3.length ||
    encabezados.some((valor, indice) => valor !== ENCABEZADOS_DISTRIBUCION_R3[indice])
  ) {
    throw new Error('Los encabezados no coinciden con Distribución R3.')
  }

  const registros: RegistroDistribucionR3[] = []
  const desconocidos = new Map<string, number>()
  const series = new Set<string>()
  const duplicadas = new Set<string>()
  const filasSinSerie: number[] = []
  let totalFilas = 0
  const date1904 = libro.properties.date1904 === true

  hoja.eachRow((fila, numero) => {
    if (numero === 1) return
    const tieneDatos = Array.from({ length: 15 }, (_, indice) =>
      texto(fila.getCell(indice + 1)),
    ).some(Boolean)
    if (!tieneDatos) return
    totalFilas++

    const rubro = texto(fila.getCell(15))
    if (rubro !== 'Local Claro Exclusivo') return

    const nroPos = texto(fila.getCell(2))
    const nroSerie = texto(fila.getCell(5))
    const nombrePsr = POS_DISTRIBUCION_R3[nroPos] ?? 'ALERTA!'
    if (nombrePsr === 'ALERTA!') {
      desconocidos.set(nroPos, (desconocidos.get(nroPos) ?? 0) + 1)
    }
    if (!nroSerie) filasSinSerie.push(numero)
    else if (series.has(nroSerie)) duplicadas.add(nroSerie)
    else series.add(nroSerie)

    registros.push({
      id_itec: opcional(texto(fila.getCell(1))),
      nro_pos: nroPos,
      fecha_primera_carga: fecha(fila.getCell(3), numero, date1904),
      fecha_activacion: fecha(fila.getCell(4), numero, date1904),
      nro_serie: nroSerie,
      nim: opcional(texto(fila.getCell(6))),
      monto_primera_carga: monto(fila.getCell(7), numero),
      monto_total_mes: monto(fila.getCell(8), numero),
      nombre_psr: nombrePsr,
      direccion: opcional(texto(fila.getCell(10))),
      altura: opcional(texto(fila.getCell(11))),
      localidad: opcional(texto(fila.getCell(12))),
      zona: opcional(texto(fila.getCell(13))),
      caminante: opcional(texto(fila.getCell(14))),
      rubro,
      periodo,
    })
  })

  return {
    periodo,
    totalFilas,
    seleccionados: registros.length,
    descartados: totalFilas - registros.length,
    registros,
    posDesconocidos: [...desconocidos].map(([nroPos, cantidad]) => ({ nroPos, cantidad })),
    seriesDuplicadas: [...duplicadas],
    filasSinSerie,
  }
}
