export type HojaCsvClaro = {
  filas: string[][]
  cantidadFilas: number
  cantidadColumnas: number
}

function parsearLineaCsv(
  linea: string,
  separador = ';',
): string[] {
  const valores: string[] = []
  let actual = ''
  let entreComillas = false

  for (let i = 0; i < linea.length; i += 1) {
    const caracter = linea[i]

    if (caracter === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"'
        i += 1
      } else {
        entreComillas = !entreComillas
      }

      continue
    }

    if (caracter === separador && !entreComillas) {
      valores.push(actual)
      actual = ''
      continue
    }

    actual += caracter
  }

  if (entreComillas) {
    throw new Error(
      'El archivo CSV contiene una línea con comillas sin cerrar.',
    )
  }

  valores.push(actual)

  return valores
}

export async function leerCsvClaro(
  buffer: ArrayBuffer,
): Promise<HojaCsvClaro> {
  /*
   * Los archivos PsrAgencia / ITEC descargados de Claro
   * utilizan ISO-8859-1 y separador punto y coma.
   */
  const decoder = new TextDecoder('iso-8859-1')
  let texto = decoder.decode(buffer)

  // Normalizamos saltos de línea.
  texto = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  const lineas = texto.split('\n')

  // Excel/Claro agrega "sep=;" como primera línea.
  if (lineas[0]?.trim().toLowerCase() === 'sep=;') {
    lineas.shift()
  }

  // Eliminamos únicamente líneas completamente vacías.
  const lineasConContenido = lineas.filter(
    (linea) => linea.trim() !== '',
  )

  if (lineasConContenido.length === 0) {
    return {
      filas: [],
      cantidadFilas: 0,
      cantidadColumnas: 0,
    }
  }

  const filas = lineasConContenido.map((linea) =>
    parsearLineaCsv(linea, ';'),
  )

  const cantidadColumnas = Math.max(
    ...filas.map((fila) => fila.length),
  )

  return {
    filas,
    cantidadFilas: filas.length,
    cantidadColumnas,
  }
}
