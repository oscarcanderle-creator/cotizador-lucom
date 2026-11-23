import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { createAdminClient } from '../../../../utils/supabase/admin'

type Categoria = '2PLAY' | '3PLAY' | 'AÑADIR TV'
type Totales = Record<Categoria, number> & { total: number }
type Registro = {
  id: number
  punto_venta_id: string
  sds: string | null
  bloque: string | null
  promocion: string | null
  fecha_activ: string | null
  vendedor: string | null
}

type VentaAgrupada = {
  puntoVentaId: string
  sds: string
  fecha: string
  vendedor: string
  fiint5324: boolean
  fiint5325: boolean
  xictv: boolean
}

const LOTE = 500

function fechaValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const fecha = new Date(`${valor}T12:00:00Z`)
  return !Number.isNaN(fecha.valueOf()) && fecha.toISOString().slice(0, 10) === valor
}

function vacio(): Totales {
  return { '2PLAY': 0, '3PLAY': 0, 'AÑADIR TV': 0, total: 0 }
}

function sumar(totales: Totales, categoria: Categoria): void {
  totales[categoria]++
  totales.total++
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

    const nombres = new Map((puntos ?? []).map(p => [p.id, p.nombre]))
    const agrupadas = new Map<string, VentaAgrupada>()

    // Se leen todos los registros del período, con paginación explícita.
    // Cada SDS se clasifica una sola vez por PDV.
    for (let offset = 0; ; offset += LOTE) {
      const { data, error } = await admin
        .from('reporte_activaciones')
        .select('id,punto_venta_id,sds,bloque,promocion,fecha_activ,vendedor')
        .not('punto_venta_id', 'is', null)
        .not('sds', 'is', null)
        .gte('fecha_activ', desde)
        .lte('fecha_activ', hasta)
        .order('id')
        .range(offset, offset + LOTE - 1)
      if (error) throw error

      for (const registro of (data ?? []) as Registro[]) {
        const sds = String(registro.sds ?? '').trim().toUpperCase()
        const bloque = String(registro.bloque ?? '').trim().toUpperCase()
        const promocion = String(registro.promocion ?? '').trim()
        if (!sds || !['FIINT', 'XICTV'].includes(bloque)) continue

        const clave = `${registro.punto_venta_id}\u0000${sds}`
        let venta = agrupadas.get(clave)
        if (!venta) {
          venta = {
            puntoVentaId: registro.punto_venta_id,
            sds,
            fecha: registro.fecha_activ ?? '',
            vendedor: String(registro.vendedor ?? '').trim() || 'SIN VENDEDOR',
            fiint5324: false,
            fiint5325: false,
            xictv: false,
          }
          agrupadas.set(clave, venta)
        }

        // Las filas FIINT son la referencia de fecha/vendedor cuando existen.
        if (bloque === 'FIINT') {
          venta.fecha = registro.fecha_activ ?? venta.fecha
          venta.vendedor = String(registro.vendedor ?? '').trim() || 'SIN VENDEDOR'
        }
        if (bloque === 'FIINT' && promocion === '5324') venta.fiint5324 = true
        if (bloque === 'FIINT' && promocion === '5325') venta.fiint5325 = true
        if (bloque === 'XICTV') venta.xictv = true
      }
      if (!data || data.length < LOTE) break
    }

    const totales = vacio()
    const porPdv = new Map<string, {
      punto_venta_id: string
      punto_venta: string
      totales: Totales
      vendedores: Record<string, Totales>
    }>()
    const diarios: Record<string, Totales> = {}

    for (const venta of agrupadas.values()) {
      let categoria: Categoria | null = null
      if (venta.sds.endsWith('FAE') && venta.fiint5324) {
        categoria = '2PLAY'
      } else if (venta.sds.endsWith('TAE') && venta.fiint5325 && venta.xictv) {
        categoria = '3PLAY'
      } else if (venta.sds.endsWith('TAE') && venta.xictv && !venta.fiint5325) {
        categoria = 'AÑADIR TV'
      }
      if (!categoria) continue

      sumar(totales, categoria)
      if (!porPdv.has(venta.puntoVentaId)) {
        porPdv.set(venta.puntoVentaId, {
          punto_venta_id: venta.puntoVentaId,
          punto_venta: nombres.get(venta.puntoVentaId) ?? 'PDV SIN NOMBRE',
          totales: vacio(),
          vendedores: {},
        })
      }
      const pdv = porPdv.get(venta.puntoVentaId)!
      sumar(pdv.totales, categoria)
      pdv.vendedores[venta.vendedor] ??= vacio()
      sumar(pdv.vendedores[venta.vendedor], categoria)
      diarios[venta.fecha] ??= vacio()
      sumar(diarios[venta.fecha], categoria)
    }

    return NextResponse.json({
      desde,
      hasta,
      totales,
      porPdv: [...porPdv.values()].sort((a, b) => a.punto_venta.localeCompare(b.punto_venta)),
      diarios,
    })
  } catch (error) {
    console.error('Dashboard PDV BAF', error)
    return NextResponse.json({ error: 'No se pudieron consultar los indicadores BAF PDV.' }, { status: 500 })
  }
}
