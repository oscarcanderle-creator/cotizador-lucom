import ExcelJS from 'exceljs'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import path from 'node:path'

dotenv.config({ path: '.env.local' })

const {
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SECRET_KEY,
} = process.env

if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local')
}

const supabase = createClient(
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SECRET_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
)

function argumento(nombre) {
  const indice = process.argv.indexOf(nombre)
  if (indice === -1) return null

  const valor = process.argv[indice + 1]
  if (!valor || valor.startsWith('--')) {
    throw new Error(`Falta valor para ${nombre}`)
  }

  return valor
}

const ARCHIVO_BAF =
  argumento('--archivo-baf') ||
  '/Users/oscarcanderle/Downloads/VENTAS LUCOM.xlsx'

const ARCHIVO_MOVIL =
  argumento('--archivo-movil') ||
  '/Users/oscarcanderle/Downloads/Portabilidad Lucom.xlsx'

const NOMBRE_ARCHIVO_BAF = path.basename(ARCHIVO_BAF)
const NOMBRE_ARCHIVO_MOVIL = path.basename(ARCHIVO_MOVIL)

function texto(v) {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v
  if (typeof v === 'object') {
    if ('text' in v) return String(v.text ?? '').trim()
    if ('result' in v) return String(v.result ?? '').trim()
    if (Array.isArray(v.richText)) {
      return v.richText.map(x => x.text ?? '').join('').trim()
    }
  }
  return String(v).trim()
}

