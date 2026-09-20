import { NextResponse } from 'next/server'

import { leerCsvClaro } from '../../../../../lib/reportes/leerCsvClaro'
import { leerXlsxClaro } from '../../../../../lib/reportes/leerXlsxClaro'
import { createClient } from '../../../../../utils/supabase/server'
import { createAdminClient } from '../../../../../utils/supabase/admin'

const ROLES_PERMITIDOS = new Set(['ADMIN', 'SUPERVISOR', 'BBOO'])

const ENCABEZADOS_ITEC = [
  'Tipo PSR',
  'Codigo PSR',
  'Nombre PSR',
  'Calle',
  'Altura',
  'Nombre y Apellido',
  'Numero de telefono',
  'Localidad',
  'Provincia',
  'Zona',
  'Frecuencia',
  'Caminante',
  'Modalidad',
  'Fecha Ultima Compra',
  'Fecha Ultima Visita',
  'Rubro',
  'Nro. POS',
  'Codigo Postal',
  'CUIT del dueno del PSR',
  'DNI del dueno del PSR',
  'Razon Social',
  'Territorio',
  'Region',
  'Agente',
  'Latitud en ITEC',
  'Longitud en ITEC',
  'Latitud del Censo',
  'Longitud del Censo',
  'Fecha Creacion PSR',
  'Supervisor',
  'Gerente Regional',
  'Gerente Nacional',
  'Pickup',
  'Recupero',
]

const ENCABEZADOS_FIJA = [
  'Mes Carga',
  'Fecha de Carga',
  'SDS',
  'OT',
  'Calle',
  'Número',
  'ESTADO_AGENDA',
  'Motivo de Cierre',
  'Fecha de Instalación',
  'Ciudad',
  'Partido',
  'Provincia',
  'Negocio',
  'Promo',
  'Plan',
  'NOMBRE_OFICIAL',
  'Entidad de Ventas',
  'Oficina de ventas',
  'ENT_ID_PADRE',
  'FECHA_SCHEDULE',
  'VA_FLAG_EDIF',
]

const ENCABEZADOS_WFM = [
  'NRO. OT',
  'NRO. SERVICIO',
  'ESTADO',
  'TRÁMITE',
  'TECNOLOGÍA',
  'DÍA INST.',
  'ID CONTRATISTA',
  'CONTRATISTA',
  'TÉCNICO',
  'FECHA CIERRE',
  'MOTIVO CIERRE',
  'NRO. CLIENTE',
  'CLIENTE',
  'SEGMENTO',
  'LOCALIDAD',
  'DOMICILIO',
  'PROVINCIA',
  'SDS INST.',
  'CONTRATISTA INST.',
  'FECHA CIERRE INST.',
  'REINC.',
  'GARANTÍA',
  'USUARIO',
  'ORDEN ANTERIOR',
  'MOTIVO ASIGNACIÓN',
  'CUENTA',
  'FECHA CREACIÓN',
  'FECHA CREACIÓN ASIGNACIÓN',
  'TIPO DE SERVICIO',
  'TIPO DE DECODIFICADOR',
  'CANTIDAD TV',
  'INTERNET ANTERIOR',
  'AGENTE COMERCIAL',
]

const ENCABEZADOS_ACTIVACIONES = [
  'Store',
  'Agente',
  'Subagente',
  'Coordinador',
  'Vendedor',
  'DNI Vendedor',
  'Entidad',
  'SDS',
  'Nim',
  'NSE',
  'IMEI',
  'Cuenta',
  'Titular',
  'Bloque',
  'Mercado',
  'Equipo',
  'Promoción',
  'Plan',
  'Forma-pago',
  'Fecha-Activ',
  'Fecha-Venta',
  'Presuspendida',
  'POS',
  'Nombre-POS',
  'Ciudad-POS',
  'Dpto/Pcia-POS',
]


