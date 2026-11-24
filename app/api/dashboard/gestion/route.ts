import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { createAdminClient } from '../../../../utils/supabase/admin'

const LOTE = 500

type Negocio = 'baf' | 'porta' | 'ln' | 'fwa'

function normalizar(valor: unknown) {
  return String(valor ?? '').trim().toUpperCase()
}

function grupoVendedor(vendedor: string) {
  const sigla = vendedor.split(/\s+/)[0].toUpperCase()
  return /^[A-Z0-9]{2}$/.test(sigla)
    ? sigla
    : 'SIN GRUPO'
}

function fechaValida(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const fecha = new Date(valor + 'T12:00:00Z')
  return !Number.isNaN(fecha.valueOf()) &&
    fecha.toISOString().slice(0, 10) === valor
}

function normalizarPlan(valor: unknown) {
  const plan = normalizar(valor)
  const match = plan.match(/(?:^|\D)(\d+)\s*(?:GB|GIGAS?|G)(?:\b|$)/)
  return match ? `${Number(match[1])} GB` : plan || 'SIN PLAN'
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'No autenticado.' },
        { status: 401 }
      )
    }

    const { data: perfil } = await supabase
      .from('profiles')
      .select('rol,activo')
      .eq('id', user.id)
      .maybeSingle()

    if (!perfil?.activo ||
        !['ADMIN', 'SUPERVISOR'].includes(perfil.rol)) {
      return NextResponse.json(
        { error: 'Sin permisos.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const desde = searchParams.get('desde') ?? ''
    const hasta = searchParams.get('hasta') ?? ''
    const grupo = searchParams.get('grupo') ?? ''
    const vendedor = searchParams.get('vendedor') ?? ''

    if (!fechaValida(desde) ||
        !fechaValida(hasta) ||
        desde > hasta) {
      return NextResponse.json(
        { error: 'Período inválido.' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    const operaciones = new Map<string, string>()

    const vendedoresPorGrupo = new Map<string, Set<string>>()

    const finExclusivo = new Date(
      hasta + 'T00:00:00-03:00'
    )

    finExclusivo.setUTCDate(
      finExclusivo.getUTCDate() + 1
    )

    for (let offset = 0; ; offset += LOTE) {
      const { data, error } = await admin
        .from('operaciones')
        .select('id_operacion,vendedor')
        .gte('fecha_hora', desde + 'T00:00:00-03:00')
        .lt('fecha_hora', finExclusivo.toISOString())
        .order('id_operacion')
        .range(offset, offset + LOTE - 1)

      if (error) throw error

      for (const o of data ?? []) {
        const nombre =
          String(o.vendedor ?? '').trim() || 'SIN VENDEDOR'

        const sigla = grupoVendedor(nombre)

        if (!vendedoresPorGrupo.has(sigla)) {
          vendedoresPorGrupo.set(sigla, new Set())
        }

        vendedoresPorGrupo.get(sigla)!.add(nombre)

        if (grupo && grupo !== sigla) continue
        if (vendedor && vendedor !== nombre) continue

        operaciones.set(o.id_operacion, nombre)
      }

      if (!data || data.length < LOTE) break
    }

    const totales = {
      baf: 0,
      porta: 0,
      ln: 0,
      fwa: 0,
      total_movil: 0,
    }

    const composicion: Record<
      Negocio, Record<string, number>
    > = {
      baf: {},
      porta: {},
      ln: {},
      fwa: {},
    }

    const ids = [...operaciones.keys()]

    for (let pos = 0; pos < ids.length; pos += 100) {
      const bloque = ids.slice(pos, pos + 100)

      for (let offset = 0; ; offset += LOTE) {
        const { data: productos, error } = await admin
          .from('operacion_productos')
          .select('id,operacion_id,tipo_producto,plan_snapshot')
          .in('operacion_id', bloque)
          .in('tipo_producto', ['BAF', 'PORTA', 'LINEA_NUEVA'])
          .eq('activo', true)
          .order('id')
          .range(offset, offset + LOTE - 1)

        if (error) throw error
        if (!productos?.length) break

        const idsBaf = productos
          .filter(p => p.tipo_producto === 'BAF')
          .map(p => p.id)

        const idsMovil = productos
          .filter(p => p.tipo_producto !== 'BAF')
          .map(p => p.id)

        const [rBaf, rMovil] = await Promise.all([
          idsBaf.length
            ? admin.from('operacion_producto_baf')
                .select('producto_operacion_id,tv')
                .in('producto_operacion_id', idsBaf)
            : Promise.resolve({ data: [], error: null }),

          idsMovil.length
            ? admin.from('operacion_producto_movil')
                .select('producto_operacion_id,es_fwa')
                .in('producto_operacion_id', idsMovil)
            : Promise.resolve({ data: [], error: null }),
        ])

        if (rBaf.error) throw rBaf.error
        if (rMovil.error) throw rMovil.error

        const detalleBaf = new Map(
          (rBaf.data ?? []).map(d =>
            [String(d.producto_operacion_id), d.tv]
          )
        )

        const detalleMovil = new Map(
          (rMovil.data ?? []).map(d =>
            [String(d.producto_operacion_id), d.es_fwa]
          )
        )

        for (const p of productos) {
          let negocio: Negocio
          let categoria: string

          if (p.tipo_producto === 'BAF') {
            if (normalizar(p.plan_snapshot) === 'AÑADIR TV') {
              continue
            }

            negocio = 'baf'

            const tv = normalizar(
              detalleBaf.get(String(p.id))
            )

            categoria =
              ['SI', 'SÍ', 'TRUE'].includes(tv)
                ? '3PLAY'
                : ['NO', 'FALSE'].includes(tv)
                  ? '2PLAY'
                  : 'SIN CLASIFICAR'

          } else if (
            detalleMovil.get(String(p.id)) === true ||
            /\bFWA\b/i.test(String(p.plan_snapshot ?? ''))
          ) {
            negocio = 'fwa'
            categoria = 'FWA 5G 400G'

          } else {
            negocio =
              p.tipo_producto === 'PORTA' ? 'porta' : 'ln'

            categoria = normalizarPlan(p.plan_snapshot)
          }

          totales[negocio]++

          composicion[negocio][categoria] =
            (composicion[negocio][categoria] ?? 0) + 1
        }

        if (productos.length < LOTE) break
      }
    }

    totales.total_movil = totales.porta + totales.ln

    const grupos = [...vendedoresPorGrupo.entries()]
      .map(([nombre, vendedores]) => ({
        nombre,
        vendedores: [...vendedores].sort(
          (a, b) => a.localeCompare(b, 'es')
        ),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

    return NextResponse.json({
      desde,
      hasta,
      totales,
      composicion,
      grupos,
    })

  } catch (error) {
    console.error('Dashboard Call Lucom', error)

    return NextResponse.json(
      { error: 'No se pudieron consultar las ventas ingresadas.' },
      { status: 500 }
    )
  }
}
