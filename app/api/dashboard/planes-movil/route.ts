import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { createAdminClient } from '../../../../utils/supabase/admin'

const LOTE = 500
function siglaVendedor(valor: unknown): string | null {
  const token = String(valor ?? '').trim().split(/\s+/)[0]?.toUpperCase() || ''
  return /^[A-Z0-9]{2}$/.test(token) ? token : null
}
function fechaArgentina(valor: string | null): string | null {
  if (!valor) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.valueOf())) return null
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(fecha)
  const tomar = (tipo: string) => partes.find(p => p.type === tipo)?.value ?? ''
  return `${tomar('year')}-${tomar('month')}-${tomar('day')}`
}
function fechaValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const fecha = new Date(`${valor}T12:00:00Z`)
  return !Number.isNaN(fecha.valueOf()) && fecha.toISOString().slice(0, 10) === valor
}
function esFwa(plan: string | null): boolean {
  return /\bFWA\b/i.test(String(plan ?? ''))
}
function normalizarPlan(valor: string | null): string {
  const texto = String(valor ?? '').trim().toUpperCase().replace(/\s+/g, ' ')
  const coincidencia = texto.match(/(?:^|\D)(\d+)\s*(?:GB|GIGAS?|G)(?:\b|$)/)
  if (coincidencia) return `${Number(coincidencia[1])} GB`
  return texto || 'SIN PLAN'
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: errorAuth } = await supabase.auth.getUser()
    if (errorAuth || !user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    const { data: perfil, error: errorPerfil } = await supabase
      .from('profiles').select('rol,activo,vendedor').eq('id', user.id).maybeSingle()
    if (errorPerfil || !perfil?.activo) return NextResponse.json({ error: 'Perfil no habilitado.' }, { status: 403 })
    const rol = String(perfil.rol ?? '').toUpperCase()
    const sigla = siglaVendedor(perfil.vendedor)
    const global = ['ADMIN', 'SUPERVISOR', 'BBOO'].includes(rol) || (rol === 'VENDEDOR' && sigla === 'L1')
    if (!global && !(rol === 'VENDEDOR' && sigla)) {
      return NextResponse.json({ error: 'Sin permisos para consultar el Dashboard.' }, { status: 403 })
    }
    const { searchParams } = new URL(request.url)
    const desde = searchParams.get('desde') ?? ''
    const hasta = searchParams.get('hasta') ?? ''
    if (!fechaValida(desde) || !fechaValida(hasta) || desde > hasta) {
      return NextResponse.json({ error: 'Período inválido.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const ids: string[] = []
    for (let offset = 0; ; offset += LOTE) {
      let consulta = admin.from('operaciones')
        .select('id_operacion,vendedor')
        .order('id_operacion').range(offset, offset + LOTE - 1)
      if (!global && sigla) consulta = consulta.ilike('vendedor', `${sigla} %`)
      const { data, error } = await consulta
      if (error) throw error
      for (const operacion of data ?? []) {
        if (global || siglaVendedor(operacion.vendedor) === sigla) ids.push(operacion.id_operacion)
      }
      if (!data || data.length < LOTE) break
    }

    const conteos = new Map<string, { plan: string; porta: number; ln: number }>()
    let fwa = 0
    for (let pos = 0; pos < ids.length; pos += 200) {
      const { data: productos, error: errorProductos } = await admin.from('operacion_productos')
        .select('id,operacion_id,tipo_producto,plan_snapshot')
        .in('operacion_id', ids.slice(pos, pos + 200))
        .in('tipo_producto', ['PORTA', 'LINEA_NUEVA'])
        .eq('activo', true)
      if (errorProductos) throw errorProductos
      if (!productos?.length) continue
      const productoIds = productos.map(p => p.id)
      const [rGestion, rDetalle] = await Promise.all([
        admin.from('gestion_producto_movil')
          .select('producto_operacion_id,estado_bboo_id,fecha_carga_stl,plan_cargado')
          .in('producto_operacion_id', productoIds),
        admin.from('operacion_producto_movil')
          .select('producto_operacion_id,es_fwa')
          .in('producto_operacion_id', productoIds),
      ])
      if (rGestion.error) throw rGestion.error
      if (rDetalle.error) throw rDetalle.error
      const gestiones = new Map((rGestion.data ?? []).map(g => [String(g.producto_operacion_id), g]))
      const detalle = new Map((rDetalle.data ?? []).map(d => [String(d.producto_operacion_id), d]))
      const estadosIds = [...new Set((rGestion.data ?? [])
        .map(g => g.estado_bboo_id).filter((id): id is number => id != null))]
      const { data: estados, error: errorEstados } = estadosIds.length
        ? await admin.from('estados_bboo').select('id,nombre').in('id', estadosIds)
        : { data: [], error: null }
      if (errorEstados) throw errorEstados
      const estadosPorId = new Map((estados ?? []).map(e => [e.id, String(e.nombre ?? '').trim().toUpperCase()]))
      for (const producto of productos) {
        const gestion = gestiones.get(String(producto.id))
        if (!gestion || estadosPorId.get(gestion.estado_bboo_id ?? -1) !== 'CARGADO STL') continue
        const fecha = fechaArgentina(gestion.fecha_carga_stl)
        if (!fecha || fecha < desde || fecha > hasta) continue
        const planOriginal = gestion.plan_cargado || producto.plan_snapshot
        if (detalle.get(String(producto.id))?.es_fwa === true ||
          esFwa(gestion.plan_cargado) || esFwa(producto.plan_snapshot)) {
          fwa++
          continue
        }
        const plan = normalizarPlan(planOriginal)
        const fila = conteos.get(plan) ?? { plan, porta: 0, ln: 0 }
        if (producto.tipo_producto === 'PORTA') fila.porta++
        else fila.ln++
        conteos.set(plan, fila)
      }
    }
    const planes = [...conteos.values()].sort((a, b) => {
      const na = Number(a.plan.match(/^\d+/)?.[0] ?? Infinity)
      const nb = Number(b.plan.match(/^\d+/)?.[0] ?? Infinity)
      return na - nb || a.plan.localeCompare(b.plan, 'es')
    })
    const totales = planes.reduce((a, p) => ({ porta: a.porta + p.porta, ln: a.ln + p.ln }), { porta: 0, ln: 0 })
    return NextResponse.json({ desde, hasta, planes, totales, fwa })
  } catch (error) {
    console.error('Dashboard detalle planes PORTA-LN', error)
    return NextResponse.json({ error: 'No se pudo consultar el detalle de planes PORTA-LN.' }, { status: 500 })
  }
}
