import { NextResponse } from 'next/server'
import { createClient } from '../../../../../../utils/supabase/server'
import { leerXlsxDistribucionR3 } from '../../../../../../lib/reportes/leerXlsxDistribucionR3'

const ROLES_PERMITIDOS = new Set(['ADMIN', 'SUPERVISOR', 'BBOO'])
const TAMANO_MAXIMO = 15 * 1024 * 1024

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: errorAuth } = await supabase.auth.getUser()

    if (errorAuth || !user) {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    }

    const { data: perfil, error: errorPerfil } = await supabase
      .from('profiles')
      .select('rol,activo')
      .eq('id', user.id)
      .single()

    if (errorPerfil || !perfil?.activo ||
        !ROLES_PERMITIDOS.has(String(perfil.rol ?? '').trim().toUpperCase())) {
      return NextResponse.json({ error: 'Sin permisos para validar Distribución R3.' }, { status: 403 })
    }

    const formData = await request.formData()
    const tipo = formData.get('tipo')
    const archivo = formData.get('archivo')

    if (tipo !== 'DISTRIBUCION_R3') {
      return NextResponse.json({ error: 'Tipo de reporte incorrecto.' }, { status: 400 })
    }

    if (!(archivo instanceof File) || !archivo.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json({ error: 'Seleccioná un archivo Excel .xlsx de Distribución R3.' }, { status: 400 })
    }

    if (archivo.size === 0 || archivo.size > TAMANO_MAXIMO) {
      return NextResponse.json({ error: 'El archivo debe tener entre 1 byte y 15 MB.' }, { status: 400 })
    }

    let lectura: Awaited<ReturnType<typeof leerXlsxDistribucionR3>>
    try {
      lectura = await leerXlsxDistribucionR3(await archivo.arrayBuffer(), archivo.name)
    } catch (error) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : 'No se pudo leer el Excel de Distribución R3.',
      }, { status: 400 })
    }

    if (lectura.filasSinSerie.length > 0 || lectura.seriesDuplicadas.length > 0) {
      return NextResponse.json({
        error: `No se puede validar el archivo: ${lectura.filasSinSerie.length} filas sin número de serie y ${lectura.seriesDuplicadas.length} números de serie duplicados. Revisá el Excel.`,
        filas_sin_serie: lectura.filasSinSerie,
        series_duplicadas: lectura.seriesDuplicadas,
      }, { status: 422 })
    }

    if (lectura.seleccionados === 0) {
      return NextResponse.json({
        error: 'No se encontraron registros con Rubro «Local Claro Exclusivo».',
      }, { status: 422 })
    }

    const cantidadAlertas = lectura.posDesconocidos.reduce(
      (total, item) => total + item.cantidad, 0,
    )

    return NextResponse.json({
      ok: true,
      tipo: 'DISTRIBUCION_R3',
      reporte: 'Distribución R3',
      archivo: archivo.name,
      periodo: lectura.periodo,
      filas_archivo: lectura.totalFilas,
      columnas: 15,
      registros_encontrados: lectura.totalFilas,
      registros_validos: lectura.seleccionados,
      registros_descartados: lectura.descartados,
      pos_desconocidos: lectura.posDesconocidos,
      cantidad_alertas_pos: cantidadAlertas,
      series_duplicadas: lectura.seriesDuplicadas,
      filas_sin_serie: lectura.filasSinSerie,
      mensaje: cantidadAlertas > 0
        ? `${lectura.seleccionados} registros preparados para importar. ATENCIÓN: ${cantidadAlertas} registros tienen POS sin equivalencia; se importarán con Nombre PSR «ALERTA!».`
        : `${lectura.seleccionados} registros preparados para importar, sin alertas de POS.`,
    })
  } catch (error) {
    console.error('Error al validar Distribución R3:', error)
    return NextResponse.json({ error: 'Error interno al validar Distribución R3.' }, { status: 500 })
  }
}
