import { NextResponse } from 'next/server'

import { leerCsvClaro } from '../../../../../lib/reportes/leerCsvClaro'
import { leerXlsxClaro } from '../../../../../lib/reportes/leerXlsxClaro'
import { createClient } from '../../../../../utils/supabase/server'

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


function limpiar(valor: unknown) {
  return String(valor ?? '').trim()
}

function encabezadosCoinciden(
  recibidos: string[],
  esperados: string[],
) {
  return (
    recibidos.length === esperados.length &&
    esperados.every(
      (encabezado, indice) => recibidos[indice] === encabezado,
    )
  )
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

    if (!tipo) {
      return NextResponse.json(
        { error: 'Debe seleccionar un tipo de reporte.' },
        { status: 400 },
      )
    }

    if (!(archivo instanceof File)) {
      return NextResponse.json(
        { error: 'Debe seleccionar un archivo.' },
        { status: 400 },
      )
    }

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
            'La validación de este tipo de reporte todavía no está implementada.',
        },
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
          error: `El archivo seleccionado no corresponde al formato esperado de ${nombreReporte}.`,
          esperado: encabezadosEsperados,
          recibido: encabezadosRecibidos,
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

    /*
     * ITEC:
     * la clave obligatoria es Codigo PSR, columna B (índice 1).
     *
     * FIJA:
     * la clave obligatoria es SDS, columna C (índice 2).
     *
     * WFM:
     * la clave obligatoria es NRO. OT, columna A (índice 0).
     *
     * ACTIVACIONES:
     * la clave obligatoria es Nim, columna I (índice 8).
     * Promoción 1175 y 1185 se descartan antes de importar.
     */
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

    const registrosValidos = registros.filter((fila) => {
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

    const registrosDescartados =
      registros.length - registrosValidos.length

    return NextResponse.json({
      ok: true,
      tipo,
      reporte: nombreReporte,
      archivo: archivo.name,
      filas_archivo: hoja.cantidadFilas,
      columnas: hoja.cantidadColumnas,
      registros_encontrados: registros.length,
      registros_validos: registrosValidos.length,
      registros_descartados: registrosDescartados,
      mensaje:
        'Archivo validado correctamente. Listo para importar.',
    })
  } catch (error: any) {
    console.error('validar importacion reporte', error)

    return NextResponse.json(
      {
        error:
          error?.message ||
          'No se pudo procesar el archivo seleccionado.',
      },
      { status: 500 },
    )
  }
}
