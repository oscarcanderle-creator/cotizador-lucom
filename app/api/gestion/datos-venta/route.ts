import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../utils/supabase/admin'
import { createClient } from '../../../../utils/supabase/server'

export const runtime = 'nodejs'

const txt = (v: unknown) => String(v ?? '').trim()
const norm = (v: unknown) => txt(v).toUpperCase()
const nul = (v: unknown) => {
  const s = txt(v)
  return s === '' ? null : s
}

async function contexto(body: any) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 }) }

  const operacionId = txt(body?.operacion_id)
  const token = txt(body?.sesion_token)
  if (!operacionId || !token)
    return { error: NextResponse.json({ error: 'Falta la sesión de Gestión.' }, { status: 400 }) }

  const [{ data: profile }, { data: operacion, error: opError }, bloqueo] = await Promise.all([
    admin.from('profiles').select('rol,activo,puede_gestionar_ventas,nombre,vendedor').eq('id', user.id).maybeSingle(),
    admin.from('operaciones').select('id_operacion,cliente_id,domicilio_id').eq('id_operacion', operacionId).maybeSingle(),
    supabase.rpc('validar_bloqueo_gestion', {
      p_tipo_recurso: 'VENTA',
      p_recurso_clave: operacionId,
      p_sesion_token: token,
    }),
  ])

  if (!profile?.activo || profile.rol !== 'VENDEDOR' || profile.puede_gestionar_ventas !== true)
    return { error: NextResponse.json({ error: 'No tenés permiso para editar los datos originales.' }, { status: 403 }) }
  if (opError || !operacion)
    return { error: NextResponse.json({ error: opError?.message || 'Venta no encontrada.' }, { status: 404 }) }
  if (bloqueo.error || bloqueo.data !== true)
    return { error: NextResponse.json({ error: 'Ya no poseés el bloqueo de Gestión de esta venta.' }, { status: 409 }) }

  const { data: productos, error: pe } = await admin
    .from('operacion_productos')
    .select('id,tipo_producto')
    .eq('operacion_id', operacionId)
    .eq('activo', true)
  if (pe) throw pe

  const ids = (productos ?? []).map((p: any) => Number(p.id)).filter(Boolean)
  if (ids.length) {
    const [{ data: gm, error: ge }, { data: estados, error: ee }] = await Promise.all([
      admin.from('gestion_producto_movil').select('producto_operacion_id,estado_porta_id').in('producto_operacion_id', ids),
      admin.from('estados_porta').select('id,nombre,codigo'),
    ])
    if (ge) throw ge
    if (ee) throw ee
    const mapa = new Map((estados ?? []).map((e: any) => [Number(e.id), norm(e.nombre || e.codigo)]))
    if ((gm ?? []).some((g: any) => mapa.get(Number(g.estado_porta_id)) === 'VENTA VALIDADA'))
      return { error: NextResponse.json({ error: 'La venta ya alcanzó Estado Vendedor = Venta Validada. La carga original está bloqueada.' }, { status: 409 }) }
  }

  return { supabase, admin, user, profile, operacion, productos: productos ?? [] }
}

