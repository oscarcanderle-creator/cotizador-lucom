import JSZip from 'jszip'

export type CeldaClaro = string

export type HojaClaro = {
  filas: CeldaClaro[][]
  cantidadFilas: number
  cantidadColumnas: number
}

function decodificarXml(valor: string): string {
  return valor
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function extraerTextoInline(contenido: string): string {
  const textos = [
    ...contenido.matchAll(
      /<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g,
    ),
  ]

  return textos.map((match) => decodificarXml(match[1])).join('')
}

function extraerValor(contenido: string): string {
  const match = contenido.match(
    /<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/,
  )

  return match ? decodificarXml(match[1]) : ''
}

async function leerSharedStrings(zip: JSZip): Promise<string[]> {
  const archivo = zip.file('xl/sharedStrings.xml')

  if (!archivo) {
    return []
  }

  const xml = await archivo.async('string')

  const elementos = [
    ...xml.matchAll(
      /<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g,
    ),
  ]

  return elementos.map((elemento) =>
    extraerTextoInline(elemento[1] ?? ''),
  )
}

export async function leerXlsxClaro(
  buffer: ArrayBuffer | Buffer,
): Promise<HojaClaro> {
  const zip = await JSZip.loadAsync(buffer)

  const archivoHoja = zip.file('xl/worksheets/sheet1.xml')

  if (!archivoHoja) {
    throw new Error('El archivo no contiene una hoja de datos compatible.')
  }

  const sharedStrings = await leerSharedStrings(zip)
  const xml = await archivoHoja.async('string')

  const filasXml = [
    ...xml.matchAll(
      /<(?:\w+:)?row\b[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g,
    ),
  ]

  let cantidadColumnas = 0

  const filas = filasXml.map((filaMatch) => {
    const contenidoFila = filaMatch[1]

    const celdas = [
      ...contenidoFila.matchAll(
        /<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g,
      ),
    ]

    const fila = celdas.map((celdaMatch) => {
      const atributos = celdaMatch[1] ?? ''
      const contenido = celdaMatch[2] ?? ''

      if (!contenido) {
        return ''
      }

      if (/\bt="inlineStr"/.test(atributos)) {
        return extraerTextoInline(contenido)
      }

      const valor = extraerValor(contenido)

      if (/\bt="s"/.test(atributos)) {
        const indice = Number(valor)

        if (
          Number.isInteger(indice) &&
          indice >= 0 &&
          indice < sharedStrings.length
        ) {
          return sharedStrings[indice]
        }

        return ''
      }

      return valor
    })

    if (fila.length > cantidadColumnas) {
      cantidadColumnas = fila.length
    }

    return fila
  })

  return {
    filas,
    cantidadFilas: filas.length,
    cantidadColumnas,
  }
}
