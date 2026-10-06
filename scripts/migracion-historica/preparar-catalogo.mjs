import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const CONFIRMAR = process.argv.includes('--confirmar')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY

if (!url || !key) {
  throw new Error(
    'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local'
  )
}

const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

const productosHistoricos = [
  // BAF históricos
  ['MASIVO', 'Internet Fibra optica', 'BAF', '100 MB'],
  ['PYME',   'Internet Fibra optica', 'BAF', '100 MB'],
  ['MASIVO', 'Internet Fibra optica', 'BAF', '300 MB'],
  ['MASIVO', 'Internet Fibra optica', 'BAF', '600 MB'],

  ['MASIVO', 'Internet BAFE', 'BAF', '100 MB BAFE'],
  ['MASIVO', 'Internet BAFE', 'BAF', '200 MB BAFE'],
  ['MASIVO', 'Internet BAFE', 'BAF', '300 MB BAFE'],
  ['MASIVO', 'Internet BAFE', 'BAF', '500 MB BAFE'],
  ['MASIVO', 'Internet BAFE', 'BAF', '800 MB BAFE'],

  ['MASIVO', 'AÑADIR TV', 'BAF', 'AÑADIR TV'],
  ['PYME',   'AÑADIR TV', 'BAF', 'AÑADIR TV'],

  // Plan móvil histórico 20 GB
  ['MASIVO', 'LINEA NUEVA', 'LINEA NUEVA', '20 Gigas'],
  ['MASIVO', 'PORTABILIDAD', 'MOVISTAR', '20 Gigas'],
  ['MASIVO', 'PORTABILIDAD', 'PERSONAL', '20 Gigas'],
  ['PYME',   'PORTABILIDAD', 'MOVISTAR', '20 Gigas'],

  // Productos técnicos para registros históricos incompletos.
  // No representan ofertas comerciales y permanecen inactivos.
  ['MASIVO', 'PORTABILIDAD HISTORICA', 'SIN COMPANIA', 'SIN PLAN HISTORICO'],
  ['MASIVO', 'PORTABILIDAD HISTORICA', 'SIN COMPANIA', 'PLAN HISTORICO'],
  ['MASIVO', 'LINEA NUEVA HISTORICA', 'LINEA NUEVA', 'SIN PLAN HISTORICO'],
].map(([negocio, producto, origen, plan]) => ({
  negocio,
  producto,
  origen,
  plan,
  precio_lista: 0,
  descuento_normal: 0,
  precio_cliente: 0,
  beneficios: 'PRODUCTO HISTORICO - NO COMERCIALIZAR',
  activo: false,
  catalogo_plan_id: null,
}))

async function main() {
  console.log('')
  console.log('==============================================')
  console.log(' PREPARACION CATALOGO HISTORICO PGL')
  console.log(
    CONFIRMAR
      ? ' MODO: CONFIRMAR ESCRITURA'
      : ' MODO: VISTA PREVIA - SIN ESCRITURAS'
  )
  console.log('==============================================')
  console.log('')

  const { data: existentes, error } = await supabase
    .from('productos')
    .select('id,negocio,producto,origen,plan,activo')

  if (error) throw error

  const clave = p =>
    `${p.negocio}|||${p.producto}|||${p.origen}|||${p.plan}`

  const mapaExistentes = new Map(
    existentes.map(p => [clave(p), p])
  )

  const crear = []
  const yaExisten = []

  for (const producto of productosHistoricos) {
    const existente = mapaExistentes.get(clave(producto))

    if (existente) {
      yaExisten.push(existente)
    } else {
      crear.push(producto)
    }
  }

  console.log(`Definidos: ${productosHistoricos.length}`)
  console.log(`Ya existentes: ${yaExisten.length}`)
  console.log(`A crear: ${crear.length}`)
  console.log('')

  if (yaExisten.length) {
    console.log('YA EXISTEN')
    console.table(yaExisten)
  }

  if (crear.length) {
    console.log('')
    console.log('A CREAR')
    console.table(
      crear.map(p => ({
        negocio: p.negocio,
        producto: p.producto,
        origen: p.origen,
        plan: p.plan,
      }))
    )
  }

  if (!CONFIRMAR) {
    console.log('')
    console.log('VISTA PREVIA FINALIZADA.')
    console.log('Escrituras realizadas en Supabase: 0')
    console.log('')
    console.log(
      'Para confirmar posteriormente: node scripts/migracion-historica/preparar-catalogo.mjs --confirmar'
    )
    return
  }

  if (!crear.length) {
    console.log('')
    console.log('No hay productos para crear.')
    console.log('El catálogo histórico ya está preparado.')
    return
  }

  const { data: insertados, error: errorInsert } = await supabase
    .from('productos')
    .insert(crear)
    .select('id,negocio,producto,origen,plan,activo')

  if (errorInsert) throw errorInsert

  console.log('')
  console.log('PRODUCTOS CREADOS')
  console.table(insertados)

  console.log('')
  console.log(`Productos creados: ${insertados.length}`)
  console.log('Catálogo histórico preparado correctamente.')
}

main().catch(error => {
  console.error('')
  console.error('ERROR PREPARANDO CATALOGO HISTORICO:')
  console.error(error)
  process.exit(1)
})