const ENCABEZADOS_CATER = [

  'Agencia',

  'Entidad Hija',

  'DNI-Vendedor',

  'Nim',

  'Bill-Number',

  'Cuenta',

  'Apellido',

  'Nombre',

  'Cond-IVA',

  'Terminal',

  'Pro Model',

  'IMEI',

  'SIM',

  'Fecha-Migracion',

  'TipoVenta',

  'Forma-Pago',

  'Forma-Pago Description',

  'Monto-Partida',

  'Cod-NewPrince',

  'NroCupon',

  'Subsidio Remanente',

  'Cater Sds Id',

  'Eft',

  'Ch',

  'F',

  'Td',

  'Tc',

  'Otro',

]


function limpiar(valor: unknown): string {
  return String(valor ?? '').trim()
}

function valorONull(valor: unknown): string | null {
  const texto = limpiar(valor)
  return texto === '' ? null : texto
}

function fechaExcelADate(valor: unknown): string | null {
  const texto = limpiar(valor)

  if (!texto) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return texto
  }

  const fechaDmy = texto.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/,
  )

  if (fechaDmy) {
    const dia = Number(fechaDmy[1])
    const mes = Number(fechaDmy[2])
    const anio = Number(fechaDmy[3])

    const fecha = new Date(Date.UTC(anio, mes - 1, dia))

    if (
      fecha.getUTCFullYear() !== anio ||
      fecha.getUTCMonth() !== mes - 1 ||
      fecha.getUTCDate() !== dia
    ) {
      throw new Error(`Fecha Excel inválida: ${texto}`)
    }

    return [
      String(anio).padStart(4, '0'),
      String(mes).padStart(2, '0'),
      String(dia).padStart(2, '0'),
    ].join('-')
  }

  const serial = Number(texto)

  if (!Number.isFinite(serial)) {
    throw new Error(`Fecha Excel inválida: ${texto}`)
  }

  const dias = Math.floor(serial)
  const fecha = new Date((dias - 25569) * 86400 * 1000)

  if (Number.isNaN(fecha.getTime())) {
    throw new Error(`Fecha Excel inválida: ${texto}`)
  }

  return fecha.toISOString().slice(0, 10)
}

function convertirFechaConContexto(
  valor: unknown,
  campo: string,
  filaExcel: number,
) {
  try {
    return fechaExcelADate(valor)
  } catch {
    throw new Error(
      `Fila Excel ${filaExcel} · ${campo} · valor inválido: ${limpiar(valor)}`,
    )
  }
}

function transformarFilaItec(fila: string[]) {
  return {
    // B - Codigo PSR
    codigo_psr: limpiar(fila[1]),

    // G - Numero de telefono
    telefono: valorONull(fila[6]),

    // L - Caminante
    caminante: valorONull(fila[11]),

    // P - Rubro
    // Ésta es la clasificación que Lucom necesita
    // (por ejemplo PSR / 4x4). No usamos "Tipo PSR" de A.
    tipo_psr: valorONull(fila[15]),

    // Q - Nro. POS
    nro_pos: valorONull(fila[16]),
  }
}

function transformarFilaFija(fila: string[], indice: number) {
  const filaExcel = indice + 2

  return {
    mes_carga: valorONull(fila[0]),
    fecha_carga: convertirFechaConContexto(
      fila[1],
      'Fecha de Carga',
      filaExcel,
    ),
    sds: limpiar(fila[2]),
    ot: valorONull(fila[3]),
    calle: valorONull(fila[4]),
    numero: valorONull(fila[5]),
    estado_agenda: valorONull(fila[6]),
    motivo_cierre: valorONull(fila[7]),
    fecha_instalacion: convertirFechaConContexto(
      fila[8],
      'Fecha de Instalación',
      filaExcel,
    ),
    ciudad: valorONull(fila[9]),
    partido: valorONull(fila[10]),
    provincia: valorONull(fila[11]),
    negocio: valorONull(fila[12]),
    promo: valorONull(fila[13]),
    plan: valorONull(fila[14]),
    nombre_oficial: valorONull(fila[15]),
    entidad_ventas: valorONull(fila[16]),
    oficina_ventas: valorONull(fila[17]),
    ent_id_padre: valorONull(fila[18]),
    fecha_schedule: convertirFechaConContexto(
      fila[19],
      'FECHA_SCHEDULE',
      filaExcel,
    ),
    va_flag_edif: valorONull(fila[20]),
  }
}

