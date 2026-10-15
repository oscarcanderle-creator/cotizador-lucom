import { NextResponse } from 'next/server'

import { leerXlsxDistribucionR3 } from '../../../../../../lib/reportes/leerXlsxDistribucionR3'
import { createClient } from '../../../../../../utils/supabase/server'
import { createAdminClient } from '../../../../../../utils/supabase/admin'

const ROLES_PERMITIDOS = new Set(['ADMIN', 'SUPERVISOR', 'BBOO'])
const TAMANO_MAXIMO = 15 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: errorUsuario } = await supabase.auth.getUser()

    if (errorUsuario || !user) {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    }

    const { data: perfil, error: errorPerfil } = await supabase
      .from('profiles')
      .select('rol, activo')
      .eq('id', user.id)
      .maybeSingle()

    if (errorPerfil) throw errorPerfil
    if (!perfil?.activo || !ROLES_PERMITIDOS.has(String(perfil.rol ?? '').toUpperCase())) {
      return NextResponse.json({ error: 'Sin permisos para importar reportes.' }, { status: 403 })
    }

    const formData = await request.formData()
    const archivo = formData.get('archivo')
    const tipo = String(formData.get('tipo') ?? '').trim().toUpperCase()

    if (tipo && tipo !== 'DISTRIBUCION_R3') {
      return NextResponse.json({ error: 'Tipo de reporte incorrecto.' }, { status: 400 })
    }
    if (!(archivo instanceof File) || !archivo.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json({ error: 'Seleccioná un archivo Excel .xlsx de Distribución R3.' }, { status: 400 })
    }
    if (archivo.size === 0 || archivo.size > TAMANO_MAXIMO) {
      return NextResponse.json({ error: 'El archivo está vacío o supera los 15 MB.' }, { status: 400 })
    }

    let lectura: Awaited<ReturnType<typeof leerXlsxDistribucionR3>>
    try {
      lectura = await leerXlsxDistribucionR3(await archivo.arrayBuffer(), archivo.name)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'No se pudo leer el Excel.' },
        { status: 400 },
      )
    }

    if (lectura.filasSinSerie.length > 0 || lectura.seriesDuplicadas.length > 0) {
      return NextResponse.json({
        error: 'El archivo contiene números de serie faltantes o duplicados. No se importó ningún registro.',
        filas_sin_serie: lectura.filasSinSerie,
        series_duplicadas: lectura.seriesDuplicadas,
      }, { status: 400 })
    }
    if (lectura.seleccionados === 0) {
      return NextResponse.json({ error: 'No hay registros de Local Claro Exclusivo para importar.' }, { status: 400 })
    }

    // La función SQL realiza todas las escrituras dentro de una única transacción.
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('importar_distribucion_r3', {
      p_registros: lectura.registros,
    })
    if (error) throw error

    if (!data || typeof data !== 'object' || data.ok !== true) {
      throw new Error('La función de importación no devolvió una confirmación válida.')
    }

    const cantidadAlertas = lectura.posDesconocidos.reduce(
      (total, pos) => total + pos.cantidad,
      0,
    )

    return NextResponse.json({
      ...data,
      ok: true,
      tipo: 'DISTRIBUCION_R3',
      reporte: 'Distribución R3',
      archivo: archivo.name,
      periodo: lectura.periodo,
      encontrados: lectura.totalFilas,
      validos: lectura.seleccionados,
      descartados: lectura.descartados,
      pos_desconocidos: lectura.posDesconocidos,
      alertas_pos: cantidadAlertas,
      mensaje: cantidadAlertas > 0
        ? `Distribución R3 importada. ATENCIÓN: ${cantidadAlertas} registros tienen POS desconocido (Nombre PSR: ALERTA!).`
        : 'Distribución R3 importada correctamente.',
    })
  } catch (error) {
    console.error('confirmar importación Distribución R3', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'No se pudo importar Distribución R3.',
    }, { status: 500 })
  }
}
