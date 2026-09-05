import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '../../../../../utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SPREADSHEET_ID_PRUEBA = '1zVmiFIvTx9FlAuijQd_3QndOOR4Sui7iQTiOBvoVvTA'
const HOJA_PRUEBA = 'Precios_Planes_Claro'

type Producto = {
  producto: string
  origen: string
  plan: string
  precio_lista: number | null
  descuento_normal: number | null
  activo: boolean
}

function normalizar(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/GIGAS/g, 'GB')
    .replace(/MB/g, 'M')
}

function googleSheetsClient() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON

  if (json) {
    let credentials: Record<string, unknown>
    try {
      credentials = JSON.parse(json)
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON no contiene un JSON válido.')
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })
    return google.sheets({ version: 'v4', auth })
  }

  const keyFile =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    '/Users/oscarcanderle/Downloads/cotizador-claro-489714-b4400a0716ca.json'

  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

  return google.sheets({ version: 'v4', auth })
}

function buscarProducto(
  productos: Producto[],
  predicate: (p: Producto) => boolean,
  etiqueta: string
) {
  const encontrado = productos.find((p) => p.activo && predicate(p))
  if (!encontrado) {
    throw new Error(`No se encontró un producto activo para ${etiqueta}.`)
  }
  return encontrado
}

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('rol, activo')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !profile.activo || profile.rol !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Solo un usuario ADMIN puede sincronizar la Lista de Precios.' },
        { status: 403 }
      )
    }

    const { data: productosData, error: productosError } = await supabase
      .from('productos')
      .select('producto, origen, plan, precio_lista, descuento_normal, activo')
      .eq('activo', true)

    if (productosError) throw new Error(productosError.message)

    const { data: reglasData, error: reglasError } = await supabase
      .from('reglas_comerciales')
      .select('codigo, valor, activo')
      .in('codigo', ['CONVERGENCIA_2', 'CONVERGENCIA_3'])
      .eq('activo', true)

    if (reglasError) throw new Error(reglasError.message)

    const productos = (productosData ?? []) as Producto[]
    const reglas = reglasData ?? []

    const planesMoviles = ['2GB', '4GB', '7GB', '10GB', '30GB', '50GB']

    // E2:E25 conserva el orden histórico:
    // MOVISTAR (6), PERSONAL (6), TUENTI (6), LINEA NUEVA (6).
    const descuentos: number[][] = []
    for (const origen of ['MOVISTAR', 'PERSONAL', 'TUENTI']) {
      for (const plan of planesMoviles) {
        const p = buscarProducto(
          productos,
          (x) =>
            x.producto === 'PORTABILIDAD' &&
            x.origen === origen &&
            normalizar(x.plan) === plan,
          `${origen} ${plan}`
        )
        descuentos.push([Number(p.descuento_normal ?? 0)])
      }
    }

    for (const plan of planesMoviles) {
      const p = buscarProducto(
        productos,
        (x) =>
          x.producto === 'LINEA NUEVA' &&
          x.origen === 'LINEA NUEVA' &&
          normalizar(x.plan) === plan,
        `LÍNEA NUEVA ${plan}`
      )
      descuentos.push([Number(p.descuento_normal ?? 0)])
    }

    const precios: Array<[string, number]> = []

    // 1-6: planes móviles. El precio de lista es común; usamos MOVISTAR como referencia.
    for (const plan of planesMoviles) {
      const p = buscarProducto(
        productos,
        (x) =>
          x.producto === 'PORTABILIDAD' &&
          x.origen === 'MOVISTAR' &&
          normalizar(x.plan) === plan,
        `precio móvil ${plan}`
      )
      precios.push([plan, Number(p.precio_lista ?? 0)])
    }

    // 7-9: Internet.
    for (const [planSheet, planDb] of [
      ['200M', '200M'],
      ['500M', '500M'],
      ['800M', '800M'],
    ] as const) {
      const p = buscarProducto(
        productos,
        (x) =>
          x.producto === 'Internet Fibra optica' &&
          x.origen === 'BAF' &&
          normalizar(x.plan) === planDb,
        `Internet ${planSheet}`
      )
      precios.push([planSheet, Number(p.precio_lista ?? 0)])
    }

    // 10: IPTV.
    const tv = buscarProducto(
      productos,
      (x) => x.producto === 'CLARO TV',
      'TVHD'
    )
    precios.push(['TVHD', Number(tv.precio_lista ?? 0)])

    // 11: Deco adicional.
    const deco = buscarProducto(
      productos,
      (x) => x.producto === 'DECODIFICADOR TV ADICIONAL',
      'DECO ADIC'
    )
    precios.push(['DECO ADIC', Number(deco.precio_lista ?? 0)])

    // 12-15: Packs TV.
    for (const nombre of ['FUTBOL', 'MAX', 'ADULT', 'UNIVERSAL']) {
      const p = buscarProducto(
        productos,
        (x) => x.producto === 'PACK TV' && normalizar(x.plan) === normalizar(nombre),
        `Pack TV ${nombre}`
      )
      precios.push([nombre, Number(p.precio_lista ?? 0)])
    }

    // 16-17: Packs de datos.
    for (const [etiqueta, plan] of [
      ['PACK 10GB', '10GB'],
      ['PACK 15GB', '15GB'],
    ] as const) {
      const p = buscarProducto(
        productos,
        (x) => x.producto === 'PACK DATOS' && normalizar(x.plan) === plan,
        etiqueta
      )
      precios.push([etiqueta, Number(p.precio_lista ?? 0)])
    }

    // 18-19: reglas comerciales, sin duplicarlas en productos.
    const convergencia2 = reglas.find((r) => r.codigo === 'CONVERGENCIA_2')
    const convergencia3 = reglas.find((r) => r.codigo === 'CONVERGENCIA_3')

    if (!convergencia2 || !convergencia3) {
      throw new Error('No se encontraron activas las reglas CONVERGENCIA_2 y CONVERGENCIA_3.')
    }

    precios.push(['CONVERG1', Number(convergencia2.valor ?? 0)])
    precios.push(['CONVERG2', Number(convergencia3.valor ?? 0)])

    if (descuentos.length !== 24) {
      throw new Error(`Se esperaban 24 descuentos y se generaron ${descuentos.length}.`)
    }
    if (precios.length !== 19) {
      throw new Error(`Se esperaban 19 precios y se generaron ${precios.length}.`)
    }

    const sheets = googleSheetsClient()

    // Prueba deliberadamente aislada: SOLO este Spreadsheet y SOLO la hoja Price.
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID_PRUEBA,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: `${HOJA_PRUEBA}!E2:E25`,
            majorDimension: 'ROWS',
            values: descuentos,
          },
          {
            range: `${HOJA_PRUEBA}!H2:I20`,
            majorDimension: 'ROWS',
            values: precios,
          },
        ],
      },
    })

    return NextResponse.json({
      ok: true,
      message: 'Google Sheets sincronizado correctamente.',
      spreadsheetId: SPREADSHEET_ID_PRUEBA,
      hoja: HOJA_PRUEBA,
      rangos: [`${HOJA_PRUEBA}!E2:E25`, `${HOJA_PRUEBA}!H2:I20`],
      descuentosEscritos: descuentos.length,
      preciosEscritos: precios.length,
    })
  } catch (error) {
    console.error('Error sincronizando Lista de Precios con Google Sheets:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Error inesperado al sincronizar Google Sheets.',
      },
      { status: 500 }
    )
  }
}