function transformarFilaWfm(fila: string[], indice: number) {
  const filaExcel = indice + 2

  return {
    nro_ot: limpiar(fila[0]),
    dia_inst: convertirFechaConContexto(
      fila[5],
      'DÍA INST.',
      filaExcel,
    ),
    contratista: valorONull(fila[7]),
    tecnico: valorONull(fila[8]),
    fecha_cierre: convertirFechaConContexto(
      fila[9],
      'FECHA CIERRE',
      filaExcel,
    ),
    motivo_cierre: valorONull(fila[10]),
    nro_cliente: valorONull(fila[11]),
    cliente: valorONull(fila[12]),
    localidad: valorONull(fila[14]),
    domicilio: valorONull(fila[15]),
    provincia: valorONull(fila[16]),
    usuario: valorONull(fila[22]),
    fecha_creacion: convertirFechaConContexto(
      fila[26],
      'FECHA CREACIÓN',
      filaExcel,
    ),
    tipo_servicio: valorONull(fila[28]),
    agente_comercial: valorONull(fila[32]),
  }
}

function transformarFilaActivaciones(
  fila: string[],
  indice: number,
) {
  const filaExcel = indice + 2

  return {
    // C - Subagente
    subagente: valorONull(fila[2]),
    // D - Coordinador
    coordinador: valorONull(fila[3]),
    // E - Vendedor
    vendedor: valorONull(fila[4]),
    // F - DNI Vendedor
    dni_vendedor: valorONull(fila[5]),
    // G - Entidad
    entidad: valorONull(fila[6]),
    // H - SDS
    sds: valorONull(fila[7]),
    // I - Nim
    nim: limpiar(fila[8]),
    // J - NSE
    nse: valorONull(fila[9]),
    // K - IMEI
    imei: valorONull(fila[10]),
    // L - Cuenta
    cuenta: valorONull(fila[11]),
    // M - Titular
    titular: valorONull(fila[12]),
    // N - Bloque
    bloque: valorONull(fila[13]),
    // P - Equipo
    equipo: valorONull(fila[15]),
    // Q - Promoción
    promocion: valorONull(fila[16]),
    // R - Plan
    plan: valorONull(fila[17]),
    // T - Fecha-Activ
    fecha_activ: convertirFechaConContexto(
      fila[19],
      'Fecha-Activ',
      filaExcel,
    ),
    // U - Fecha-Venta
    fecha_venta: convertirFechaConContexto(
      fila[20],
      'Fecha-Venta',
      filaExcel,
    ),
    // V - Presuspendida
    presuspendida: valorONull(fila[21]),
    // X - Nombre-POS
    nombre_pos: valorONull(fila[23]),
  }
}

function transformarFilaCater(
  fila: string[],
  indice: number,
) {
  const filaExcel = indice + 2

  return {
    // A - Agencia
    agencia: valorONull(fila[0]),

    // B - Entidad Hija
    entidad_hija: valorONull(fila[1]),

    // C - DNI-Vendedor
    dni_vendedor: valorONull(fila[2]),

    // D - Nim
    nim: valorONull(fila[3]),

    // E - Bill-Number (clave natural)
    bill_number: limpiar(fila[4]),

    // F - Cuenta
    cuenta: valorONull(fila[5]),

    // G - Apellido
    apellido: valorONull(fila[6]),

    // H - Nombre
    nombre: valorONull(fila[7]),

    // I - Cond-IVA
    cond_iva: valorONull(fila[8]),

    // J - Terminal
    terminal: valorONull(fila[9]),

    // K - Pro Model
    pro_model: valorONull(fila[10]),

    // L - IMEI
    imei: valorONull(fila[11]),

    // M - SIM
    sim: valorONull(fila[12]),

    // N - Fecha-Migracion
    fecha_migracion: convertirFechaConContexto(
      fila[13],
      'Fecha-Migracion',
      filaExcel,
    ),

    // V - Cater Sds Id
    cater_sds_id: valorONull(fila[21]),
  }
}

