import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { createAdminClient } from '../../../../utils/supabase/admin'

const LOTE = 500

function fechaValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const fecha = new Date(valor + 'T12:00:00Z')
  return !Number.isNaN(fecha.valueOf()) && fecha.toISOString().slice(0,10) === valor
}

export async function GET(request: Request) {
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
      .maybeSingle()

    if (errorPerfil || !perfil?.activo) {
      return NextResponse.json({ error: 'Perfil no habilitado.' }, { status: 403 })
    }

    const rol = String(perfil.rol ?? '').toUpperCase()
    if (!['ADMIN', 'SUPERVISOR', 'BBOO'].includes(rol)) {
      return NextResponse.json({ error: 'Sin permisos para consultar los PDV.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const desde = searchParams.get('desde') ?? ''
    const hasta = searchParams.get('hasta') ?? ''
    if (!fechaValida(desde) || !fechaValida(hasta) || desde > hasta) {
      return NextResponse.json({ error: 'Período inválido.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: puntos, error: errorPuntos } = await admin
      .from('puntos_venta')
      .select('id,nombre')
      .order('nombre')
    if (errorPuntos) throw errorPuntos

    const porPdv = (puntos ?? []).map(p => ({
      punto_venta_id: String(p.id), punto_venta: String(p.nombre),
      total: 0, vendedores: {} as Record<string, number>
    }))
    const mapa = new Map(porPdv.map(p => [p.punto_venta_id, p]))
    const diarios: Record<string, number> = {}
    const vistos = new Set<string>()
    let total = 0
    for (let offset = 0; ; offset += LOTE) {
      const { data, error } = await admin.from('reporte_cater')
        .select('id,punto_venta_id,cater_sds_id,tipo_venta,fecha_migracion,vendedor')
        .not('punto_venta_id','is',null)
        .gte('fecha_migracion',desde).lte('fecha_migracion',hasta)
        .order('id').range(offset,offset+LOTE-1)
      if (error) throw error
      for (const fila of data ?? []) {
        const pdv = mapa.get(String(fila.punto_venta_id))
        const sds = String(fila.cater_sds_id ?? '').trim()
        if (!pdv || !sds || vistos.has(sds) || String(fila.tipo_venta ?? '').trim().toUpperCase() !== 'DIST') continue
        vistos.add(sds)
        pdv.total++
        total++
        const vendedor = String(fila.vendedor ?? '').trim() || 'Sin identificar'
        pdv.vendedores[vendedor] = (pdv.vendedores[vendedor] ?? 0) + 1
        const fecha = String(fila.fecha_migracion)
        diarios[fecha] = (diarios[fecha] ?? 0) + 1
      }
      if (!data || data.length < LOTE) break
    }
    return NextResponse.json({desde,hasta,total,porPdv,diarios})
  } catch (error) {
    console.error('Dashboard CATER PDV',error)
    return NextResponse.json({error:'No se pudieron consultar las ventas CATER.'},{status:500})
  }
}
