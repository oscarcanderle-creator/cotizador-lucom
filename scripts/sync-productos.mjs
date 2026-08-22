import { google } from 'googleapis'
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const {
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SECRET_KEY,
  GOOGLE_APPLICATION_CREDENTIALS,
  GOOGLE_SHEETS_SPREADSHEET_ID,
  GOOGLE_SHEETS_RANGE,
  GOOGLE_SHEETS_PRICE_RANGE,
} = process.env

if (
  !NEXT_PUBLIC_SUPABASE_URL ||
  !SUPABASE_SECRET_KEY ||
  !GOOGLE_APPLICATION_CREDENTIALS ||
  !GOOGLE_SHEETS_SPREADSHEET_ID ||
  !GOOGLE_SHEETS_RANGE ||
  !GOOGLE_SHEETS_PRICE_RANGE
) {
  throw new Error('Faltan variables en .env.local')
}

const credentials = JSON.parse(
  fs.readFileSync(
    GOOGLE_APPLICATION_CREDENTIALS,
    'utf8'
  )
)

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
  ],
})

const sheets = google.sheets({
  version: 'v4',
  auth,
})

const supabase = createClient(
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SECRET_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
)

function numero(valor) {
  if (
    valor === undefined ||
    valor === null ||
    valor === ''
  ) {
    return null
  }

  const limpio = String(valor)
    .replace(/\./g, '')
    .replace(',', '.')
    .trim()

  const resultado = Number(limpio)

  return Number.isFinite(resultado)
    ? resultado
    : null
}

function texto(valor) {
  if (
    valor === undefined ||
    valor === null
  ) {
    return null
  }

  const resultado =
    String(valor).trim()

  return resultado === ''
    ? null
    : resultado
}

async function leerProductosNormales() {
  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId:
        GOOGLE_SHEETS_SPREADSHEET_ID,

      range:
        GOOGLE_SHEETS_RANGE,
    })

  const rows =
    response.data.values || []

  if (rows.length <= 1) {
    throw new Error(
      'La hoja no contiene productos'
    )
  }

  const datos =
    rows.slice(1)

  return datos
    .map((row, index) => {
      const [
        producto,
        origen,
        plan,
        precioLista,
        descuento,
        precioCliente,
        beneficios,
      ] = row

      return {
        producto:
          texto(producto),

        origen:
          texto(origen),

        plan:
          texto(plan),

        precio_lista:
          numero(precioLista) ?? 0,

        descuento_normal:
          numero(descuento),

        precio_cliente:
          numero(precioCliente),

        beneficios:
          texto(beneficios),

        activo: true,

        fila_origen:
          index + 2,

        fecha_sincronizacion:
          new Date().toISOString(),

        updated_at:
          new Date().toISOString(),
      }
    })
    .filter((item) => {
      if (
        !item.producto ||
        !item.plan
      ) {
        return false
      }

      if (
        item.producto
          .toUpperCase() ===
        'COMBO'
      ) {
        return false
      }

      return true
    })
}

async function leerPacksDatos() {
  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId:
        GOOGLE_SHEETS_SPREADSHEET_ID,

      range:
        GOOGLE_SHEETS_PRICE_RANGE,
    })

  const rows =
    response.data.values || []

  const ahora =
    new Date().toISOString()

  const packs = []

  for (const row of rows) {
    const nombre =
      texto(row[0])

    const precio =
      numero(row[1])

    if (
      !nombre ||
      precio === null
    ) {
      continue
    }

    const clave =
      nombre
        .toUpperCase()
        .replace(/\s+/g, '')

    if (clave === 'PACK10GB') {
      packs.push({
        producto:
          'PACK DATOS',

        origen:
          'PACK',

        plan:
          '10 GB',

        precio_lista:
          precio,

        descuento_normal:
          null,

        precio_cliente:
          precio,

        beneficios:
          'Autogestión',

        activo:
          true,

        fila_origen:
          null,

        fecha_sincronizacion:
          ahora,

        updated_at:
          ahora,
      })
    }

    if (clave === 'PACK15GB') {
      packs.push({
        producto:
          'PACK DATOS',

        origen:
          'PACK',

        plan:
          '15 GB',

        precio_lista:
          precio,

        descuento_normal:
          null,

        precio_cliente:
          precio,

        beneficios:
          'Autogestión',

        activo:
          true,

        fila_origen:
          null,

        fecha_sincronizacion:
          ahora,

        updated_at:
          ahora,
      })
    }
  }

  return packs
}

async function sincronizar() {
  console.log(
    'Leyendo Google Sheets...'
  )

  const productosNormales =
    await leerProductosNormales()

  const packsDatos =
    await leerPacksDatos()

  const productos = [
    ...productosNormales,
    ...packsDatos,
  ]

  console.log(
    `Productos normales encontrados: ${productosNormales.length}`
  )

  console.log(
    `Packs de datos encontrados: ${packsDatos.length}`
  )

  console.log(
    `Total a sincronizar: ${productos.length}`
  )

  const { data, error } =
    await supabase
      .from('productos')
      .upsert(productos, {
        onConflict:
          'producto,origen,plan',
      })
      .select()

  if (error) {
    throw error
  }

  console.log(
    `Productos sincronizados: ${data.length}`
  )

  console.table(
    data.map((item) => ({
      producto:
        item.producto,

      origen:
        item.origen,

      plan:
        item.plan,

      precio:
        item.precio_lista,

      descuento:
        item.descuento_normal,
    }))
  )
}

sincronizar()
  .then(() => {
    console.log(
      'Sincronización terminada correctamente.'
    )
  })
  .catch((error) => {
    console.error(
      'ERROR DE SINCRONIZACIÓN:'
    )

    console.error(
      error.message
    )

    process.exit(1)
  })
