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
      total_movil: 0, porta: 0, ln: 0
    }))
    const mapa = new Map(porPdv.map(p => [p.punto_venta_id, p]))
    const promociones = new Set(['3055','3065','4001','4095','5301'])
    for (let offset = 0; ; offset += LOTE) {
      const { data, error } = await admin.from('reporte_activaciones')
        .select('id,punto_venta_id,promocion')
        .not('punto_venta_id','is',null)
        .gte('fecha_activ',desde).lte('fecha_activ',hasta)
        .order('id').range(offset,offset+LOTE-1)
      if (error) throw error
      for (const fila of data ?? []) {
        const pdv = mapa.get(String(fila.punto_venta_id))
        if (pdv && promociones.has(String(fila.promocion ?? '').trim())) pdv.total_movil++
      }
      if (!data || data.length < LOTE) break
    }
    for (let offset = 0; ; offset += LOTE) {
      const { data, error } = await admin.from('reporte_tramites_portabilidad')
        .select('id,punto_venta_id,cantidad')
        .not('punto_venta_id','is',null)
        .eq('estado','ACTIVADO NRO PORTADO')
        .gte('dia_id',Number(desde.replace(/-/g,'')))
        .lte('dia_id',Number(hasta.replace(/-/g,'')))
        .order('id').range(offset,offset+LOTE-1)
      if (error) throw error
      for (const fila of data ?? []) {
        const pdv = mapa.get(String(fila.punto_venta_id))
        if (pdv) pdv.porta += Number(fila.cantidad)
      }
      if (!data || data.length < LOTE) break
    }
    for (const pdv of porPdv) pdv.ln = pdv.total_movil - pdv.porta
    const totales = porPdv.reduce((t,p) => ({
      total_movil:t.total_movil+p.total_movil, porta:t.porta+p.porta, ln:t.ln+p.ln
    }), {total_movil:0,porta:0,ln:0})
    return NextResponse.json({desde,hasta,totales,porPdv,inconsistencias:porPdv.filter(p=>p.ln<0)})
  } catch (error) {
    console.error('Dashboard móvil PDV',error)
    return NextResponse.json({error:'No se pudieron consultar los indicadores móviles PDV.'},{status:500})
  }
}
