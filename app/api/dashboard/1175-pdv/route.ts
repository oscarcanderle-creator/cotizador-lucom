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
      total: 0
    }))
    const mapa = new Map(porPdv.map(p => [p.punto_venta_id, p]))
    const diarios: Record<string, number> = {}
    let total = 0
    for (let offset = 0; ; offset += LOTE) {
      const { data, error } = await admin.from('distribucion_r3')
        .select('id,punto_venta_id,rubro,fecha_primera_carga')
        .not('punto_venta_id','is',null)
        .gte('fecha_primera_carga',desde).lte('fecha_primera_carga',hasta)
        .order('id').range(offset,offset+LOTE-1)
      if (error) throw error
      for (const fila of data ?? []) {
        const pdv = mapa.get(String(fila.punto_venta_id))
        if (!pdv || String(fila.rubro ?? '').trim().toUpperCase() !== 'LOCAL CLARO EXCLUSIVO') continue
        pdv.total++
        total++
        const fecha = String(fila.fecha_primera_carga)
        diarios[fecha] = (diarios[fecha] ?? 0) + 1
      }
      if (!data || data.length < LOTE) break
    }
    return NextResponse.json({desde,hasta,total,porPdv,diarios})
  } catch (error) {
    console.error('Dashboard 1175 PDV',error)
    return NextResponse.json({error:'No se pudieron consultar las ventas 1175.'},{status:500})
  }
}
