import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { createAdminClient } from '../../../../utils/supabase/admin'

type Indicador = 'ingresadas' | 'cargadas' | 'finalizadas' | 'canceladas'
type Categoria = '2PLAY' | '3PLAY' | 'AÑADIR TV' | 'SIN CLASIFICAR'
const INDICADORES: Indicador[] = ['ingresadas', 'cargadas', 'finalizadas', 'canceladas']
const CATEGORIAS: Categoria[] = ['2PLAY', '3PLAY', 'AÑADIR TV', 'SIN CLASIFICAR']
const LOTE = 500

function extraerSigla(valor: unknown): string | null {
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
  const date = new Date(`${valor}T12:00:00Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === valor
}

function categoriaBaf(plan: string | null, sds: string | null): Categoria {
  const p = String(plan ?? '').trim().toUpperCase()
  const s = String(sds ?? '').trim().toUpperCase()
  if (p === 'AÑADIR TV') return 'AÑADIR TV'
  if (s.endsWith('FAE')) return '2PLAY'
  if (s.endsWith('TAE')) return '3PLAY'
  return 'SIN CLASIFICAR'
}

function vacio() {
  return Object.fromEntries(INDICADORES.map(i => [
    i,
    Object.fromEntries(CATEGORIAS.map(c => [c, 0])),
  ])) as Record<Indicador, Record<Categoria, number>>
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: errorAuth } = await supabase.auth.getUser()
    if (errorAuth || !user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

    const { data: perfil, error: errorPerfil } = await supabase
      .from('profiles')
      .select('rol,activo,vendedor')
      .eq('id', user.id)
      .maybeSingle()

    if (errorPerfil || !perfil?.activo) {
      return NextResponse.json({ error: 'Perfil no habilitado.' }, { status: 403 })
    }

    const rol = String(perfil.rol ?? '').toUpperCase()
    const sigla = extraerSigla(perfil.vendedor)
    const global = ['ADMIN', 'SUPERVISOR', 'BBOO'].includes(rol) ||
      (rol === 'VENDEDOR' && sigla === 'L1')
    const grupo = rol === 'VENDEDOR' && !!sigla && !global
    if (!global && !grupo) {
      return NextResponse.json({ error: 'Sin permisos para consultar el Dashboard.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const desde = searchParams.get('desde') ?? ''
    const hasta = searchParams.get('hasta') ?? ''
    if (!fechaValida(desde) || !fechaValida(hasta) || desde > hasta) {
      return NextResponse.json({ error: 'Período inválido.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const inicio = `${desde}T00:00:00-03:00`
    const fin = `${hasta}T23:59:59.999-03:00`
    const operaciones = new Map<string, { fecha_hora: string | null; vendedor: string | null }>()
    const indicadores = vacio()
    const totales = { ingresadas: 0, cargadas: 0, finalizadas: 0, canceladas: 0 }
    const diarios: Record<string, Record<Indicador, number>> = {}
    const porVendedor: Record<string, Record<Indicador, number>> = {}

    // Se consultan las operaciones del grupo permitido antes de recuperar productos.
    // Para cierres y cargas de un período, también deben considerarse ventas ingresadas antes.
    // La paginación completa evita truncar el resultado al límite predeterminado de Supabase.
    for (let offset = 0; ; offset += LOTE) {
      let consulta = admin.from('operaciones')
        .select('id_operacion,fecha_hora,vendedor')
        .eq('tipo', 'BAF')
        .order('id_operacion')
        .range(offset, offset + LOTE - 1)
      if (!global && sigla) consulta = consulta.ilike('vendedor', `${sigla} %`)
      const { data, error } = await consulta
      if (error) throw error
      for (const o of data ?? []) {
        if (!global && extraerSigla(o.vendedor) !== sigla) continue
        operaciones.set(o.id_operacion, { fecha_hora: o.fecha_hora, vendedor: o.vendedor })
      }
      if (!data || data.length < LOTE) break
    }

    const ids = [...operaciones.keys()]
    for (let pos = 0; pos < ids.length; pos += 200) {
      const bloque = ids.slice(pos, pos + 200)
      const { data: productos, error: errorProductos } = await admin
        .from('operacion_productos')
        .select('id,operacion_id,plan_snapshot')
        .eq('tipo_producto', 'BAF')
        .in('operacion_id', bloque)
      if (errorProductos) throw errorProductos
      const productosIds = (productos ?? []).map(p => p.id)
      if (!productosIds.length) continue

      const { data: gestiones, error: errorGestiones } = await admin
        .from('gestion_producto_baf')
        .select('producto_operacion_id,sds,fecha_gestion,fecha_cierre,estado_claro,estado_baf_id')
        .in('producto_operacion_id', productosIds)
      if (errorGestiones) throw errorGestiones

      const idsEstados = [...new Set((gestiones ?? []).map(g => g.estado_baf_id).filter((id): id is number => id != null))]
      const { data: estados, error: errorEstados } = idsEstados.length
        ? await admin.from('estados_baf').select('id,codigo').in('id', idsEstados)
        : { data: [], error: null }
      if (errorEstados) throw errorEstados

      const estadoPorId = new Map((estados ?? []).map(e => [e.id, String(e.codigo ?? '').trim().toUpperCase()]))
      const gestionPorProducto = new Map((gestiones ?? []).map(g => [String(g.producto_operacion_id), g]))
      for (const producto of productos ?? []) {
        const operacion = operaciones.get(producto.operacion_id)
        if (!operacion) continue
        const gestion = gestionPorProducto.get(String(producto.id))
        const categoria = categoriaBaf(producto.plan_snapshot, gestion?.sds ?? null)
        const fechaIngreso = fechaArgentina(operacion.fecha_hora)
        const fechaGestion = fechaArgentina(gestion?.fecha_gestion ?? null)
        const fechaCierre = fechaArgentina(gestion?.fecha_cierre ?? null)
        const estadoBaf = estadoPorId.get(gestion?.estado_baf_id ?? -1) ?? ''
        const estadoClaro = String(gestion?.estado_claro ?? '').trim().toUpperCase()
        function contar(indicador: Indicador, fecha: string) {
          const vendedor = String(operacion.vendedor ?? '').trim() || 'SIN VENDEDOR'
          porVendedor[vendedor] ??= { ingresadas: 0, cargadas: 0, finalizadas: 0, canceladas: 0 }
          porVendedor[vendedor][indicador]++
          totales[indicador]++
          indicadores[indicador][categoria]++
          diarios[fecha] ??= { ingresadas: 0, cargadas: 0, finalizadas: 0, canceladas: 0 }
          diarios[fecha][indicador]++
        }
        if (fechaIngreso && fechaIngreso >= desde && fechaIngreso <= hasta) contar('ingresadas', fechaIngreso)
        if (estadoBaf === 'CARGADO' && fechaGestion && fechaGestion >= desde && fechaGestion <= hasta && !!gestion?.sds?.trim()) contar('cargadas', fechaGestion)
        if (estadoClaro === 'FINALIZADA' && fechaCierre && fechaCierre >= desde && fechaCierre <= hasta) contar('finalizadas', fechaCierre)
        if (estadoClaro === 'CANCELADA' && fechaCierre && fechaCierre >= desde && fechaCierre <= hasta) contar('canceladas', fechaCierre)
      }
    }

    return NextResponse.json({ desde, hasta, totales, categorias: indicadores, diarios, porVendedor })
  } catch (error) {
    console.error('Dashboard CALL BAF', error)
    return NextResponse.json({ error: 'No se pudieron consultar los indicadores BAF.' }, { status: 500 })
  }
}