function normalizar(v) {
  return String(texto(v))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

function excelSerialAFecha(n) {
  if (!Number.isFinite(n) || n < 1 || n > 100000) return null
  const ms = Math.round((n - 25569) * 86400 * 1000)
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? null : d
}

function fechaReal(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v

  if (typeof v === 'number') {
    return excelSerialAFecha(v)
  }

  const s = String(texto(v)).trim()
  if (!s) return null

  if (/^\d+(\.\d+)?$/.test(s)) {
    const d = excelSerialAFecha(Number(s))
    if (d) return d
  }

  const limpioHistorico = s
    .toLowerCase()
    .replace('hs', '')
    .trim()

  const partesHistoricas = limpioHistorico.split(' ')

  if (partesHistoricas.length >= 1) {
    const fechaPartes = partesHistoricas[0].split('/')

    if (fechaPartes.length === 3) {
      const dd = Number(fechaPartes[0])
      const mm = Number(fechaPartes[1])
      const yyyy = Number(fechaPartes[2])

      let hh = 0
      let min = 0

      if (partesHistoricas[1]) {
        const horaPartes = partesHistoricas[1]
          .replace('.', ':')
          .split(':')

        hh = Number(horaPartes[0] || 0)
        min = Number(horaPartes[1] || 0)
      }

      if (
        Number.isInteger(dd) &&
        Number.isInteger(mm) &&
        Number.isInteger(yyyy) &&
        dd >= 1 && dd <= 31 &&
        mm >= 1 && mm <= 12 &&
        yyyy >= 1900 && yyyy <= 2100 &&
        hh >= 0 && hh <= 23 &&
        min >= 0 && min <= 59
      ) {
        const historica = new Date(
          yyyy,
          mm - 1,
          dd,
          hh,
          min
        )

        if (!Number.isNaN(historica.getTime())) {
          return historica
        }
      }
    }
  }

  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

function digitos(v) {
  return String(texto(v)).replace(/\D/g, '')
}

function tipoDocumento(v) {
  const d = digitos(v)
  if (d.length === 11) return 'CUIT'
  return 'DNI'
}

function negocioDocumento(v) {
  return digitos(v).length === 11 ? 'PYME' : 'MASIVO'
}

function gb(v) {
  const s = normalizar(v)
  if (!s) return null

  const m = s.match(/(?:^|\D)(2|4|7|10|20|30|50)\s*(?:GB|GIGA|GIGAS)?(?:\D|$)/)
  return m ? Number(m[1]) : null
}

function planNormalizado(n) {
  return n ? `${n} Gigas` : null
}

function clasificarMovil(row) {
  const spn = normalizar(row.getCell(20).value)
  const estado = normalizar(row.getCell(29).value)

  const compania = normalizar(row.getCell(11).value)

  if (
    spn === 'LINEA NUEVA' ||
    compania.includes('LINEA NUEVA') ||
    estado === 'LINEA NUEVA ACTIVA' ||
    estado === 'LINEA NUEVA ACTIVA S/LEGAJO' ||
    estado === 'LINEA NUEVA ACTIVA S LEGAJO'
  ) {
    return 'LINEA_NUEVA'
  }

  return 'PORTA'
}

function planMovil(row) {
  const plan = gb(row.getCell(18).value)
  const gigas = gb(row.getCell(10).value)

  if (plan) {
    return {
      gb: plan,
      origen: 'PLAN',
      diferencia: gigas !== null && gigas !== plan,
    }
  }

  if (gigas) {
    return {
      gb: gigas,
      origen: 'GIGAS',
      diferencia: false,
    }
  }

  return {
    gb: null,
    origen: null,
    diferencia: false,
  }
}

async function cargarExcel(path) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(path)
  const ws = wb.getWorksheet('Respuestas de formulario 1')
  if (!ws) throw new Error(`No se encontró la hoja esperada en ${path}`)
  return ws
}

async function cargarRegistrosHistoricosImportados() {
  const registros = []
  const tamanoPagina = 1000

  for (let desde = 0; ; desde += tamanoPagina) {
    const { data, error } = await supabase
      .from('migracion_historica_registros')
      .select('origen,fila_origen')
      .order('id', { ascending: true })
      .range(desde, desde + tamanoPagina - 1)

    if (error) {
      throw new Error(
        `Error consultando migracion_historica_registros: ${error.message}`
      )
    }

    const pagina = data ?? []
    registros.push(...pagina)

    if (pagina.length < tamanoPagina) break
  }

  return registros
}

async function cargarCatalogos() {
  const consultas = await Promise.all([
    supabase
      .from('productos')
      .select('id,producto,origen,plan,negocio,activo,catalogo_plan_id,precio_lista'),

    supabase
      .from('estados_baf')
      .select('id,codigo,nombre,activo'),

    supabase
      .from('estados_porta')
      .select('id,codigo,nombre,activo'),

    supabase
      .from('estados_bboo')
      .select('id,codigo,nombre,activo'),

    supabase
      .from('profiles')
      .select('id,nombre,rol,activo,vendedor'),

    supabase
      .from('catalogo_origenes')
      .select('id,nombre,activo'),

    supabase
      .from('catalogo_zonas')
      .select('id,nombre,activo'),

    supabase
      .from('catalogo_tipos_domicilio')
      .select('id,nombre,activo'),

    supabase
      .from('medios_despacho_chip')
      .select('id,nombre,activo'),

    cargarRegistrosHistoricosImportados()
      .then(data => ({ data, error: null }))
      .catch(error => ({ data: null, error })),
  ])

  const nombres = [
    'productos',
    'estados_baf',
    'estados_porta',
    'estados_bboo',
    'profiles',
    'catalogo_origenes',
    'catalogo_zonas',
    'catalogo_tipos_domicilio',
    'medios_despacho_chip',
    'migracion_historica_registros',
  ]

  const resultado = {}

  consultas.forEach((r, i) => {
    if (r.error) {
      throw new Error(
        `Error consultando ${nombres[i]}: ${r.error.message}`
      )
    }
    resultado[nombres[i]] = r.data ?? []
  })

  return resultado
}

function buscarProducto(catalogos, negocio, producto, origen, plan) {
  const encontrados = catalogos.productos.filter(p =>
    normalizar(p.negocio) === normalizar(negocio) &&
    normalizar(p.producto) === normalizar(producto) &&
    normalizar(p.origen) === normalizar(origen) &&
    normalizar(p.plan) === normalizar(plan)
  )

  return encontrados.length === 1 ? encontrados[0] : null
}

function resolverProductoMovil(catalogos, tipo, row, planInfo) {
  const negocio = negocioDocumento(row.getCell(6).value)

  /*
   * Excepción histórica: filas sin plan.
   * No son ventas concretadas, pero deben importarse y conservarse.
   */
  if (!planInfo.gb) {
    const producto = buscarProducto(
      catalogos,
      negocio,
      tipo === 'LINEA_NUEVA'
        ? 'LINEA NUEVA HISTORICA'
        : 'PORTABILIDAD HISTORICA',
      tipo === 'LINEA_NUEVA' ? 'LINEA NUEVA' : 'SIN COMPANIA',
      'SIN PLAN HISTORICO'
    )

    return {
      producto,
      motivo: producto
        ? 'SIN_PLAN_HISTORICO'
        : 'PRODUCTO_TECNICO_SIN_PLAN_NO_ENCONTRADO',
      negocio,
    }
  }

  const plan = planNormalizado(planInfo.gb)

  /*
   * 20 GB fue un plan comercial real histórico.
   * Los productos existen desactivados exclusivamente para preservar
   * esas operaciones.
   */
  if (planInfo.gb === 20) {
    if (tipo === 'LINEA_NUEVA') {
      const producto = buscarProducto(
        catalogos,
        negocio,
        'LINEA NUEVA',
        'LINEA NUEVA',
        plan
      )

      return {
        producto,
        motivo: producto
          ? 'PLAN_20GB_HISTORICO'
          : 'PRODUCTO_20GB_HISTORICO_NO_ENCONTRADO',
        negocio,
        compania: 'NO_APLICA',
      }
    }

    const companiaRaw = normalizar(row.getCell(11).value)
    let compania = null

    if (companiaRaw.includes('MOVISTAR')) compania = 'MOVISTAR'
    else if (companiaRaw.includes('PERSONAL')) compania = 'PERSONAL'
    else if (
      companiaRaw.includes('TUENTI') ||
      companiaRaw.includes('TUENTY')
    ) compania = 'TUENTI'

    if (!compania) {
      const producto = buscarProducto(
        catalogos,
        negocio,
        'PORTABILIDAD HISTORICA',
        'SIN COMPANIA',
        'PLAN HISTORICO'
      )

      return {
        producto,
        motivo: producto
          ? 'COMPANIA_NO_RESUELTA'
          : 'PRODUCTO_TECNICO_COMPANIA_NO_ENCONTRADO',
        negocio,
        compania: null,
      }
    }

    const producto = buscarProducto(
      catalogos,
      negocio,
      'PORTABILIDAD',
      compania,
      plan
    )

    return {
      producto,
      motivo: producto
        ? 'PLAN_20GB_HISTORICO'
        : 'PRODUCTO_20GB_HISTORICO_NO_ENCONTRADO',
      negocio,
      compania,
    }
  }

  if (tipo === 'LINEA_NUEVA') {
    const producto = buscarProducto(
      catalogos,
      negocio,
      'LINEA NUEVA',
      'LINEA NUEVA',
      plan
    )

    return {
      producto,
      motivo: producto ? null : 'PRODUCTO_LN_NO_ENCONTRADO',
      negocio,
    }
  }

  const companiaRaw = normalizar(row.getCell(11).value)

  let compania = null
  if (companiaRaw.includes('MOVISTAR')) compania = 'MOVISTAR'
  else if (companiaRaw.includes('PERSONAL')) compania = 'PERSONAL'
  else if (
    companiaRaw.includes('TUENTI') ||
    companiaRaw.includes('TUENTY')
  ) compania = 'TUENTI'

  /*
   * Compañía no identificable: no bloqueamos una no-venta histórica.
   * Se asocia al producto técnico y el plan real se conservará después
   * en plan_snapshot.
   */
  if (!compania) {
    const producto = buscarProducto(
      catalogos,
      negocio,
      'PORTABILIDAD HISTORICA',
      'SIN COMPANIA',
      'PLAN HISTORICO'
    )

    return {
      producto,
      motivo: producto
        ? 'COMPANIA_NO_RESUELTA'
        : 'PRODUCTO_TECNICO_COMPANIA_NO_ENCONTRADO',
      negocio,
      compania: null,
    }
  }

  const producto = buscarProducto(
    catalogos,
    negocio,
    'PORTABILIDAD',
    compania,
    plan
  )

  return {
    producto,
    motivo: producto ? null : 'PRODUCTO_PORTA_NO_ENCONTRADO',
    negocio,
    compania,
  }
}

function resolverProductoBaf(catalogos, row) {
  const planOriginal = texto(row.getCell(12).value)
  const planRaw = normalizar(planOriginal)

  /*
   * FWA estaba en la planilla BAF pero PGL lo modela como móvil/FWA.
   */
  if (planRaw === 'FWA 5G') {
    const negocio = negocioDocumento(row.getCell(4).value)

    const producto = buscarProducto(
      catalogos,
      negocio,
      'LINEA NUEVA',
      'LINEA NUEVA',
      'FWA 5G 400G'
    )

    return {
      producto,
      motivo: producto ? null : 'PRODUCTO_FWA_NO_ENCONTRADO',
      destino: 'LINEA_NUEVA_FWA',
      historico: false,
      negocio,
      planOriginal,
    }
  }

  /*
   * AÑADIR TV histórico.
   */
  if (planRaw === 'ANADIR TV') {
    const negocio = negocioDocumento(row.getCell(4).value)

    const producto = buscarProducto(
      catalogos,
      negocio,
      'AÑADIR TV',
      'BAF',
      'AÑADIR TV'
    )

    return {
      producto,
      motivo: producto ? 'PRODUCTO_BAF_HISTORICO' : 'PRODUCTO_BAF_HISTORICO_NO_ENCONTRADO',
      destino: 'BAF',
      historico: true,
      negocio,
      planOriginal,
    }
  }

  const esCuit = planRaw.includes('CUIT')
  const esBafe = planRaw.includes('BAFE')
  const negocio = esCuit ? 'PYME' : 'MASIVO'

  let velocidad = null

  if (planRaw.includes('100M')) velocidad = 100
  else if (planRaw.includes('200M')) velocidad = 200
  else if (planRaw.includes('300M')) velocidad = 300
  else if (planRaw.includes('500M')) velocidad = 500
  else if (planRaw.includes('600M')) velocidad = 600
  else if (planRaw.includes('800M')) velocidad = 800

  if (!velocidad) {
    return {
      producto: null,
      motivo: 'PLAN_BAF_NO_RESUELTO',
      destino: 'BAF',
      planRaw,
      planOriginal,
      negocio,
    }
  }

  if (esBafe) {
    const producto = buscarProducto(
      catalogos,
      negocio,
      'Internet BAFE',
      'BAF',
      `${velocidad} MB BAFE`
    )

    return {
      producto,
      motivo: producto ? 'PRODUCTO_BAF_HISTORICO' : 'PRODUCTO_BAF_HISTORICO_NO_ENCONTRADO',
      destino: 'BAF',
      historico: true,
      negocio,
      planOriginal,
    }
  }

  const producto = buscarProducto(
    catalogos,
    negocio,
    'Internet Fibra optica',
    'BAF',
    `${velocidad} MB`
  )

  return {
    producto,
    motivo:
      producto
        ? ([100, 300, 600].includes(velocidad)
            ? 'PRODUCTO_BAF_HISTORICO'
            : null)
        : 'PRODUCTO_BAF_NO_ENCONTRADO',
    destino: 'BAF',
    historico: [100, 300, 600].includes(velocidad),
    negocio,
    planOriginal,
  }
}



const ADMIN_ID = 'c4bd62d0-3900-4451-9069-2acc25b18adc'

/*
 * Identidades históricas.
 * La clave es la PERSONA, no el email: existen correos grupales.
 */
const IDENTIDADES = new Map([
  ['ANDRES', '1fe87a04-c52e-41b0-acf1-a066bc28aef6'],
  ['AYELEN', '797a4c18-2c79-430b-8a09-aa5e849f67eb'],
  ['BARBARA', 'ffd4f6e5-fff0-4f3c-a375-b336d92b28b9'],
  ['BRENDA', '03e0268f-7f22-49dc-a224-769020ee766a'],
  ['DANIELA', 'af941481-fcdb-4d03-b15b-22636a122464'],
  ['ELIAS', 'b8f85de3-61d3-4aef-b60f-8a0936741452'],
  ['EMMANUEL A', 'f8881f6a-9783-499c-a9fe-9535043c87ea'],
  ['ENZO', '95d77368-9c31-4709-b509-b7d6c9962e4b'],
  ['EXE', 'b5768c0b-a34f-4d7e-9a5b-c0838eae37c4'],
  ['EXEQUIEL', 'b5768c0b-a34f-4d7e-9a5b-c0838eae37c4'],
  ['FACUNDO', '94577b90-cd4a-4179-a6d4-0a8f1b3ef7e6'],
  ['FERNANDA', 'e911f344-7ec9-4f29-abd4-f5e6204fbf30'],
  ['FLOR', '0a49277f-ea7f-4d63-a629-d0a7e5a03cfb'],
  ['FLORENCIA L', '0a49277f-ea7f-4d63-a629-d0a7e5a03cfb'],
  ['FRANCISCO', '7a79ea22-a8d0-4600-a2da-dbbc215278cc'],
  ['GABRIELA', 'c2bce6dd-3f29-443e-946f-677232b15531'],
  ['GASTON', '8f203a05-8e6e-4c23-a88f-e92486e8b1f5'],
  ['GISELLA', '0a3554b6-468d-4dc7-8217-3e4b491af859'],
  ['JAVIER', 'cd2f5627-8cd2-4809-92b5-f6be3cb33654'],
  ['JEREMIAS', '51b5de83-9cc1-4f1f-bd9e-8295382d3708'],
  ['JESSI', 'e1f618a9-13a9-4be3-93e2-d4cf73774b17'],
  ['JESSICA', 'e1f618a9-13a9-4be3-93e2-d4cf73774b17'],
  ['JESUS', '97df5f6d-1040-4139-b3e7-a51ea765efee'],
  ['KAREN', 'f85d3e82-2b46-48f0-b68c-92c9d82a474f'],
  ['LAURA', 'ead256a9-36e8-43c4-8373-93d769e33866'],
  ['LAURA O', 'ead256a9-36e8-43c4-8373-93d769e33866'],
  ['LEANDRO', 'b0bf5742-a153-419c-aabd-ef46cacc9149'],
  ['LEONARDO', '5d9b9c65-d3c2-4863-992a-0b14b341b8f1'],
  ['LUCAS', 'b87638fa-4071-40db-a033-1cfb1a314006'],
  ['MATIAS', 'f000e0d5-d1a7-45c6-aa00-0065a7ee8682'],
  ['MAXIMILIANO', '24b5c977-4fce-4c8b-8bfa-3aae62d3e0c6'],
  ['MILI', 'e20a7a6d-de63-4252-9ced-cf07a0e84161'],
  ['NATANAEL', '235ef005-8018-480a-8f31-ae14c52f8aaf'],
  ['ROCIO', '5d9e1194-e9d4-4f96-8843-ad769567a7e3'],
  ['SARA', '9833431c-ccc5-4cf4-9299-1fa9cb74d4f4'],
  ['SEBASTIAN', '5c6e9002-737a-40d8-ab64-6b315cb7f98d'],
  ['YAMILA', '563a18fc-caba-45f1-b190-6a0388be5f7f'],
])

const IDENTIDADES_GRUPO = [
  [/^P1 CELESTE\b/, '46cb221d-428c-48a0-aa71-444713c95383'],
  [/^P1 CAMILA\b/, 'b9197ece-adce-4f3c-8e98-e94e59d8e4d6'],
  [/^P1 MAXI M\b/, '3322d90c-a1c6-4b4a-a7e6-812991ce40d7'],
  [/^J1 ROMINA\b/, 'a84bdf01-87cf-4b9d-835c-547d3bc452f5'],
  [/^J1 KARINA\b/, 'a062bb77-b78f-4c5e-8b69-282b77bf456c'],
  [/^J1 MANUEL\b/, '103dc6fd-5bb2-4867-9ad8-7a20d90b822b'],
  [/^N1 MACARENA\b/, 'baed24cb-ff06-49c7-8502-5c02f53322fa'],
  [/^N1 NOYA JORGE\b/, '12133e10-143a-48a8-82f3-d5504d658a3b'],
  [/^N1 LUCAS C\b/, 'e335f948-8e0b-48c6-b2cc-8d3aa2477a5d'],
  [/^T1 CONSTANZA\b/, 'e2680c53-5d3b-40d7-9425-7ea3c10eb402'],
  [/^T1 CINTIA(?: A)?\b/, '703d342e-05e7-402f-b902-8d65b4ffff74'],
  [/^T1 REDES\b/, '4b6c183a-d771-47f0-9c96-8af73770326c'],
  [/^T1 XIMENA\b/, '88e64cca-6c04-4326-8e2c-13e1157b37a0'],
  [/^B1 SANTIAGO\b/, '25631f44-564a-4320-bbe0-e5af68285180'],
]

const IDENTIDADES_VENDEDOR_HISTORICO = new Map([
  // LT Lisandro y RL Lisandro representan al mismo vendedor histórico.
  // RL se transforma previamente a LT conservando origen Redes Lucom.
  ['LT LISANDRO', 'd560399c-d303-4593-8dc2-7f25c5557ad8'],
])

function perfilPorId(catalogos, id) {
  return catalogos.profiles.find(p => p.id === id) ?? null
}

function quitarPsr(valor) {
  let s = texto(valor).trim()

  while (/^PSR_/i.test(s)) {
    s = s.replace(/^PSR_/i, '')
  }

  return s.trim()
}

function etiquetaSinEmail(valor) {
  return normalizar(
    quitarPsr(valor)
      .replace(/<[^>]*>/g, '')
      .trim()
  )
}

function datosEtiquetaVendedor(valor) {
  const original = texto(valor)
  const esPsr = /^PSR_/i.test(original)
  const sinPsr = quitarPsr(original)

  const matchEmail = sinPsr.match(/<\s*([^<>]+?)\s*>/)
  const email = matchEmail
    ? normalizar(matchEmail[1]).toLowerCase()
    : null

  const etiqueta = normalizar(
    sinPsr
      .replace(/<[^>]*>/g, '')
      .trim()
  )

  const m = etiqueta.match(/^(RL|LT|L1|J1|T1|P1|F1|R1|S1|C1|B1|N1)\s+(.+)$/)

  return {
    original,
    esPsr,
    etiqueta,
    prefijo: m ? m[1] : null,
    nombre: m ? m[2].trim() : etiqueta,
    email,
  }
}

function claveLtHistorico(nombre, email) {
  if (!nombre || !email) return null

  return `${normalizar(nombre)}|${String(email).trim().toLowerCase()}`
}

function buscarPerfilPorEtiqueta(catalogos, etiqueta) {
  const objetivo = normalizar(etiqueta)

  const encontrados = catalogos.profiles.filter(
    p => etiquetaSinEmail(p.vendedor) === objetivo
  )

  return encontrados.length === 1 ? encontrados[0] : null
}

function resolverVendedorHistorico(catalogos, valor, vendedoresLtHistoricos = new Set()) {
  const {
    original,
    esPsr,
    etiqueta,
    prefijo,
    nombre,
    email,
  } = datosEtiquetaVendedor(valor)

  if (!original || original === '[object Object]') {
    return {
      original,
      esPsr,
      perfil: null,
      usuarioId: ADMIN_ID,
      metodo: 'SIN_RESOLVER',
      vendedorCanonico: null,
      origenMigracion: esPsr ? 'PSR' : null,
    }
  }

  let etiquetaCanonica = etiqueta
  let origenMigracion = esPsr ? 'PSR' : null

  /*
   * REGLAS DE MIGRACION
   *
   * PSR_...
   *   PSR_ solo indica origen PSR.
   *   Se elimina para resolver la identidad del vendedor.
   *
   * LT Nombre <email>
   *   vendedor = LT Nombre
   *   origen   = Terreno
   *
   * RL Nombre <email>
   *   origen = Redes Lucom
   *
   *   Solo se transforma a LT Nombre cuando existe históricamente
   *   LT Nombre con EL MISMO EMAIL.
   *
   *   Si no existe esa coincidencia exacta, se conserva RL Nombre
   *   como identidad histórica pendiente de resolución.
   *
   * PSR tiene prioridad sobre cualquier otro origen.
   */

  if (prefijo === 'LT') {
    etiquetaCanonica = `LT ${nombre}`

    if (!esPsr) {
      origenMigracion = 'Terreno'
    }
  }

  if (prefijo === 'RL') {
    const claveLt = claveLtHistorico(nombre, email)
    const existeLt =
      claveLt !== null &&
      vendedoresLtHistoricos.has(claveLt)

    // RL identifica historicamente origen Redes Lucom.
    // Primero preservamos ese origen y luego normalizamos
    // la identidad del vendedor:
    // - mismo nombre + mismo email que LT => LT
    // - sin LT equivalente => L1
    etiquetaCanonica = existeLt
      ? `LT ${nombre}`
      : `L1 ${nombre}`

    if (!esPsr) {
      origenMigracion = 'Redes Lucom'
    }
  }

  /*
   * 1. Resolver por la etiqueta canónica.
   */
  const perfilCanonico = buscarPerfilPorEtiqueta(
    catalogos,
    etiquetaCanonica
  )

  if (perfilCanonico) {
    return {
      original,
      esPsr,
      perfil: perfilCanonico,
      usuarioId: perfilCanonico.id,
      metodo:
        etiquetaCanonica === etiqueta
          ? 'ETIQUETA_EXACTA'
          : 'REGLA_CANAL',
      vendedorCanonico: etiquetaCanonica,
      origenMigracion,
    }
  }

  /*
   * 2. Equivalencias explícitas de vendedores históricos.
   *
   * Se utilizan solamente para identidades comprobadas.
   * Nunca se resuelve L1/LT/RL por nombre de forma general.
   */
  const idHistorico = IDENTIDADES_VENDEDOR_HISTORICO.get(
    normalizar(etiquetaCanonica)
  )

  if (idHistorico) {
    const perfil = perfilPorId(catalogos, idHistorico)

    if (perfil) {
      return {
        original,
        esPsr,
        perfil,
        usuarioId: perfil.id,
        metodo: 'VENDEDOR_HISTORICO_IDENTIFICADO',
        vendedorCanonico: etiquetaCanonica,
        origenMigracion,
      }
    }
  }

  /*
   * 3. Identidades explícitas de grupos.
   */
  for (const [patron, id] of IDENTIDADES_GRUPO) {
    if (patron.test(etiquetaCanonica)) {
      const perfil = perfilPorId(catalogos, id)

      if (perfil) {
        return {
          original,
          esPsr,
          perfil,
          usuarioId: perfil.id,
          metodo: 'GRUPO_IDENTIFICADO',
          vendedorCanonico: etiquetaCanonica,
          origenMigracion,
        }
      }
    }
  }

  /*
   * 3. Compatibilidad para identidades históricas que NO pertenecen
   *    a L1/LT/RL.
   *
   * No resolvemos L1/LT/RL solo por nombre porque:
   * L1 Franco y LT Franco, por ejemplo, pueden ser vendedores distintos.
   */
  if (!['L1', 'LT', 'RL'].includes(prefijo)) {
    let clavePersona = nombre

    if (prefijo === 'F1' || prefijo === 'R1' || prefijo === 'S1') {
      clavePersona = nombre
    }

    const id = IDENTIDADES.get(clavePersona)
    const perfil = id ? perfilPorId(catalogos, id) : null

    if (perfil) {
      return {
        original,
        esPsr,
        perfil,
        usuarioId: perfil.id,
        metodo: 'PERSONA_IDENTIFICADA',
        vendedorCanonico: etiquetaCanonica,
        origenMigracion,
      }
    }
  }

  return {
    original,
    esPsr,
    perfil: null,
    usuarioId: ADMIN_ID,
    metodo: 'SIN_RESOLVER',
    vendedorCanonico: etiquetaCanonica,
    origenMigracion,
  }
}

function resolverResponsableHistorico(catalogos, valor) {
  const original = texto(valor)
  const clave = normalizar(original)

  if (!clave) return { original, perfil: null, metodo: 'VACIO' }

  if ([
    'BAFLUCOM',
    'CALLPORTA',
    'NO ES PROSPECTO',
    'BOT VOCALCOM',
    '10171636',
    'YANINA BR',
  ].includes(clave)) {
    return { original, perfil: null, metodo: 'HISTORICO_TECNICO' }
  }

  const id = IDENTIDADES.get(clave)
  const perfil = id ? perfilPorId(catalogos, id) : null

  return {
    original,
    perfil,
    metodo: perfil ? 'PERSONA_IDENTIFICADA' : 'SIN_RESOLVER',
  }
}

function resolverBbooHistorico(catalogos, valor) {
  const original = texto(valor)
  const clave = normalizar(original)

  const mapa = new Map([
    ['EMANUEL', 'e3ac27c8-ba07-40c2-861a-436850907d04'],
    ['YANINA O', '1265dca5-1a9b-4514-8225-73981103560e'],
    ['REBECA A', 'bb5e01b9-7d56-449e-be0d-2f5370250a0c'],
  ])

  const id = mapa.get(clave)
  const perfil = id ? perfilPorId(catalogos, id) : null

  return {
    original,
    perfil,
    metodo:
      perfil
        ? 'PERSONA_IDENTIFICADA'
        : (clave ? 'HISTORICO_SIN_PERFIL' : 'VACIO'),
  }
}


const EQUIVALENCIAS_ORIGEN_HISTORICO = new Map([
  ['TERRENO', 'Venta Terreno'],
  ['VENTA TERRENO', 'Venta Terreno'],
  ['CONSULTA TERRENO', 'Venta Terreno'],

  ['BASE DE DATOS', 'Bases de Datos'],
  ['BASE PROPIA', 'Base Propia'],

  ['BASE ITX', 'Base ITX'],
  ['BASE CLARO ITX', 'Base ITX'],

  ['CHATBOT 360', 'Chatbot360'],
  ['BOT VOCALCOM', 'Chatbot360'],
  ['GOOGLE', 'Google'],

  ['PSR', 'PSR'],
  ['PROSPECTOS PSR', 'PSR'],
  ['PROSPECTOS APP CLARO', 'PSR'],

  ['BOT DRIVE LC', 'Bot Drive LC'],
  ['BOT TREBLE', 'Treble'],
  ['BOT BIRCLE', 'Bot Bircle'],

  ['LLAMADA IN', 'Llamada IN'],

  ['CLIENTE REFERIDO', 'Cliente Referido'],

  ['REDES LUCOM', 'Redes Lucom'],
  ['REDES SOCIALES QR GOOGLE', 'Redes Lucom'],
  ['REDES SOCIALES QR', 'Redes Lucom'],
  ['REDES SOCIALES', 'Redes Lucom'],
])

function normalizarOrigenPgl(origenHistorico) {
  if (!origenHistorico) return null

  return (
    EQUIVALENCIAS_ORIGEN_HISTORICO.get(
      normalizar(origenHistorico)
    ) ?? null
  )
}

function resolverOrigenHistorico(origen, row) {
  const esBaf = origen === 'BAF'

  const vendedorOriginal = esBaf
    ? row.getCell(3).value
    : row.getCell(4).value

  const datosVendedor = datosEtiquetaVendedor(vendedorOriginal)

  // PSR tiene prioridad sobre cualquier otro origen histórico.
  if (datosVendedor.esPsr) {
    return {
      origen: 'PSR',
      metodo: 'VENDEDOR_PSR',
    }
  }

  // LT identificaba históricamente ventas de Terreno.
  // Tiene prioridad sobre el origen informado porque un origen distinto
  // en una fila LT se considera un error histórico de selección.
  if (datosVendedor.prefijo === 'LT') {
    return {
      origen: 'Terreno',
      metodo: 'VENDEDOR_LT',
    }
  }

  // Para el resto se conserva el campo de origen del archivo histórico.
  const origenFuente = esBaf
    ? texto(row.getCell(19).value) // Detalle Lead
    : texto(row.getCell(15).value) // ORIGEN DATO

  if (origenFuente) {
    return {
      origen: origenFuente,
      metodo: esBaf ? 'DETALLE_LEAD' : 'ORIGEN_DATO',
    }
  }

  // Recuperación de origen cuando el campo histórico está vacío.
  // No inventamos el origen: usamos la estructura comercial histórica
  // identificada por el prefijo del vendedor.
  if (datosVendedor.prefijo === 'RL') {
    return {
      origen: 'Redes Lucom',
      metodo: 'VENDEDOR_RL_ORIGEN_VACIO',
    }
  }

  if (datosVendedor.prefijo === 'L1') {
    return {
      origen: 'BASE PROPIA',
      metodo: 'VENDEDOR_L1_ORIGEN_VACIO',
    }
  }

  if (['J1', 'T1', 'P1', 'C1'].includes(datosVendedor.prefijo)) {
    return {
      origen: 'CLIENTE REFERIDO',
      metodo: 'VENDEDOR_REFERIDO_ORIGEN_VACIO',
    }
  }

  return {
    origen: null,
    metodo: esBaf ? 'DETALLE_LEAD_VACIO' : 'ORIGEN_DATO_VACIO',
  }
}

function fechaIso(v) {
  const d = fechaReal(v)
  return d ? d.toISOString() : null
}

function fechaSolo(v) {
  const d = fechaReal(v)
  if (!d) return null

  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')

  return `${yyyy}-${mm}-${dd}`
}

function numeroEntero(v) {
  const s = String(texto(v)).replace(',', '.').trim()
  if (!s) return null

  const n = Number(s)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function booleanoHistorico(v) {
  const s = normalizar(v)

  if (['SI', 'SÍ', 'TRUE', '1', 'X'].includes(s)) return true
  if (['NO', 'FALSE', '0'].includes(s)) return false

  return null
}

function nombreApellidoHistorico(v) {
  const completo = String(texto(v)).trim()

  if (!completo) {
    return {
      nombre: 'Sin dato',
      apellido: null,
    }
  }

  /*
   * No intentamos reinterpretar agresivamente el nombre histórico.
   * Si viene "Apellido, Nombre" aprovechamos esa separación.
   * En cualquier otro caso preservamos el texto completo en nombre.
   */
  if (completo.includes(',')) {
    const [apellido, ...resto] = completo.split(',')
    const nombre = resto.join(',').trim()

    return {
      nombre: nombre || completo,
      apellido: apellido.trim() || null,
    }
  }

  return {
    nombre: completo,
    apellido: null,
  }
}

function filaOrigenJson(row, maxColumna) {
  const datos = {}

  for (let i = 1; i <= maxColumna; i++) {
    const valor = row.getCell(i).value

    if (valor instanceof Date) {
      datos[String(i)] = valor.toISOString()
    } else {
      datos[String(i)] = texto(valor)
    }
  }

  return datos
}

function buscarCatalogoPorNombre(lista, valor) {
  const buscado = normalizar(valor)
  if (!buscado) return null

  return lista.find(x => normalizar(x.nombre) === buscado) ?? null
}

function resolverEstadoBaf(catalogos, valor) {
  const estado = buscarCatalogoPorNombre(
    catalogos.estados_baf,
    valor
  )

  return estado?.id ?? null
}

function resolverEstadoBboo(catalogos, valor) {
  let buscado = normalizar(valor)

  /*
   * Equivalencias históricas conocidas.
   * El valor original siempre se conserva en la trazabilidad.
   */
  if (buscado === 'LINEA NUEVA ACTIVA S LEGAJO') {
    buscado = 'LINEA NUEVA ACTIVA S/LEGAJO'
  }

  if (buscado === 'RECHAZADO') {
    buscado = 'CANCELADO'
  }

  const estado = catalogos.estados_bboo.find(
    x => normalizar(x.nombre) === buscado
  )

  return estado?.id ?? null
}

function resolverEstadoMovil(catalogos, valor) {
  const original = texto(valor)
  const normalizado = normalizar(valor)

  // Primero intentamos Estado BBOO, incluyendo equivalencias históricas
  // como RECHAZADO -> CANCELADO.
  const estadoBbooId = resolverEstadoBboo(catalogos, valor)

  if (estadoBbooId) {
    return {
      estadoBbooId,
      estadoPortaId: null,
      estadoOriginal: original || null,
      metodo:
        normalizado === 'RECHAZADO'
          ? 'EQUIVALENCIA_HISTORICA_RECHAZADO_CANCELADO'
          : 'ESTADO_BBOO',
    }
  }

  // Si no existe en BBOO, comprobamos Estado Vendedor.
  const estadoPorta = catalogos.estados_porta.find(
    x => normalizar(x.nombre) === normalizado
  )

  if (estadoPorta) {
    return {
      estadoBbooId: null,
      estadoPortaId: estadoPorta.id,
      estadoOriginal: original || null,
      metodo: 'ESTADO_VENDEDOR',
    }
  }

  // Estados discontinuados: no inventamos una equivalencia actual.
  // El texto queda preservado en la trazabilidad de la migración.
  return {
    estadoBbooId: null,
    estadoPortaId: null,
    estadoOriginal: original || null,
    metodo: original ? 'SOLO_HISTORICO' : 'VACIO',
  }
}

function resolverZona(catalogos, valor) {
  return (
    buscarCatalogoPorNombre(
      catalogos.catalogo_zonas,
      valor
    )?.id ?? null
  )
}

function resolverTipoDomicilio(catalogos, valor) {
  const v = normalizar(valor)
  if (!v) return null

  let buscado = v

  if (v.includes('CASA')) buscado = 'Casa'
  else if (v.includes('EDIFICIO')) buscado = 'Edificio'
  else if (v.includes('FWA')) buscado = 'FWA'

  return (
    buscarCatalogoPorNombre(
      catalogos.catalogo_tipos_domicilio,
      buscado
    )?.id ?? null
  )
}

function resolverMedioDespacho(catalogos, valor) {
  const v = normalizar(valor)
  if (!v) return null

  /*
   * Solo resolvemos coincidencias reales del catálogo.
   * No inventamos equivalencias históricas todavía.
   */
  return (
    buscarCatalogoPorNombre(
      catalogos.medios_despacho_chip,
      valor
    )?.id ?? null
  )
}

function construirRegistroBaf(
  catalogos,
  row,
  fila,
  vendedoresLtHistoricos = new Set()
) {
  const vendedor = resolverVendedorHistorico(
    catalogos,
    row.getCell(3).value,
    vendedoresLtHistoricos
  )

  const responsable = resolverResponsableHistorico(
    catalogos,
    row.getCell(1).value
  )

  const origenHistorico = resolverOrigenHistorico('BAF', row)
  const origenPgl = normalizarOrigenPgl(origenHistorico.origen)

  const productoResuelto = resolverProductoBaf(catalogos, row)
  const producto = productoResuelto?.producto ?? null

  const nombres = nombreApellidoHistorico(
    row.getCell(5).value
  )

  const planOriginal = texto(row.getCell(12).value)
  const estadoOriginal = texto(row.getCell(30).value)

  const esFwa =
    productoResuelto?.destino === 'LINEA_NUEVA_FWA'

  const tipoProducto = esFwa ? 'FWA' : 'BAF'

  const advertencias = []

  if (!producto?.id) {
    advertencias.push('PRODUCTO_NO_RESUELTO')
  }

  if (!vendedor.perfil) {
    advertencias.push('VENDEDOR_SIN_PERFIL')
  }

  if (
    texto(row.getCell(1).value) &&
    !responsable.perfil
  ) {
    advertencias.push('RESPONSABLE_SIN_PERFIL')
  }

  if (!origenPgl && origenHistorico.origen) {
    advertencias.push(
      `ORIGEN_NO_RESUELTO:${origenHistorico.origen}`
    )
  }

  if (
    estadoOriginal &&
    !esFwa &&
    !resolverEstadoBaf(catalogos, estadoOriginal)
  ) {
    advertencias.push(
      `ESTADO_BAF_SOLO_HISTORICO:${estadoOriginal}`
    )
  }

  /*
   * FWA proviene históricamente del archivo BAF pero actualmente
   * se representa como producto FWA dentro de la rama móvil.
   * No trasladamos artificialmente el estado BAF a un estado móvil.
   */
  if (esFwa && estadoOriginal) {
    advertencias.push(
      `ESTADO_FWA_ORIGEN_BAF:${estadoOriginal}`
    )
  }

  const payload = {
    usuario_id: ADMIN_ID,

    producto_id: producto?.id ?? null,
    tipo_producto: tipoProducto,

    dni: texto(row.getCell(4).value) || null,
    tipo_documento: tipoDocumento(row.getCell(4).value),

    nombre: nombres.nombre,
    apellido: nombres.apellido,
    fecha_nacimiento: fechaSolo(row.getCell(6).value),

    email: texto(row.getCell(11).value) || null,
    telefono: texto(row.getCell(9).value) || null,
    telefono_alternativo:
      texto(row.getCell(10).value) || null,

    domicilio: texto(row.getCell(7).value) || null,
    entre_calles: texto(row.getCell(8).value) || null,
    domicilio_observaciones: null,

    fecha_hora: fechaIso(row.getCell(2).value),

    vendedor:
      vendedor.vendedorCanonico ||
      texto(row.getCell(3).value) ||
      'HISTORICO',

    origen_dato: origenPgl,

    obs: texto(row.getCell(18).value) || null,
    caminante: null,

    responsable_id: responsable.perfil?.id ?? null,

    plan_snapshot:
      producto?.plan ||
      planOriginal ||
      null,

    // Campos BAF
    tipo_domicilio_id:
      esFwa
        ? null
        : resolverTipoDomicilio(
            catalogos,
            row.getCell(22).value
          ),

    zona_id:
      esFwa
        ? null
        : resolverZona(
            catalogos,
            row.getCell(17).value
          ),

    modalidad_plan: null,

    tv:
      esFwa
        ? false
        : (booleanoHistorico(row.getCell(13).value) ?? false),

    cantidad_decos:
      esFwa
        ? 0
        : (numeroEntero(row.getCell(14).value) ?? 0),

    horario_contacto:
      esFwa
        ? null
        : (texto(row.getCell(18).value) || null),

    fecha_gestion:
      esFwa
        ? null
        : fechaIso(row.getCell(16).value),

    prospector:
      esFwa
        ? null
        : (texto(row.getCell(15).value) || null),

    detalle_lead:
      esFwa
        ? null
        : (texto(row.getCell(19).value) || null),

    cia_celular:
      esFwa
        ? null
        : (texto(row.getCell(23).value) || null),

    sds: texto(row.getCell(24).value) || null,

    orden_trabajo:
      esFwa
        ? null
        : (texto(row.getCell(25).value) || null),

    // Por definición funcional histórica no migramos Línea Fija.
    linea_fija: null,

    fecha_instalacion:
      esFwa
        ? null
        : (texto(row.getCell(27).value) || null),

    ciclo_cuenta:
      esFwa
        ? null
        : (texto(row.getCell(28).value) || null),

    motivo_estado:
      esFwa
        ? null
        : (texto(row.getCell(29).value) || null),

    estado_baf_id:
      esFwa
        ? null
        : resolverEstadoBaf(
            catalogos,
            row.getCell(30).value
          ),

    /*
     * Campos móviles mínimos para FWA.
     * No inventamos datos móviles que no existen en el archivo BAF.
     */
    numero_linea: null,
    nim: null,
    compania_actual: null,
    modalidad_actual: null,
    tipo_sim: null,
    observaciones_movil: null,
    forma_pago_modem: null,
    cuotas_modem: null,
    precio_modem_snapshot: null,
    linea_titular: false,

    bboo_id: null,
    fecha_carga_stl: null,
    sim: null,
    plan_cargado: esFwa ? planOriginal || null : null,
    spn: null,
    pin_lnva_nro: null,
    documentacion_dni: null,
    medio_despacho_chip_id: null,
    fecha_porta: null,
    observaciones_gestion: null,
    estado_porta_id: null,
    estado_bboo_id: null,
    numero_seguimiento: null,
    id_envio: null,
    legajo_enviado: false,
    fecha_legajo_enviado: null,

    // Trazabilidad
    documento_original:
      texto(row.getCell(4).value) || null,

    sds_original:
      texto(row.getCell(24).value) || null,

    orden_trabajo_original:
      texto(row.getCell(25).value) || null,

    vendedor_original:
      texto(row.getCell(3).value) || null,

    responsable_original:
      texto(row.getCell(1).value) || null,

    bboo_original: null,
    estado_original: estadoOriginal || null,
    plan_original: planOriginal || null,

    advertencias,

    datos_origen: filaOrigenJson(row, 39),

    _diagnostico: {
      origen: 'BAF',
      fila,
      tipoProducto,
      vendedorMetodo: vendedor.metodo,
      responsableMetodo: responsable.metodo,
      origenMetodo: origenHistorico.metodo,
      productoMotivo: productoResuelto?.motivo ?? null,
    },
  }

  return payload
}

function construirRegistroMovil(
  catalogos,
  row,
  fila,
  vendedoresLtHistoricos = new Set()
) {
  const tipo = clasificarMovil(row)

  const vendedor = resolverVendedorHistorico(
    catalogos,
    row.getCell(4).value,
    vendedoresLtHistoricos
  )

  const responsable = resolverResponsableHistorico(
    catalogos,
    row.getCell(1).value
  )

  const bboo = resolverBbooHistorico(
    catalogos,
    row.getCell(24).value
  )

  const origenHistorico = resolverOrigenHistorico(
    'MOVIL',
    row
  )

  const origenPgl = normalizarOrigenPgl(
    origenHistorico.origen
  )

  const planInfo = planMovil(row)

  const productoResuelto = resolverProductoMovil(
    catalogos,
    tipo,
    row,
    planInfo
  )

  const producto = productoResuelto?.producto ?? null

  const estado = resolverEstadoMovil(
    catalogos,
    row.getCell(29).value
  )

  const nombres = nombreApellidoHistorico(
    row.getCell(5).value
  )

  const nimOriginal =
    texto(row.getCell(8).value) || null

  const pinLnva =
    texto(row.getCell(21).value) || null

  /*
   * PORTA:
   *   NIM histórico = número de línea portada.
   *
   * LINEA_NUEVA:
   *   col.21 contiene el número nuevo cuando fue asignado.
   *   Si todavía no existe, usamos col.8 como referencia histórica.
   */
  const numeroLinea =
    tipo === 'LINEA_NUEVA'
      ? (pinLnva || nimOriginal)
      : nimOriginal

  /*
   * En registros PSR conservamos también Prospector APP (col. 2)
   * como información operativa visible.
   */
  const vendedorOriginal = texto(row.getCell(4).value) || null
  const esPsr = normalizar(vendedorOriginal).startsWith('PSR_')
  const prospectorApp = texto(row.getCell(2).value) || null
  const observacionVendedor = texto(row.getCell(14).value) || null

  const observacionConProspector =
    esPsr && prospectorApp
      ? [
          observacionVendedor,
          `Prospector APP: ${prospectorApp}`,
        ].filter(Boolean).join(' | ')
      : observacionVendedor

  const advertencias = []

  if (!producto?.id) {
    advertencias.push('PRODUCTO_NO_RESUELTO')
  }

  if (!vendedor.perfil) {
    advertencias.push('VENDEDOR_SIN_PERFIL')
  }

  if (
    texto(row.getCell(1).value) &&
    !responsable.perfil
  ) {
    advertencias.push('RESPONSABLE_SIN_PERFIL')
  }

  if (
    texto(row.getCell(24).value) &&
    !bboo.perfil
  ) {
    advertencias.push('BBOO_SIN_PERFIL')
  }

  if (!origenPgl && origenHistorico.origen) {
    advertencias.push(
      `ORIGEN_NO_RESUELTO:${origenHistorico.origen}`
    )
  }

  if (estado.metodo === 'SOLO_HISTORICO') {
    advertencias.push(
      `ESTADO_SOLO_HISTORICO:${estado.estadoOriginal}`
    )
  }

  const documentoDniTexto =
    normalizar(row.getCell(22).value)

  let documentacionDni = null

  if (documentoDniTexto) {
    if (
      ['SI', 'SÍ', 'OK', 'TRUE', '1', 'X'].includes(
        documentoDniTexto
      )
    ) {
      documentacionDni = true
    } else if (
      ['NO', 'FALSE', '0'].includes(documentoDniTexto)
    ) {
      documentacionDni = false
    }
  }

  const entLegajos =
    booleanoHistorico(row.getCell(33).value)

  const payload = {
    usuario_id: ADMIN_ID,

    producto_id: producto?.id ?? null,
    tipo_producto: tipo,

    dni: texto(row.getCell(6).value) || null,
    tipo_documento: tipoDocumento(row.getCell(6).value),

    nombre: nombres.nombre,
    apellido: nombres.apellido,
    fecha_nacimiento: fechaSolo(row.getCell(7).value),

    email: texto(row.getCell(9).value) || null,

    /*
     * El archivo móvil no posee un teléfono principal independiente.
     * No reutilizamos el NIM como teléfono del cliente.
     */
    telefono: null,
    telefono_alternativo:
      texto(row.getCell(12).value) || null,

    domicilio: texto(row.getCell(13).value) || null,
    entre_calles: null,
    domicilio_observaciones: null,

    fecha_hora: fechaIso(row.getCell(3).value),

    vendedor:
      vendedor.vendedorCanonico ||
      texto(row.getCell(4).value) ||
      'HISTORICO',

    origen_dato: origenPgl,

    obs: observacionConProspector || null,
    caminante: null,

    responsable_id: responsable.perfil?.id ?? null,

    plan_snapshot:
      producto?.plan ||
      planInfo?.plan ||
      texto(row.getCell(18).value) ||
      texto(row.getCell(10).value) ||
      null,

    // Datos móviles
    numero_linea: numeroLinea,
    nim: nimOriginal,

    compania_actual:
      texto(row.getCell(11).value) || null,

    modalidad_actual: null,
    tipo_sim: null,

    observaciones_movil:
      observacionConProspector || null,

    forma_pago_modem: null,
    cuotas_modem: null,
    precio_modem_snapshot: null,
    linea_titular: false,

    bboo_id: bboo.perfil?.id ?? null,

    fecha_carga_stl:
      fechaIso(row.getCell(16).value),

    sim: texto(row.getCell(17).value) || null,

    plan_cargado:
      texto(row.getCell(18).value) ||
      texto(row.getCell(10).value) ||
      null,

    sds: texto(row.getCell(19).value) || null,
    spn: texto(row.getCell(20).value) || null,
    pin_lnva_nro: pinLnva,

    documentacion_dni: documentacionDni,

    medio_despacho_chip_id:
      resolverMedioDespacho(
        catalogos,
        row.getCell(23).value
      ),

    fecha_porta:
      fechaIso(row.getCell(25).value),

    observaciones_gestion:
      texto(row.getCell(28).value) || null,

    estado_porta_id: estado.estadoPortaId,
    estado_bboo_id: estado.estadoBbooId,

    numero_seguimiento:
      texto(row.getCell(35).value) || null,

    // Logística histórica no reconstruida en PGL.
    id_envio: null,

    legajo_enviado: entLegajos ?? false,

    /*
     * Fecha Ult Estado no necesariamente es la fecha de envío
     * del legajo, por lo que no la reinterpretamos.
     */
    fecha_legajo_enviado: null,

    // Trazabilidad
    documento_original:
      texto(row.getCell(6).value) || null,

    sds_original:
      texto(row.getCell(19).value) || null,

    orden_trabajo_original: null,

    vendedor_original:
      texto(row.getCell(4).value) || null,

    responsable_original:
      texto(row.getCell(1).value) || null,

    bboo_original:
      texto(row.getCell(24).value) || null,

    estado_original:
      texto(row.getCell(29).value) || null,

    plan_original:
      texto(row.getCell(18).value) ||
      texto(row.getCell(10).value) ||
      null,

    advertencias,

    datos_origen: filaOrigenJson(row, 40),

    _diagnostico: {
      origen: 'MOVIL',
      fila,
      tipoProducto: tipo,
      vendedorMetodo: vendedor.metodo,
      responsableMetodo: responsable.metodo,
      bbooMetodo: bboo.metodo,
      origenMetodo: origenHistorico.metodo,
      estadoMetodo: estado.metodo,
      productoMotivo: productoResuelto?.motivo ?? null,
    },
  }

  return payload
}

function tieneContenidoBaf(row) {
  return Boolean(
    texto(row.getCell(2).value) ||
    texto(row.getCell(3).value) ||
    texto(row.getCell(4).value) ||
    texto(row.getCell(5).value)
  )
}

function tieneContenidoMovil(row) {
  return Boolean(
    texto(row.getCell(3).value) ||
    texto(row.getCell(4).value) ||
    texto(row.getCell(5).value) ||
    texto(row.getCell(6).value) ||
    texto(row.getCell(8).value)
  )
}


function construirVendedoresLtHistoricos(baf, movil) {
  /*
   * Índice de vendedores LT presentes en los dos archivos históricos.
   *
   * La equivalencia RL -> LT requiere:
   * - mismo nombre
   * - mismo email
   *
   * No alcanza con que coincida solamente el nombre.
   */
  const vendedoresLtHistoricos = new Set()

  function registrarLtHistorico(valor) {
    const datos = datosEtiquetaVendedor(valor)

    if (datos.prefijo === 'LT') {
      const clave = claveLtHistorico(
        datos.nombre,
        datos.email
      )

      if (clave) {
        vendedoresLtHistoricos.add(clave)
      }
    }
  }

  for (let f = 2; f <= baf.rowCount; f++) {
    const row = baf.getRow(f)
    if (!tieneContenidoBaf(row)) continue

    registrarLtHistorico(row.getCell(3).value)
  }

  for (let f = 2; f <= movil.rowCount; f++) {
    const row = movil.getRow(f)
    if (!tieneContenidoMovil(row)) continue

    registrarLtHistorico(row.getCell(4).value)
  }

  return vendedoresLtHistoricos
}


async function ejecutarReanudacionLote(
  loteId,
  registrosValidos,
  yaImportadas
) {
  if (!Number.isInteger(loteId) || loteId <= 0) {
    throw new Error(`ID de lote inválido: ${loteId}`)
  }

  const { data: lote, error: errorLote } = await supabase
    .from('migracion_historica_lotes')
    .select('*')
    .eq('id', loteId)
    .single()

  if (errorLote || !lote) {
    throw new Error(
      `No se pudo consultar el lote ${loteId}: ${errorLote?.message || 'no encontrado'}`
    )
  }

  const pendientes = registrosValidos.filter(
    r => !yaImportadas.has(`${r.origen}:${r.fila}`)
  )

  console.log('')
  console.log('============================================================')
  console.log(' REANUDACION DE LOTE HISTORICO')
  console.log('============================================================')

  console.table([{
    lote_id: lote.id,
    codigo: lote.codigo,
    estado_actual: lote.estado,
    historicos_detectados: yaImportadas.size,
    pendientes: pendientes.length,
  }])

  if (pendientes.length === 0) {
    console.log('')
    console.log('No existen registros pendientes para reanudar.')
    return
  }

  const confirmacionEsperada =
    `REANUDAR ${loteId} ${pendientes.length}`

  console.log('')
  console.log(
    `Se intentarán importar solamente ${pendientes.length} registros pendientes en el lote ${loteId}.`
  )
  console.log(`Para continuar escribí exactamente: ${confirmacionEsperada}`)
  console.log('')

  const rl = createInterface({ input, output })

  let respuesta

  try {
    respuesta = await rl.question('Confirmación: ')
  } finally {
    rl.close()
  }

  if (respuesta.trim() !== confirmacionEsperada) {
    console.log('')
    console.log('REANUDACION CANCELADA. No se realizaron escrituras.')
    return
  }

  let importadosNuevos = 0
  let omitidosNuevos = 0
  let erroresNuevos = 0
  const ejemplosErrores = []

  for (let i = 0; i < pendientes.length; i++) {
    const registro = pendientes[i]

    const { data, error } = await supabase.rpc(
      'importar_operacion_historica',
      {
        p_lote_id: loteId,
        p_origen: registro.origen,
        p_fila_origen: registro.fila,
        p_datos: registro.payload,
      }
    )

    if (error) {
      erroresNuevos++

      if (ejemplosErrores.length < 30) {
        ejemplosErrores.push({
          origen: registro.origen,
          fila: registro.fila,
          error: error.message,
        })
      }
    } else if (data?.omitido === true) {
      omitidosNuevos++
    } else {
      importadosNuevos++
    }

    console.log(
      `Procesados ${i + 1}/${pendientes.length}` +
      ` | importados ${importadosNuevos}` +
      ` | omitidos ${omitidosNuevos}` +
      ` | errores ${erroresNuevos}`
    )
  }

  const { count: totalRealImportado, error: errorConteo } =
    await supabase
      .from('migracion_historica_registros')
      .select('*', { count: 'exact', head: true })
      .eq('lote_id', loteId)

  if (errorConteo) {
    throw new Error(
      `No se pudo contar la trazabilidad del lote ${loteId}: ${errorConteo.message}`
    )
  }

  const estadoFinal =
    erroresNuevos === 0 ? 'FINALIZADO' : 'FINALIZADO_CON_ERRORES'

  const { error: errorActualizarLote } = await supabase
    .from('migracion_historica_lotes')
    .update({
      estado: estadoFinal,
      total_importado: totalRealImportado,
      total_omitido: 0,
      total_error: erroresNuevos,
      finalizado_at: new Date().toISOString(),
      observaciones:
        `Migración histórica reanudada. ` +
        `Nuevos=${importadosNuevos}; ` +
        `omitidos=${omitidosNuevos}; ` +
        `errores=${erroresNuevos}; ` +
        `total trazado=${totalRealImportado}`,
    })
    .eq('id', loteId)

  if (errorActualizarLote) {
    throw new Error(
      `La reanudación terminó, pero no se pudo actualizar el lote ${loteId}: ${errorActualizarLote.message}`
    )
  }

  console.log('')
  console.log('============================================================')
  console.log(' REANUDACION FINALIZADA')
  console.log('============================================================')

  console.table([{
    lote_id: loteId,
    pendientes_intentados: pendientes.length,
    importados_nuevos: importadosNuevos,
    omitidos_nuevos: omitidosNuevos,
    errores_nuevos: erroresNuevos,
    total_importado_lote: totalRealImportado,
    estado: estadoFinal,
  }])

  if (ejemplosErrores.length) {
    console.log('')
    console.log('ERRORES DE REANUDACION')
    console.table(ejemplosErrores)
  }
}

async function ejecutarImportacionMasiva(registrosValidos) {
  console.log('')
  console.log('============================================================')
  console.log(' IMPORTACION HISTORICA MASIVA')
  console.log('============================================================')

  if (!Array.isArray(registrosValidos) || registrosValidos.length === 0) {
    throw new Error('No hay registros válidos para importar.')
  }

  const totalBaf = registrosValidos.filter(
    r => r.origen === 'BAF'
  ).length

  const totalMovil = registrosValidos.filter(
    r => r.origen === 'MOVIL'
  ).length

  console.log('')
  console.table([{
    total: registrosValidos.length,
    archivo_baf: totalBaf,
    archivo_movil: totalMovil,
  }])

  const confirmacionEsperada =
    `IMPORTAR ${registrosValidos.length}`

  console.log('')
  console.log('ATENCION: esta operación realizará escrituras reales en Supabase.')
  console.log(`Para continuar escribí exactamente: ${confirmacionEsperada}`)
  console.log('')

  const rl = createInterface({ input, output })

  let respuesta

  try {
    respuesta = await rl.question('Confirmación: ')
  } finally {
    rl.close()
  }

  if (respuesta.trim() !== confirmacionEsperada) {
    console.log('')
    console.log('IMPORTACION CANCELADA.')
    console.log('No se creó ningún lote ni se realizaron escrituras.')
    console.log('')
    return {
      cancelado: true,
      importados: 0,
      omitidos: 0,
      errores: 0,
    }
  }

  const codigo =
    `MIGRACION_HISTORICA_${new Date()
      .toISOString()
      .replace(/[-:.TZ]/g, '')
      .slice(0, 14)}`

  const { data: lote, error: errorLote } = await supabase
    .from('migracion_historica_lotes')
    .insert({
      id: undefined,
      codigo,
      estado: 'EN_PROCESO',
      archivo_baf: NOMBRE_ARCHIVO_BAF,
      archivo_movil: NOMBRE_ARCHIVO_MOVIL,
      total_baf: totalBaf,
      total_movil: totalMovil,
      total_importado: 0,
      total_omitido: 0,
      total_error: 0,
      observaciones:
        'Migración histórica masiva controlada desde importar.mjs',
    })
    .select()
    .single()

  if (errorLote) {
    throw new Error(
      `Error creando lote de importación: ${errorLote.message}`
    )
  }

  console.log('')
  console.log(`Lote creado: ${lote.id} / ${lote.codigo}`)
  console.log('')

  let importados = 0
  let omitidos = 0
  let errores = 0
  const ejemplosErrores = []

  for (let i = 0; i < registrosValidos.length; i++) {
    const registro = registrosValidos[i]

    const { data, error } = await supabase.rpc(
      'importar_operacion_historica',
      {
        p_lote_id: lote.id,
        p_origen: registro.origen,
        p_fila_origen: registro.fila,
        p_datos: registro.payload,
      }
    )

    if (error) {
      errores++

      if (ejemplosErrores.length < 30) {
        ejemplosErrores.push({
          origen: registro.origen,
          fila: registro.fila,
          error: error.message,
        })
      }
    } else if (data?.omitido === true) {
      omitidos++
    } else {
      importados++
    }

    const procesados = i + 1

    if (
      procesados % 100 === 0 ||
      procesados === registrosValidos.length
    ) {
      console.log(
        `Procesados ${procesados}/${registrosValidos.length}` +
        ` | importados ${importados}` +
        ` | omitidos ${omitidos}` +
        ` | errores ${errores}`
      )
    }
  }

  const estadoFinal =
    errores === 0 ? 'FINALIZADO' : 'FINALIZADO_CON_ERRORES'

  const { error: errorActualizarLote } = await supabase
    .from('migracion_historica_lotes')
    .update({
      estado: estadoFinal,
      total_importado: importados,
      total_omitido: omitidos,
      total_error: errores,
      finalizado_at: new Date().toISOString(),
    })
    .eq('id', lote.id)

  if (errorActualizarLote) {
    throw new Error(
      `La importación terminó, pero no se pudo actualizar el lote ${lote.id}: ${errorActualizarLote.message}`
    )
  }

  console.log('')
  console.log('============================================================')
  console.log(' IMPORTACION MASIVA FINALIZADA')
  console.log('============================================================')

  console.table([{
    lote_id: lote.id,
    codigo: lote.codigo,
    total: registrosValidos.length,
    importados,
    omitidos,
    errores,
    estado: estadoFinal,
  }])

  if (ejemplosErrores.length) {
    console.log('')
    console.log('EJEMPLOS DE ERRORES DE IMPORTACION')
    console.table(ejemplosErrores)
  }

  console.log('')
  console.log(
    `Rollback disponible con revertir_lote_migracion_historica(${lote.id})`
  )
  console.log('')

  return {
    lote,
    importados,
    omitidos,
    errores,
  }
}


async function ejecutarPruebaImportacion(
  catalogos,
  baf,
  movil,
  vendedoresLtHistoricos
) {
  console.log('')
  console.log('============================================================')
  console.log(' PRUEBA REAL DE IMPORTACION - 4 REGISTROS')
  console.log('============================================================')

  const candidatos = {
    BAF: null,
    FWA: null,
    PORTA: null,
    LINEA_NUEVA: null,
  }

  // ----------------------------------------------------------
  // Buscar BAF y FWA en el archivo BAF.
  // ----------------------------------------------------------
  for (let fila = 2; fila <= baf.rowCount; fila++) {
    if (candidatos.BAF && candidatos.FWA) break

    const row = baf.getRow(fila)
    if (!tieneContenidoBaf(row)) continue

    try {
      const payload = construirRegistroBaf(
        catalogos,
        row,
        fila,
        vendedoresLtHistoricos
      )

      if (
        payload.producto_id &&
        payload.fecha_hora &&
        payload.vendedor
      ) {
        if (
          payload.tipo_producto === 'BAF' &&
          !candidatos.BAF
        ) {
          candidatos.BAF = {
            origen: 'BAF',
            fila,
            payload,
          }
        }

        if (
          payload.tipo_producto === 'FWA' &&
          !candidatos.FWA
        ) {
          candidatos.FWA = {
            origen: 'BAF',
            fila,
            payload,
          }
        }
      }
    } catch (error) {
      // La prueba continúa buscando otra fila candidata.
    }
  }

  // ----------------------------------------------------------
  // Buscar PORTA y LINEA_NUEVA en el archivo móvil.
  // ----------------------------------------------------------
  for (let fila = 2; fila <= movil.rowCount; fila++) {
    if (candidatos.PORTA && candidatos.LINEA_NUEVA) break

    const row = movil.getRow(fila)
    if (!tieneContenidoMovil(row)) continue

    try {
      const payload = construirRegistroMovil(
        catalogos,
        row,
        fila,
        vendedoresLtHistoricos
      )

      if (
        payload.producto_id &&
        payload.fecha_hora &&
        payload.vendedor
      ) {
        if (
          payload.tipo_producto === 'PORTA' &&
          !candidatos.PORTA
        ) {
          candidatos.PORTA = {
            origen: 'MOVIL',
            fila,
            payload,
          }
        }

        if (
          payload.tipo_producto === 'LINEA_NUEVA' &&
          !candidatos.LINEA_NUEVA
        ) {
          candidatos.LINEA_NUEVA = {
            origen: 'MOVIL',
            fila,
            payload,
          }
        }
      }
    } catch (error) {
      // La prueba continúa buscando otra fila candidata.
    }
  }

  const faltantes = Object.entries(candidatos)
    .filter(([, candidato]) => !candidato)
    .map(([tipo]) => tipo)

  if (faltantes.length) {
    throw new Error(
      `No se encontraron candidatos válidos para: ${faltantes.join(', ')}`
    )
  }

  console.log('')
  console.log('REGISTROS SELECCIONADOS')
  console.table(
    Object.entries(candidatos).map(([tipo, candidato]) => ({
      tipo,
      origen: candidato.origen,
      fila: candidato.fila,
      operacion_id_esperada:
        `HIST-${candidato.origen === 'BAF' ? 'BAF' : 'MOVIL'}-${String(candidato.fila).padStart(6, '0')}`,
      producto_id: candidato.payload.producto_id,
      vendedor: candidato.payload.vendedor,
      origen_dato: candidato.payload.origen_dato,
      fecha_hora: candidato.payload.fecha_hora,
    }))
  )

  // ----------------------------------------------------------
  // Crear lote de prueba.
  // ----------------------------------------------------------
  const codigo =
    `PRUEBA_REAL_${new Date()
      .toISOString()
      .replace(/[-:.TZ]/g, '')
      .slice(0, 14)}`

  const { data: lote, error: errorLote } = await supabase
    .from('migracion_historica_lotes')
    .insert({
      id: undefined,
      codigo,
      estado: 'PREPARADO',
      archivo_baf: NOMBRE_ARCHIVO_BAF,
      archivo_movil: NOMBRE_ARCHIVO_MOVIL,
      total_baf: 2,
      total_movil: 2,
      observaciones:
        'Prueba real controlada: 1 BAF + 1 FWA + 1 PORTA + 1 LINEA_NUEVA',
    })
    .select()
    .single()

  if (errorLote) {
    throw new Error(
      `Error creando lote de prueba: ${errorLote.message}`
    )
  }

  console.log('')
  console.log('LOTE CREADO')
  console.table([lote])

  // ----------------------------------------------------------
  // Importar las cuatro operaciones.
  // ----------------------------------------------------------
  const resultados = []

  for (const [tipo, candidato] of Object.entries(candidatos)) {
    console.log('')
    console.log(
      `Importando ${tipo} | ${candidato.origen} | fila ${candidato.fila}...`
    )

    const { data, error } = await supabase.rpc(
      'importar_operacion_historica',
      {
        p_lote_id: lote.id,
        p_origen: candidato.origen,
        p_fila_origen: candidato.fila,
        p_datos: candidato.payload,
      }
    )

    if (error) {
      throw new Error(
        `Error importando ${tipo} (${candidato.origen}:${candidato.fila}): ${error.message}`
      )
    }

    resultados.push({
      tipo,
      origen: candidato.origen,
      fila: candidato.fila,
      resultado: JSON.stringify(data),
    })
  }

  console.log('')
  console.log('RESULTADOS DE LA IMPORTACION')
  console.table(resultados)

  console.log('')
  console.log('============================================================')
  console.log(' PRUEBA REAL FINALIZADA')
  console.log('============================================================')
  console.log(`Lote: ${lote.id} / ${lote.codigo}`)
  console.log('Se importaron solamente 4 operaciones.')
  console.log('')
  console.log('IMPORTANTE: NO SE EJECUTA ROLLBACK AUTOMATICAMENTE.')
  console.log('Primero verificaremos las 4 operaciones en Supabase.')
  console.log('')
}

async function main() {
  const esPrueba = process.argv.includes('--prueba-importacion')
  const esImportacion = process.argv.includes('--importar')
  const esReanudacion = process.argv.includes('--reanudar-lote')

  const modo =
    esPrueba ? 'PRUEBA DE IMPORTACION' :
    esReanudacion ? 'REANUDACION DE LOTE' :
    esImportacion ? 'IMPORTACION' :
    'DRY RUN'

  console.log('')
  console.log('========================================================')
  console.log(` MIGRACION HISTORICA PGL - ${modo}`)
  if (!esPrueba && !esImportacion && !esReanudacion) {
    console.log(' NO SE REALIZARA NINGUNA ESCRITURA EN SUPABASE')
  }
  console.log('========================================================')
  console.log('')

  const [baf, movil, catalogos] = await Promise.all([
    cargarExcel(ARCHIVO_BAF),
    cargarExcel(ARCHIVO_MOVIL),
    cargarCatalogos(),
  ])

  const vendedoresLtHistoricos =
    construirVendedoresLtHistoricos(baf, movil)

  if (process.argv.includes('--prueba-importacion')) {
    await ejecutarPruebaImportacion(
      catalogos,
      baf,
      movil,
      vendedoresLtHistoricos
    )
    return
  }

  const yaImportadas = new Set(
    catalogos.migracion_historica_registros.map(
      r => `${r.origen}:${r.fila_origen}`
    )
  )

  const resumen = {
    baf: {
      leidas: 0,
      listas: 0,
      advertencias: 0,
      bloqueadas: 0,
      yaImportadas: 0,
    },
    movil: {
      leidas: 0,
      porta: 0,
      lineaNueva: 0,
      listas: 0,
      advertencias: 0,
      bloqueadas: 0,
      yaImportadas: 0,
      plan20: 0,
      ventaPlan20: 0,
      sinPlan: 0,
      ventaSinPlan: 0,
      planDesdeGigas: 0,
      diferenciaPlanGigas: 0,
    },
  }

  const problemas = new Map()
  const planesBafHistoricos = new Map()
  const combinacionesBafHistoricas = new Map()
  const planes20Historicos = new Map()
  const sinPlanHistoricos = new Map()
  const companiaNoResueltaHistoricos = new Map()

  function problema(codigo, origen, fila, detalle = '') {
    if (!problemas.has(codigo)) {
      problemas.set(codigo, {
        total: 0,
        ejemplos: [],
      })
    }

    const p = problemas.get(codigo)
    p.total++

    if (p.ejemplos.length < 8) {
      p.ejemplos.push({
        origen,
        fila,
        detalle,
      })
    }
  }

  function esVentaConcretadaBaf(row) {
    return normalizar(row.getCell(30).value) === 'CARGADO'
  }

  function esVentaConcretadaMovil(row) {
    const estado = normalizar(row.getCell(29).value)

    return [
      'ACTIVA NRO PORTADO',
      'LINEA NUEVA ACTIVA',
      'LINEA NUEVA ACTIVA S/LEGAJO',
      'LINEA NUEVA ACTIVA S LEGAJO',
      'LINEA NUEVA ACTIVA S/LEGAGO',
    ].includes(estado)
  }

  for (let fila = 2; fila <= baf.rowCount; fila++) {
    const row = baf.getRow(fila)
    if (!tieneContenidoBaf(row)) continue

    resumen.baf.leidas++

    if (yaImportadas.has(`BAF:${fila}`)) {
      resumen.baf.yaImportadas++
      continue
    }

    const ingreso = fechaReal(row.getCell(2).value)

    if (!ingreso) {
      resumen.baf.bloqueadas++
      problema('BAF_FECHA_INGRESO_INVALIDA', 'BAF', fila, texto(row.getCell(2).value))
      continue
    }

    const resProducto = resolverProductoBaf(catalogos, row)

    if (
      resProducto.producto &&
      resProducto.motivo === 'PRODUCTO_BAF_HISTORICO'
    ) {
      resumen.baf.advertencias++
      problema(
        'PRODUCTO_BAF_HISTORICO',
        'BAF',
        fila,
        texto(row.getCell(12).value)
      )
    }

    if (!resProducto.producto) {
      const planHistorico = texto(row.getCell(12).value) || '(VACIO)'

      planesBafHistoricos.set(
        planHistorico,
        (planesBafHistoricos.get(planHistorico) ?? 0) + 1
      )

      if (resProducto.motivo === 'HISTORICO_A_CREAR') {
        resumen.baf.advertencias++

        const negocioHistorico =
          normalizar(planHistorico) === 'ANADIR TV'
            ? negocioDocumento(row.getCell(4).value)
            : (resProducto.negocio || negocioDocumento(row.getCell(4).value))

        const claveBafHistorica =
          `${resProducto.productoHistorico} | ${resProducto.planHistorico} | ${negocioHistorico}`

        combinacionesBafHistoricas.set(
          claveBafHistorica,
          (combinacionesBafHistoricas.get(claveBafHistorica) ?? 0) + 1
        )

        problema(
          'HISTORICO_A_CREAR',
          'BAF',
          fila,
          `${planHistorico} / ${negocioHistorico}`
        )
        continue
      }

      if (esVentaConcretadaBaf(row)) {
        resumen.baf.bloqueadas++

        problema(
          `VENTA_${resProducto.motivo}`,
          'BAF',
          fila,
          planHistorico
        )
      } else {
        resumen.baf.advertencias++

        problema(
          `NO_VENTA_${resProducto.motivo}`,
          'BAF',
          fila,
          planHistorico
        )
      }
      continue
    }

    resumen.baf.listas++
  }

  for (let fila = 2; fila <= movil.rowCount; fila++) {
    const row = movil.getRow(fila)
    if (!tieneContenidoMovil(row)) continue

    resumen.movil.leidas++

    if (yaImportadas.has(`MOVIL:${fila}`)) {
      resumen.movil.yaImportadas++
      continue
    }

    const tipo = clasificarMovil(row)

    if (tipo === 'LINEA_NUEVA') resumen.movil.lineaNueva++
    else resumen.movil.porta++

    const ingreso = fechaReal(row.getCell(3).value)

    if (!ingreso) {
      resumen.movil.bloqueadas++
      problema(
        'MOVIL_FECHA_INGRESO_INVALIDA',
        'MOVIL',
        fila,
        texto(row.getCell(3).value)
      )
      continue
    }

    const plan = planMovil(row)

    if (plan.origen === 'GIGAS') {
      resumen.movil.planDesdeGigas++
    }

    if (plan.diferencia) {
      resumen.movil.diferenciaPlanGigas++
    }

    const resProducto =
      resolverProductoMovil(catalogos, tipo, row, plan)

    if (resProducto.motivo === 'PLAN_20GB_HISTORICO') {
      resumen.movil.plan20++

      const companiaRaw = normalizar(row.getCell(11).value)
      let compania20 = 'NO_APLICA'

      if (tipo === 'PORTA') {
        if (companiaRaw.includes('MOVISTAR')) compania20 = 'MOVISTAR'
        else if (companiaRaw.includes('PERSONAL')) compania20 = 'PERSONAL'
        else if (
          companiaRaw.includes('TUENTI') ||
          companiaRaw.includes('TUENTY')
        ) compania20 = 'TUENTI'
        else compania20 = 'NO_RESUELTA'
      }

      const clave20 =
        `${tipo} | ${resProducto.negocio} | ${compania20}`

      const actual20 = planes20Historicos.get(clave20) ?? {
        total: 0,
        ventas: 0,
      }

      actual20.total++

      if (esVentaConcretadaMovil(row)) {
        resumen.movil.ventaPlan20++
        actual20.ventas++
      }

      planes20Historicos.set(clave20, actual20)
      resumen.movil.advertencias++
      problema(
        'PLAN_20GB_HISTORICO',
        'MOVIL',
        fila,
        `${tipo} / ${resProducto.negocio}`
      )
      if (!resProducto.producto) continue
    }

    if (resProducto.motivo === 'SIN_PLAN_HISTORICO') {
      resumen.movil.sinPlan++

      const claveSinPlan =
        `${tipo} | ${resProducto.negocio}`

      sinPlanHistoricos.set(
        claveSinPlan,
        (sinPlanHistoricos.get(claveSinPlan) ?? 0) + 1
      )

      if (esVentaConcretadaMovil(row)) {
        resumen.movil.ventaSinPlan++
      }
      resumen.movil.advertencias++
      problema(
        'SIN_PLAN_HISTORICO',
        'MOVIL',
        fila,
        `${tipo} / ${resProducto.negocio}`
      )
      if (!resProducto.producto) continue
    }

    if (
      resProducto.producto &&
      resProducto.motivo === 'COMPANIA_NO_RESUELTA'
    ) {
      const planTecnico =
        plan.gb ? planNormalizado(plan.gb) : 'SIN PLAN'

      const claveCompania =
        `${tipo} | ${resProducto.negocio} | ${planTecnico}`

      companiaNoResueltaHistoricos.set(
        claveCompania,
        (companiaNoResueltaHistoricos.get(claveCompania) ?? 0) + 1
      )

      resumen.movil.advertencias++
      problema(
        'NO_VENTA_COMPANIA_NO_RESUELTA',
        'MOVIL',
        fila,
        `${texto(row.getCell(11).value)} / ${texto(row.getCell(18).value)}`
      )
    }

    if (!resProducto.producto) {
      const detalleProblema =
        `${texto(row.getCell(11).value)} / ${texto(row.getCell(18).value)}`

      if (resProducto.motivo === 'COMPANIA_NO_RESUELTA') {
        const planTecnico =
          plan.gb ? planNormalizado(plan.gb) : 'SIN PLAN'

        const claveCompania =
          `${tipo} | ${resProducto.negocio} | ${planTecnico}`

        companiaNoResueltaHistoricos.set(
          claveCompania,
          (companiaNoResueltaHistoricos.get(claveCompania) ?? 0) + 1
        )
      }

      if (esVentaConcretadaMovil(row)) {
        resumen.movil.bloqueadas++
        problema(
          `VENTA_${resProducto.motivo}`,
          'MOVIL',
          fila,
          detalleProblema
        )
      } else {
        resumen.movil.advertencias++
        problema(
          `NO_VENTA_${resProducto.motivo}`,
          'MOVIL',
          fila,
          detalleProblema
        )
      }
      continue
    }

    if (
      plan.origen === 'GIGAS' ||
      plan.diferencia
    ) {
      resumen.movil.advertencias++
    }

    resumen.movil.listas++
  }

  console.log('BAF')
  console.table(resumen.baf)

  console.log('')
  console.log('MOVIL')
  console.table(resumen.movil)

  console.log('')
  console.log('PROBLEMAS / EXCEPCIONES')
  console.log('')

  for (const [codigo, p] of [...problemas.entries()].sort(
    (a, b) => b[1].total - a[1].total
  )) {
    console.log(`${codigo}: ${p.total}`)
    console.table(p.ejemplos)
  }

  console.log('')
  console.log('PLANES BAF HISTORICOS / NO RESUELTOS')
  console.table(
    [...planesBafHistoricos.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([plan, cantidad]) => ({ plan, cantidad }))
  )

  console.log('')
  console.log('COMBINACIONES BAF HISTORICAS')
  console.table(
    [...combinacionesBafHistoricas.entries()]
      .map(([combinacion, cantidad]) => ({
        combinacion,
        cantidad,
      }))
      .sort((a, b) =>
        a.combinacion.localeCompare(b.combinacion)
      )
  )

  console.log('')
  console.log('COMBINACIONES PLAN 20GB HISTORICO')
  console.table(
    [...planes20Historicos.entries()]
      .map(([combinacion, datos]) => ({
        combinacion,
        total: datos.total,
        ventas: datos.ventas,
      }))
      .sort((a, b) =>
        a.combinacion.localeCompare(b.combinacion)
      )
  )

  console.log('')
  console.log('COMBINACIONES SIN PLAN HISTORICO')
  console.table(
    [...sinPlanHistoricos.entries()]
      .map(([combinacion, cantidad]) => ({
        combinacion,
        cantidad,
      }))
      .sort((a, b) =>
        a.combinacion.localeCompare(b.combinacion)
      )
  )

  console.log('')
  console.log('COMBINACIONES COMPANIA NO RESUELTA')
  console.table(
    [...companiaNoResueltaHistoricos.entries()]
      .map(([combinacion, cantidad]) => ({
        combinacion,
        cantidad,
      }))
      .sort((a, b) =>
        a.combinacion.localeCompare(b.combinacion)
      )
  )

  console.log('')
  console.log('ESTADOS BAF PGL')
  console.table(
    catalogos.estados_baf.map(e => ({
      id: e.id,
      nombre: e.nombre,
      activo: e.activo,
    }))
  )

  console.log('')
  console.log('ESTADOS PORTA PGL')
  console.table(
    catalogos.estados_porta.map(e => ({
      id: e.id,
      nombre: e.nombre,
      activo: e.activo,
    }))
  )

  console.log('')
  console.log('ESTADOS BBOO PGL')
  console.table(
    catalogos.estados_bboo.map(e => ({
      id: e.id,
      nombre: e.nombre,
      activo: e.activo,
    }))
  )

  console.log('')
  console.log('ORIGENES ACTUALES PGL')
  console.table(
    catalogos.catalogo_origenes
      .map(o => ({
        id: o.id,
        nombre: o.nombre,
        activo: o.activo,
      }))
      .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)))
  )

  console.log('')
  console.log('CATALOGOS CONSULTADOS')
  console.table({
    productos: catalogos.productos.length,
    estados_baf: catalogos.estados_baf.length,
    estados_porta: catalogos.estados_porta.length,
    estados_bboo: catalogos.estados_bboo.length,
    profiles: catalogos.profiles.length,
    origenes: catalogos.catalogo_origenes.length,
    zonas: catalogos.catalogo_zonas.length,
    tipos_domicilio: catalogos.catalogo_tipos_domicilio.length,
    medios_despacho: catalogos.medios_despacho_chip.length,
    historicos_importados: catalogos.migracion_historica_registros.length,
  })

  console.log('')

  // ============================================================
  // DIAGNOSTICO DE IDENTIDADES HISTORICAS
  // Solo lectura. No realiza escrituras.
  // ============================================================

  const diagnosticoIdentidades = {
    vendedor: new Map(),
    responsable: new Map(),
    bboo: new Map(),
    vendedorNoResuelto: new Map(),
    responsableNoResuelto: new Map(),
    bbooNoResuelto: new Map(),
    origen: new Map(),
    metodoOrigen: new Map(),
  }

  function sumarMapa(mapa, clave) {
    mapa.set(clave, (mapa.get(clave) ?? 0) + 1)
  }

  function registrarOrigen(origenArchivo, row) {
    const r = resolverOrigenHistorico(origenArchivo, row)

    sumarMapa(
      diagnosticoIdentidades.origen,
      r.origen || '(VACIO)'
    )

    sumarMapa(
      diagnosticoIdentidades.metodoOrigen,
      r.metodo
    )
  }

  function registrarVendedor(valor) {
    const r = resolverVendedorHistorico(
      catalogos,
      valor,
      vendedoresLtHistoricos
    )
    sumarMapa(diagnosticoIdentidades.vendedor, r.metodo)

    if (!r.perfil) {
      const original = texto(valor) || '(VACIO)'
      const canonico = r.vendedorCanonico || '(SIN CANONICO)'
      const origen = r.origenMigracion || '(SIN ORIGEN)'

      sumarMapa(
        diagnosticoIdentidades.vendedorNoResuelto,
        `${original} || CANONICO: ${canonico} || ORIGEN: ${origen}`
      )
    }
  }

  function registrarResponsable(valor) {
    const r = resolverResponsableHistorico(catalogos, valor)
    sumarMapa(diagnosticoIdentidades.responsable, r.metodo)

    if (!r.perfil && r.metodo === 'SIN_RESOLVER') {
      sumarMapa(
        diagnosticoIdentidades.responsableNoResuelto,
        texto(valor) || '(VACIO)'
      )
    }
  }

  function registrarBboo(valor) {
    const r = resolverBbooHistorico(catalogos, valor)
    sumarMapa(diagnosticoIdentidades.bboo, r.metodo)

    if (!r.perfil && r.metodo === 'HISTORICO_SIN_PERFIL') {
      sumarMapa(
        diagnosticoIdentidades.bbooNoResuelto,
        texto(valor) || '(VACIO)'
      )
    }
  }

  for (let f = 2; f <= baf.rowCount; f++) {
    const row = baf.getRow(f)
    if (!tieneContenidoBaf(row)) continue

    registrarVendedor(row.getCell(3).value)
    registrarResponsable(row.getCell(1).value)
    registrarOrigen('BAF', row)
  }

  for (let f = 2; f <= movil.rowCount; f++) {
    const row = movil.getRow(f)
    if (!tieneContenidoMovil(row)) continue

    registrarVendedor(row.getCell(4).value)
    registrarResponsable(row.getCell(1).value)
    registrarBboo(row.getCell(24).value)
    registrarOrigen('MOVIL', row)
  }

  function imprimirMapa(titulo, mapa) {
    console.log('')
    console.log(titulo)

    console.table(
      [...mapa.entries()]
        .map(([valor, cantidad]) => ({ valor, cantidad }))
        .sort((a, b) =>
          b.cantidad - a.cantidad ||
          a.valor.localeCompare(b.valor)
        )
    )
  }

  console.log('')
  console.log('============================================================')
  console.log('DIAGNOSTICO DE IDENTIDADES HISTORICAS')
  console.log('============================================================')

  imprimirMapa(
    'VENDEDORES - METODO DE RESOLUCION',
    diagnosticoIdentidades.vendedor
  )

  imprimirMapa(
    'RESPONSABLES - METODO DE RESOLUCION',
    diagnosticoIdentidades.responsable
  )

  imprimirMapa(
    'BBOO - METODO DE RESOLUCION',
    diagnosticoIdentidades.bboo
  )

  imprimirMapa(
    'VENDEDORES SIN PERFIL',
    diagnosticoIdentidades.vendedorNoResuelto
  )

  imprimirMapa(
    'RESPONSABLES SIN PERFIL',
    diagnosticoIdentidades.responsableNoResuelto
  )

  imprimirMapa(
    'BBOO HISTORICOS SIN PERFIL',
    diagnosticoIdentidades.bbooNoResuelto
  )


  // Diagnóstico específico de registros cuyo origen histórico quedó vacío.
  const origenesVacios = new Map()

  function registrarOrigenVacio(origenArchivo, row) {
    const r = resolverOrigenHistorico(origenArchivo, row)
    if (r.origen) return

    const esBaf = origenArchivo === 'BAF'
    const vendedor = texto(
      row.getCell(esBaf ? 3 : 4).value
    ) || '(VACIO)'

    const estado = texto(
      row.getCell(esBaf ? 30 : 29).value
    ) || '(VACIO)'

    const venta = esBaf
      ? esVentaConcretadaBaf(row)
      : esVentaConcretadaMovil(row)

    const clave =
      `${origenArchivo} | ${venta ? 'VENTA' : 'NO VENTA'} | ${estado} | ${vendedor}`

    sumarMapa(origenesVacios, clave)
  }

  for (let f = 2; f <= baf.rowCount; f++) {
    const row = baf.getRow(f)
    if (!tieneContenidoBaf(row)) continue
    registrarOrigenVacio('BAF', row)
  }

  for (let f = 2; f <= movil.rowCount; f++) {
    const row = movil.getRow(f)
    if (!tieneContenidoMovil(row)) continue
    registrarOrigenVacio('MOVIL', row)
  }

  const diagnosticoOrigenPgl = new Map()
  const origenesPglNoResueltos = new Map()

  function validarOrigenPgl(origenArchivo, row) {
    const historico = resolverOrigenHistorico(origenArchivo, row)
    const origenPgl = normalizarOrigenPgl(historico.origen)

    const existeEnCatalogo =
      origenPgl &&
      catalogos.catalogo_origenes.some(
        o => normalizar(o.nombre) === normalizar(origenPgl)
      )

    sumarMapa(
      diagnosticoOrigenPgl,
      `${historico.origen || '(VACIO)'} -> ${origenPgl || '(NO RESUELTO)'}`
    )

    if (!existeEnCatalogo) {
      sumarMapa(
        origenesPglNoResueltos,
        `${historico.origen || '(VACIO)'} -> ${origenPgl || '(NO RESUELTO)'}`
      )
    }
  }

  for (let f = 2; f <= baf.rowCount; f++) {
    const row = baf.getRow(f)
    if (!tieneContenidoBaf(row)) continue
    validarOrigenPgl('BAF', row)
  }

  for (let f = 2; f <= movil.rowCount; f++) {
    const row = movil.getRow(f)
    if (!tieneContenidoMovil(row)) continue
    validarOrigenPgl('MOVIL', row)
  }

  console.log('')
  console.log('ORIGEN HISTORICO -> ORIGEN PGL')
  console.table(
    [...diagnosticoOrigenPgl.entries()]
      .map(([valor, cantidad]) => ({ valor, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
  )

  console.log('')
  console.log('ORIGENES PGL NO RESUELTOS')
  console.table(
    [...origenesPglNoResueltos.entries()]
      .map(([valor, cantidad]) => ({ valor, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
  )

  console.log('')
  console.log('ORIGENES VACIOS - DETALLE')
  console.table(
    [...origenesVacios.entries()]
      .map(([valor, cantidad]) => ({ valor, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
  )

  console.log('')
  console.log('ORIGENES HISTORICOS RESUELTOS')
  console.table(
    [...diagnosticoIdentidades.origen.entries()]
      .map(([valor, cantidad]) => ({ valor, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
  )

  console.log('')
  console.log('METODO DE RESOLUCION DE ORIGEN')
  console.table(
    [...diagnosticoIdentidades.metodoOrigen.entries()]
      .map(([valor, cantidad]) => ({ valor, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
  )

  /*
   * ============================================================
   * AUDITORIA DE PAYLOADS
   * ============================================================
   *
   * Construye exactamente los objetos que posteriormente recibirá
   * importar_operacion_historica(), pero NO realiza escrituras.
   */

  const auditoriaPayload = {
    total: 0,
    baf: 0,
    fwa: 0,
    porta: 0,
    lineaNueva: 0,
    validos: 0,
    invalidos: 0,
    advertencias: new Map(),
    errores: new Map(),
    ejemplosInvalidos: [],
    registrosValidos: [],
  }

  function auditarPayload(origenArchivo, fila, payload) {
    auditoriaPayload.total++

    if (payload.tipo_producto === 'BAF') {
      auditoriaPayload.baf++
    } else if (payload.tipo_producto === 'FWA') {
      auditoriaPayload.fwa++
    } else if (payload.tipo_producto === 'PORTA') {
      auditoriaPayload.porta++
    } else if (payload.tipo_producto === 'LINEA_NUEVA') {
      auditoriaPayload.lineaNueva++
    }

    const errores = []

    if (!payload.producto_id) {
      errores.push('PRODUCTO_ID_VACIO')
    }

    if (!payload.usuario_id) {
      errores.push('USUARIO_ID_VACIO')
    }

    if (!payload.fecha_hora) {
      errores.push('FECHA_HORA_VACIA')
    }

    if (!payload.vendedor) {
      errores.push('VENDEDOR_VACIO')
    }

    if (
      !['BAF', 'FWA', 'PORTA', 'LINEA_NUEVA'].includes(
        payload.tipo_producto
      )
    ) {
      errores.push(
        `TIPO_PRODUCTO_INVALIDO:${payload.tipo_producto}`
      )
    }

    for (const advertencia of payload.advertencias ?? []) {
      sumarMapa(
        auditoriaPayload.advertencias,
        advertencia
      )
    }

    if (errores.length === 0) {
      auditoriaPayload.validos++

      auditoriaPayload.registrosValidos.push({
        origen: origenArchivo,
        fila,
        payload,
      })

      return
    }

    auditoriaPayload.invalidos++

    for (const error of errores) {
      sumarMapa(auditoriaPayload.errores, error)
    }

    if (auditoriaPayload.ejemplosInvalidos.length < 30) {
      auditoriaPayload.ejemplosInvalidos.push({
        origen: origenArchivo,
        fila,
        tipo_producto: payload.tipo_producto,
        producto_id: payload.producto_id,
        vendedor: payload.vendedor,
        fecha_hora: payload.fecha_hora,
        errores: errores.join(' | '),
      })
    }
  }

  for (let f = 2; f <= baf.rowCount; f++) {
    const row = baf.getRow(f)
    if (!tieneContenidoBaf(row)) continue

    try {
      const payload = construirRegistroBaf(
        catalogos,
        row,
        f,
        vendedoresLtHistoricos
      )

      auditarPayload('BAF', f, payload)
    } catch (error) {
      auditoriaPayload.total++
      auditoriaPayload.invalidos++

      const mensaje =
        `EXCEPCION_CONSTRUCTOR:${error?.message || error}`

      sumarMapa(auditoriaPayload.errores, mensaje)

      if (auditoriaPayload.ejemplosInvalidos.length < 30) {
        auditoriaPayload.ejemplosInvalidos.push({
          origen: 'BAF',
          fila: f,
          tipo_producto: null,
          producto_id: null,
          vendedor: null,
          fecha_hora: null,
          errores: mensaje,
        })
      }
    }
  }

  for (let f = 2; f <= movil.rowCount; f++) {
    const row = movil.getRow(f)
    if (!tieneContenidoMovil(row)) continue

    try {
      const payload = construirRegistroMovil(
        catalogos,
        row,
        f,
        vendedoresLtHistoricos
      )

      auditarPayload('MOVIL', f, payload)
    } catch (error) {
      auditoriaPayload.total++
      auditoriaPayload.invalidos++

      const mensaje =
        `EXCEPCION_CONSTRUCTOR:${error?.message || error}`

      sumarMapa(auditoriaPayload.errores, mensaje)

      if (auditoriaPayload.ejemplosInvalidos.length < 30) {
        auditoriaPayload.ejemplosInvalidos.push({
          origen: 'MOVIL',
          fila: f,
          tipo_producto: null,
          producto_id: null,
          vendedor: null,
          fecha_hora: null,
          errores: mensaje,
        })
      }
    }
  }

  console.log('')
  console.log('============================================================')
  console.log('AUDITORIA DE PAYLOADS - SIN ESCRITURAS')
  console.log('============================================================')

  console.table([{
    total: auditoriaPayload.total,
    BAF: auditoriaPayload.baf,
    FWA: auditoriaPayload.fwa,
    PORTA: auditoriaPayload.porta,
    LINEA_NUEVA: auditoriaPayload.lineaNueva,
    validos: auditoriaPayload.validos,
    invalidos: auditoriaPayload.invalidos,
  }])

  console.log('')
  console.log('ERRORES BLOQUEANTES DE PAYLOAD')
  console.table(
    [...auditoriaPayload.errores.entries()]
      .map(([valor, cantidad]) => ({ valor, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
  )

  console.log('')
  console.log('ADVERTENCIAS DE PAYLOAD')
  console.table(
    [...auditoriaPayload.advertencias.entries()]
      .map(([valor, cantidad]) => ({ valor, cantidad }))
      .sort((a, b) =>
        b.cantidad - a.cantidad ||
        a.valor.localeCompare(b.valor)
      )
  )

  if (auditoriaPayload.ejemplosInvalidos.length) {
    console.log('')
    console.log('EJEMPLOS DE PAYLOADS INVALIDOS')
    console.table(auditoriaPayload.ejemplosInvalidos)
  }

  const indiceReanudar = process.argv.indexOf('--reanudar-lote')

  if (indiceReanudar !== -1) {
    const loteId = Number(process.argv[indiceReanudar + 1])

    if (!Number.isInteger(loteId) || loteId <= 0) {
      throw new Error(
        'Uso correcto: --reanudar-lote <ID_LOTE>'
      )
    }

    if (
      auditoriaPayload.invalidos !== 0 ||
      auditoriaPayload.validos !== auditoriaPayload.total ||
      auditoriaPayload.registrosValidos.length !== auditoriaPayload.total
    ) {
      throw new Error(
        `REANUDACION CANCELADA: auditoría inválida. ` +
        `Total=${auditoriaPayload.total}, ` +
        `válidos=${auditoriaPayload.validos}, ` +
        `inválidos=${auditoriaPayload.invalidos}, ` +
        `registros preparados=${auditoriaPayload.registrosValidos.length}`
      )
    }

    await ejecutarReanudacionLote(
      loteId,
      auditoriaPayload.registrosValidos,
      yaImportadas
    )

    return
  }

  if (process.argv.includes('--importar')) {
    if (
      auditoriaPayload.invalidos !== 0 ||
      auditoriaPayload.validos !== auditoriaPayload.total ||
      auditoriaPayload.registrosValidos.length !== auditoriaPayload.total
    ) {
      throw new Error(
        `IMPORTACION CANCELADA: auditoría inválida. ` +
        `Total=${auditoriaPayload.total}, ` +
        `válidos=${auditoriaPayload.validos}, ` +
        `inválidos=${auditoriaPayload.invalidos}, ` +
        `registros preparados=${auditoriaPayload.registrosValidos.length}`
      )
    }

    console.log('')
    console.log(
      `AUDITORIA APROBADA: ${auditoriaPayload.validos} registros válidos, 0 inválidos.`
    )

    await ejecutarImportacionMasiva(
      auditoriaPayload.registrosValidos
    )

    return
  }

  console.log('')
  console.log('DRY RUN FINALIZADO.')
  console.log('Escrituras realizadas en Supabase: 0')
  console.log('')
}

main().catch(error => {
  console.error('')
  console.error('ERROR EN MIGRACION HISTORICA:')
  console.error(error)
  process.exit(1)
})