export async function GET(request: Request) {
  try {
    const u = new URL(request.url)
    const body = {
      operacion_id: u.searchParams.get('operacion_id'),
      sesion_token: u.searchParams.get('sesion_token'),
    }
    const c: any = await contexto(body)
    if (c.error) return c.error
    const ids = c.productos.map((p: any) => Number(p.id))

    const [cliente, domicilio, productos, baf, movil, catalogo] = await Promise.all([
      c.admin.from('clientes').select('*').eq('id', c.operacion.cliente_id).single(),
      c.admin.from('domicilios').select('*').eq('id', c.operacion.domicilio_id).single(),
      c.admin.from('operacion_productos').select('*').eq('operacion_id', body.operacion_id).eq('activo', true).order('orden'),
      ids.length ? c.admin.from('operacion_producto_baf').select('*').in('producto_operacion_id', ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? c.admin.from('operacion_producto_movil').select('*').in('producto_operacion_id', ids) : Promise.resolve({ data: [], error: null }),
      c.admin.from('productos').select('id,producto,origen,plan,precio_lista,descuento_normal,precio_cliente,beneficios').eq('activo', true).order('orden'),
    ])
    for (const r of [cliente, domicilio, productos, baf, movil, catalogo])
      if ((r as any).error) throw (r as any).error

    return NextResponse.json({
      cliente: cliente.data,
      domicilio: domicilio.data,
      productos: productos.data ?? [],
      baf: baf.data ?? [],
      movil: movil.data ?? [],
      catalogo: catalogo.data ?? [],
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'No se pudieron cargar los datos originales.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const c: any = await contexto(body)
    if (c.error) return c.error

    const nombre = txt(c.profile.vendedor) || txt(c.profile.nombre) || c.user.email || 'Usuario'
    let cantidad = 0

    async function auditar(tabla: string, campo: string, anterior: any, nuevo: any, productoId: number | null) {
      if (String(anterior ?? '') === String(nuevo ?? '')) return
      const { error } = await c.admin.from('historial_correcciones_venta').insert({
        operacion_id: body.operacion_id,
        producto_operacion_id: productoId,
        solicitud_id: null,
        tabla_origen: tabla,
        campo,
        valor_anterior: anterior == null ? null : String(anterior),
        valor_nuevo: nuevo == null ? null : String(nuevo),
        modificado_por: c.user.id,
        modificado_por_nombre: nombre,
        motivo: 'Corrección directa por Vendedor Gestor',
      })
      if (error) throw error
      cantidad++
    }

    async function actualizar(tabla: string, idCol: string, id: any, permitidos: string[], nuevos: any, productoId: number | null) {
      const { data: anterior, error } = await c.admin.from(tabla).select('*').eq(idCol, id).single()
      if (error) throw error
      const payload: Record<string, any> = {}
      for (const campo of permitidos) {
        if (!Object.prototype.hasOwnProperty.call(nuevos ?? {}, campo)) continue
        let nv: any = (nuevos ?? {})[campo]
        const av = (anterior as any)[campo]
        if (typeof av === 'boolean') nv = nv === true || norm(nv) === 'SI' || norm(nv) === 'TRUE'
        else if (typeof av === 'number' && txt(nv) !== '') nv = Number(nv)
        else nv = nul(nv)
        if (String(av ?? '') !== String(nv ?? '')) payload[campo] = nv
      }
      if (!Object.keys(payload).length) return
      const { error: ue } = await c.admin.from(tabla).update(payload).eq(idCol, id)
      if (ue) throw ue
      for (const [campo, nv] of Object.entries(payload))
        await auditar(tabla, campo, (anterior as any)[campo], nv, productoId)
    }

    await actualizar('clientes', 'id', c.operacion.cliente_id,
      ['tipo_documento','dni','nombre','apellido','fecha_nacimiento','email','telefono','telefono_alternativo'],
      body.cliente, null)

    await actualizar('domicilios', 'id', c.operacion.domicilio_id,
      ['calle_nro','piso','dpto','entre_calles','barrio','localidad','coordenadas','datos_extras'],
      body.domicilio, null)

    for (const x of body.productos ?? []) {
      const pid = Number(x.id)
      const original = c.productos.find((p: any) => Number(p.id) === pid)
      if (!original) throw new Error('Uno de los productos no pertenece a esta venta.')

      if (x.producto_id) {
        const { data: cat, error: ce } = await c.admin
          .from('productos')
          .select('id,producto,origen,plan,precio_lista,descuento_normal,precio_cliente,beneficios')
          .eq('id', Number(x.producto_id))
          .eq('activo', true)
          .single()
        if (ce) throw ce

        const { data: ant, error: ae } = await c.admin.from('operacion_productos').select('*').eq('id', pid).single()
        if (ae) throw ae
        const payload: Record<string, any> = {
          producto_id: cat.id,
          producto_snapshot: cat.producto,
          origen_snapshot: cat.origen,
          plan_snapshot: cat.plan,
          precio_lista_snapshot: cat.precio_lista,
          descuento_snapshot: cat.descuento_normal,
          precio_cliente_snapshot: cat.precio_cliente,
          beneficios_snapshot: cat.beneficios,
          updated_by: c.user.id,
        }
        const { error: ue } = await c.admin.from('operacion_productos').update(payload).eq('id', pid)
        if (ue) throw ue
        for (const campo of ['producto_id','producto_snapshot','origen_snapshot','plan_snapshot','precio_lista_snapshot','descuento_snapshot','precio_cliente_snapshot','beneficios_snapshot'])
          await auditar('operacion_productos', campo, (ant as any)[campo], payload[campo], pid)
      }

      const tipo = norm(original.tipo_producto)
      if (tipo === 'BAF')
        await actualizar('operacion_producto_baf', 'producto_operacion_id', pid,
          ['modalidad_plan','tv','cantidad_decos','horario_contacto'], x.detalle, pid)

      if (tipo === 'PORTA' || tipo === 'LINEA_NUEVA')
        await actualizar('operacion_producto_movil', 'producto_operacion_id', pid,
          ['numero_linea','nim','compania_actual','modalidad_actual','tipo_sim','linea_titular','forma_pago_modem','cuotas_modem'], x.detalle, pid)
    }

    return NextResponse.json({ ok: true, cambios: cantidad })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'No se pudieron guardar los datos originales.' }, { status: 500 })
  }
}