function encabezadosCoinciden(
  recibidos: string[],
  esperados: string[],
) {
  return (
    recibidos.length === esperados.length &&
    esperados.every(
      (encabezado, indice) =>
        recibidos[indice] === encabezado,
    )
  )
}

function buscarDuplicados(
  filas: string[][],
  indice: number,
): string[] {
  const vistos = new Set<string>()
  const duplicados = new Set<string>()

  for (const fila of filas) {
    const valor = limpiar(fila[indice])

    // Para teléfono y POS los vacíos son admitidos.
    if (!valor) continue

    if (vistos.has(valor)) {
      duplicados.add(valor)
    } else {
      vistos.add(valor)
    }
  }

  return Array.from(duplicados)
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'No autenticado.' },
        { status: 401 },
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('rol, activo')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.activo) {
      return NextResponse.json(
        { error: 'Usuario inactivo.' },
        { status: 403 },
      )
    }

    const rol = String(profile.rol ?? '').toUpperCase()

    if (!ROLES_PERMITIDOS.has(rol)) {
      return NextResponse.json(
        { error: 'No tiene permisos para importar reportes.' },
        { status: 403 },
      )
    }

    const formData = await request.formData()
    const tipo = limpiar(formData.get('tipo')).toUpperCase()
    const archivo = formData.get('archivo')

    if (
      tipo !== 'ITEC' &&
      tipo !== 'FIJA' &&
      tipo !== 'WFM' &&
      tipo !== 'ACTIVACIONES' &&
      tipo !== 'CATER'
    ) {
      return NextResponse.json(
        {
          error:
            'La importación de este tipo de reporte todavía no está implementada.',
        },
        { status: 400 },
      )
    }

    if (!(archivo instanceof File)) {
      return NextResponse.json(
        { error: 'Debe seleccionar un archivo.' },
        { status: 400 },
      )
    }

    const buffer = await archivo.arrayBuffer()

    const hoja =
      tipo === 'ITEC'
        ? await leerCsvClaro(buffer)
        : await leerXlsxClaro(buffer)

    if (hoja.filas.length === 0) {
      return NextResponse.json(
        { error: 'El archivo no contiene registros.' },
        { status: 400 },
      )
    }

    const encabezadosRecibidos = hoja.filas[0].map(limpiar)

    const encabezadosEsperados =
      tipo === 'ITEC'
        ? ENCABEZADOS_ITEC
        : tipo === 'FIJA'
          ? ENCABEZADOS_FIJA
          : tipo === 'WFM'
            ? ENCABEZADOS_WFM
            : tipo === 'ACTIVACIONES'
              ? ENCABEZADOS_ACTIVACIONES
              : ENCABEZADOS_CATER

    const nombreReporte =
      tipo === 'ITEC'
        ? 'ITEC'
        : tipo === 'FIJA'
          ? 'Reporte Fija'
          : tipo === 'WFM'
            ? 'WFM'
            : tipo === 'ACTIVACIONES'
              ? 'Activaciones'
              : 'CATER'

    if (
      !encabezadosCoinciden(
        encabezadosRecibidos,
        encabezadosEsperados,
      )
    ) {
      return NextResponse.json(
        {
          error:
            `El archivo seleccionado no corresponde al formato esperado de ${nombreReporte}.`,
        },
        { status: 400 },
      )
    }

    const registros = hoja.filas
      .slice(1)
      .filter((fila) =>
        fila.some((valor) => limpiar(valor) !== ''),
      )
      .filter((fila) => {
        const primeraColumna = limpiar(fila[0])
        return !primeraColumna.startsWith('Filtros aplicados:')
      })

    const indiceClave =
      tipo === 'ITEC'
        ? 1
        : tipo === 'FIJA'
          ? 2
          : tipo === 'WFM'
            ? 0
            : tipo === 'ACTIVACIONES'
              ? 8
              : 4

    const filasBaseValidas = registros.filter((fila) => {
      if (limpiar(fila[indiceClave]) === '') {
        return false
      }

      if (tipo === 'ACTIVACIONES') {
        const promocion = limpiar(fila[16])
        if (promocion === '1175' || promocion === '1185') {
          return false
        }
      }

      return true
    })

    /*
     * La clave natural de cada reporte debe ser única.
     * En ITEC la clave natural continúa siendo Codigo PSR.
     */
    const clavesDuplicadas =
      buscarDuplicados(filasBaseValidas, indiceClave)

    if (clavesDuplicadas.length > 0) {
      const nombreClave =
        tipo === 'ITEC'
          ? 'Codigo PSR'
          : tipo === 'FIJA'
            ? 'SDS'
            : tipo === 'WFM'
              ? 'NRO. OT'
              : tipo === 'ACTIVACIONES'
                ? 'Nim'
                : 'Bill-Number'

      return NextResponse.json(
        {
          error:
            `El archivo contiene ${nombreClave} duplicados. La importación fue cancelada.`,
          cantidad_duplicados: clavesDuplicadas.length,
          claves_duplicadas: clavesDuplicadas.slice(0, 20),
        },
        { status: 400 },
      )
    }

    /*
     * ITEC:
     *
     * G - Numero de telefono
     * Q - Nro. POS
     *
     * Los valores vacíos son admitidos.
     * Si un valor informado aparece más de una vez, se descartan
     * TODAS las filas involucradas en ese duplicado.
     *
     * La existencia de estos duplicados no cancela la importación.
     */
    let filasValidas = filasBaseValidas

    if (tipo === 'ITEC') {
      const telefonosDuplicados = new Set(
        buscarDuplicados(filasBaseValidas, 6),
      )

      const posDuplicados = new Set(
        buscarDuplicados(filasBaseValidas, 16),
      )

      filasValidas = filasBaseValidas.filter((fila) => {
        const telefono = limpiar(fila[6])
        const nroPos = limpiar(fila[16])

        return !(
          (telefono && telefonosDuplicados.has(telefono)) ||
          (nroPos && posDuplicados.has(nroPos))
        )
      })
    }

    const registrosDescartados =
      registros.length - filasValidas.length

    const registrosTransformados =
      tipo === 'ITEC'
        ? filasValidas.map(transformarFilaItec)
        : tipo === 'FIJA'
          ? filasValidas.map(transformarFilaFija)
          : tipo === 'WFM'
            ? filasValidas.map(transformarFilaWfm)
            : tipo === 'ACTIVACIONES'
              ? filasValidas.map(transformarFilaActivaciones)
              : filasValidas.map(transformarFilaCater)

    const admin = createAdminClient()

    const nombreRpc =
      tipo === 'ITEC'
        ? 'importar_reporte_itec'
        : tipo === 'FIJA'
          ? 'importar_reporte_fija'
          : tipo === 'WFM'
            ? 'importar_reporte_wfm'
            : tipo === 'ACTIVACIONES'
              ? 'importar_reporte_activaciones'
              : 'importar_reporte_cater'

    const parametrosRpc =
      (tipo === 'ACTIVACIONES' || tipo === 'CATER')
        ? {
            p_usuario_id: user.id,
            p_archivo_original: archivo.name,
            p_registros_encontrados: registros.length,
            p_registros_descartados: registrosDescartados,
            p_datos: registrosTransformados,
          }
        : {
            p_usuario_id: user.id,
            p_archivo_original: archivo.name,
            p_registros_encontrados: registros.length,
            p_registros_descartados: registrosDescartados,
            p_registros: registrosTransformados,
          }

    const { data, error } = await admin.rpc(
      nombreRpc,
      parametrosRpc,
    )

    if (error) {
      throw error
    }

    return NextResponse.json({
      ...data,
      reporte: nombreReporte,
      archivo: archivo.name,
      mensaje: `${nombreReporte} importado correctamente.`,
    })
  } catch (error: any) {
    console.error('confirmar importacion reporte', error)

    return NextResponse.json(
      {
        error:
          error?.message ||
          'No se pudo importar el archivo seleccionado.',
      },
      { status: 500 },
    )
  }
}
