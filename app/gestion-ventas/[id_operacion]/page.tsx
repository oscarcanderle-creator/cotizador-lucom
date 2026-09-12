import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createAdminClient } from '../../../utils/supabase/admin'
import { createClient } from '../../../utils/supabase/server'
import AppHeader from '../../../components/AppHeader'
import GestionBloqueoControls from '../../../components/GestionBloqueoControls'
import GestionInputValidado from '../../../components/GestionInputValidado'
import CorreccionesVentaPanel from "../../../components/CorreccionesVentaPanel"

type Params = Promise<{
  id_operacion: string
}>

type SearchParams = Promise<{
  editar?: string
  lock?: string
}>

function mostrar(valor: unknown) {
  if (valor === null || valor === undefined || valor === '') return '-'
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No'
  return String(valor)
}

function fechaArgentina(fecha: string | null) {
  if (!fecha) return '-'

  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(fecha))
}

function fechaSimple(fecha: string | null) {
  if (!fecha) return '-'

  const [anio, mes, dia] = fecha.split('-')
  if (!anio || !mes || !dia) return fecha

  return `${dia}/${mes}/${anio}`
}

function Campo({
  label,
  value,
  ancho = false,
}: {
  label: string
  value: unknown
  ancho?: boolean
}) {
  return (
    <div className={ancho ? 'sm:col-span-2' : ''}>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </div>
      <div className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">
        {mostrar(value)}
      </div>
    </div>
  )
}


async function guardarGestionBaf(formData: FormData) {
  'use server'



  const idOperacion = String(formData.get('id_operacion') ?? '').trim()
  const estadoBafIdRaw = String(formData.get('estado_baf_id') ?? '').trim()

  if (!idOperacion) {
    throw new Error('Operación inválida.')
  }

  let estadoBafId: number | null = null

  if (estadoBafIdRaw) {
    const estadoId = Number(estadoBafIdRaw)

    if (!Number.isInteger(estadoId)) {
      throw new Error('Estado BAF inválido.')
    }

    estadoBafId = estadoId
  }

  const texto = (nombre: string) => {
    const valor = String(formData.get(nombre) ?? '').trim()
    return valor || null
  }

  const requestHeaders = await headers()
  const host =
    requestHeaders.get('x-forwarded-host') ||
    requestHeaders.get('host')

  if (!host) {
    throw new Error('No se pudo determinar el host de la aplicación.')
  }

  const protocol =
    requestHeaders.get('x-forwarded-proto') ||
    (host.includes('localhost') || host.startsWith('127.0.0.1')
      ? 'http'
      : 'https')

  const cookie = requestHeaders.get('cookie') || ''

  const response = await fetch(`${protocol}://${host}/api/gestion/venta`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      tipo: 'BAF',
      operacion_id: idOperacion,
      recurso_clave: String(formData.get('recurso_clave') ?? ''),
      sesion_token: String(formData.get('sesion_token') ?? ''),
      estado_baf_id: estadoBafId,
      prospector: texto('prospector'),
      cia_celular: texto('cia_celular'),
      sds: texto('sds'),
      orden_trabajo: texto('orden_trabajo'),
      linea_fija: texto('linea_fija'),
      fecha_instalacion: texto('fecha_instalacion'),
      ciclo_cuenta: texto('ciclo_cuenta'),
      motivo_estado: texto('motivo_estado'),
    }),
    cache: 'no-store',
  })

  const resultado = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      resultado?.error ||
        `No se pudo guardar la gestión BAF. Código HTTP ${response.status}.`
    )
  }

  revalidatePath(`/gestion-ventas/${encodeURIComponent(idOperacion)}`)
  revalidatePath('/gestion-ventas')
  revalidatePath(`/super/ventas/${encodeURIComponent(idOperacion)}`)
  revalidatePath('/super')
  redirect(`/gestion-ventas/${encodeURIComponent(idOperacion)}`)
}


async function guardarGestionPorta(formData: FormData) {
  'use server'



  const idOperacion = String(formData.get('id_operacion') ?? '').trim()
  const estadoPortaIdRaw = String(formData.get('estado_porta_id') ?? '').trim()
  const estadoBbooIdRaw = String(formData.get('estado_bboo_id') ?? '').trim()
  const bbooIdRaw = String(formData.get('bboo_id') ?? '').trim()
  const medioDespachoIdRaw = String(
    formData.get('medio_despacho_chip_id') ?? ''
  ).trim()

  if (!idOperacion) {
    throw new Error('Operación inválida.')
  }

  let estadoPortaId: number | null = null

  if (estadoPortaIdRaw) {
    const valor = Number(estadoPortaIdRaw)

    if (!Number.isInteger(valor)) {
      throw new Error('Estado PORTA inválido.')
    }

    estadoPortaId = valor
  }

  let estadoBbooId: number | null = null

  if (estadoBbooIdRaw) {
    const valor = Number(estadoBbooIdRaw)

    if (!Number.isInteger(valor)) {
      throw new Error('Estado BBOO inválido.')
    }

    estadoBbooId = valor
  }

  let medioDespachoId: number | null = null

  if (medioDespachoIdRaw) {
    const valor = Number(medioDespachoIdRaw)

    if (!Number.isInteger(valor)) {
      throw new Error('Medio de despacho CHIP inválido.')
    }

    medioDespachoId = valor
  }

  const texto = (nombre: string) => {
    const valor = String(formData.get(nombre) ?? '').trim()
    return valor || null
  }

  const booleano = (nombre: string) => {
    const valor = String(formData.get(nombre) ?? '').trim()

    if (valor === 'SI') return true
    if (valor === 'NO') return false

    return null
  }

  const requestHeaders = await headers()
  const host =
    requestHeaders.get('x-forwarded-host') ||
    requestHeaders.get('host')

  if (!host) {
    throw new Error('No se pudo determinar el host de la aplicación.')
  }

  const protocol =
    requestHeaders.get('x-forwarded-proto') ||
    (host.includes('localhost') || host.startsWith('127.0.0.1')
      ? 'http'
      : 'https')

  const cookie = requestHeaders.get('cookie') || ''

  const response = await fetch(`${protocol}://${host}/api/gestion/venta`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      tipo: 'PORTA',
      operacion_id: idOperacion,
      recurso_clave: String(formData.get('recurso_clave') ?? ''),
      sesion_token: String(formData.get('sesion_token') ?? ''),
      estado_porta_id: estadoPortaId,
      estado_bboo_id: estadoBbooId,
      bboo_id: bbooIdRaw || null,
      sim: texto('sim'),
      plan_cargado: texto('plan_cargado'),
      sds: texto('sds'),
      pin_lnva_nro: texto('pin_lnva_nro'),
      documentacion_dni: booleano('documentacion_dni'),
      medio_despacho_chip_id: medioDespachoId,
      numero_seguimiento: texto('numero_seguimiento'),
      observaciones_gestion: texto('observaciones_gestion'),
    }),
    cache: 'no-store',
  })

  const resultado = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      resultado?.error ||
        `No se pudo guardar la gestión PORTA/Línea Nueva. Código HTTP ${response.status}.`
    )
  }

  revalidatePath(`/gestion-ventas/${encodeURIComponent(idOperacion)}`)
  revalidatePath('/gestion-ventas')
  revalidatePath(`/super/ventas/${encodeURIComponent(idOperacion)}`)
  revalidatePath('/super')
  redirect('/gestion-ventas')
}

async function guardarGestionProducto(formData: FormData) {
  'use server'

  const idOperacion = String(formData.get('id_operacion') ?? '').trim()
  const productoOperacionId = Number(formData.get('producto_operacion_id') ?? 0)
  const tipoProducto = String(formData.get('tipo_producto') ?? '').trim().toUpperCase()

  if (!idOperacion || !Number.isInteger(productoOperacionId) || productoOperacionId <= 0) {
    throw new Error('Producto de operación inválido.')
  }

  const texto = (nombre: string) => {
    const valor = String(formData.get(nombre) ?? '').trim()
    return valor || null
  }

  const numero = (nombre: string) => {
    const valor = String(formData.get(nombre) ?? '').trim()
    if (!valor) return null
    const n = Number(valor)
    if (!Number.isInteger(n)) throw new Error(`${nombre} inválido.`)
    return n
  }

  const booleano = (nombre: string) => {
    const valor = String(formData.get(nombre) ?? '').trim()
    if (valor === 'SI') return true
    if (valor === 'NO') return false
    return null
  }

  const requestHeaders = await headers()
  const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host')
  if (!host) throw new Error('No se pudo determinar el host de la aplicación.')

  const protocol =
    requestHeaders.get('x-forwarded-proto') ||
    (host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
  const cookie = requestHeaders.get('cookie') || ''

  const esBaf = tipoProducto === 'BAF'
  const body: Record<string, unknown> = {
    tipo: esBaf ? 'BAF' : 'PORTA',
    operacion_id: idOperacion,
    producto_operacion_id: productoOperacionId,
    recurso_clave: String(formData.get('recurso_clave') ?? ''),
    sesion_token: String(formData.get('sesion_token') ?? ''),
    responsable_id: texto('responsable_id'),
  }

  if (esBaf) {
    Object.assign(body, {
      estado_baf_id: numero('estado_baf_id'),
      prospector: texto('prospector'),
      cia_celular: texto('cia_celular'),
      sds: texto('sds'),
      orden_trabajo: texto('orden_trabajo'),
      linea_fija: texto('linea_fija'),
      fecha_instalacion: texto('fecha_instalacion'),
      ciclo_cuenta: texto('ciclo_cuenta'),
      motivo_estado: texto('motivo_estado'),
    })
  } else {
    Object.assign(body, {
      estado_porta_id: numero('estado_porta_id'),
      estado_bboo_id: numero('estado_bboo_id'),
      bboo_id: texto('bboo_id'),
      sim: texto('sim'),
      plan_cargado: texto('plan_cargado'),
      sds: texto('sds'),
      pin_lnva_nro: texto('pin_lnva_nro'),
      documentacion_dni: booleano('documentacion_dni'),
      medio_despacho_chip_id: numero('medio_despacho_chip_id'),
      numero_seguimiento: texto('numero_seguimiento'),
      observaciones_gestion: texto('observaciones_gestion'),
    })
  }

  const response = await fetch(`${protocol}://${host}/api/gestion/venta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  const resultado = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(resultado?.error || `No se pudo guardar la gestión. Código HTTP ${response.status}.`)
  }

  revalidatePath(`/gestion-ventas/${encodeURIComponent(idOperacion)}`)
  revalidatePath('/gestion-ventas')
  revalidatePath(`/mis-ventas/${encodeURIComponent(idOperacion)}`)
  revalidatePath('/mis-ventas')
  revalidatePath(`/super/ventas/${encodeURIComponent(idOperacion)}`)
  revalidatePath('/super')
  redirect(`/gestion-ventas/${encodeURIComponent(idOperacion)}`)
}

export default async function DetalleVentaPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, rol, activo, puede_gestionar_ventas')
    .eq('id', user.id)
    .single()

  if (!profile?.activo) redirect('/login')

  const esUsuarioGestion =
    profile.activo === true &&
    (
      (profile.rol === 'VENDEDOR' && profile.puede_gestionar_ventas === true) ||
      profile.rol === 'BBOO'
    )

  if (!esUsuarioGestion) redirect('/ventas')

  // El acceso se valida con la sesión del usuario. Los datos relacionados se
  // leen con el cliente admin para evitar que las RLS de tablas hijas oculten
  // Cliente, Domicilio u operaciones_porta al Vendedor Gestor autorizado.
  const admin = createAdminClient()

  const { id_operacion } = await params
  const id = decodeURIComponent(id_operacion)

  // Estas consultas no dependen entre sí. Ejecutarlas en paralelo reduce
  // sensiblemente el tiempo de render de Gestión de Ventas.
  const [
    responsablesResult,
    estadosBafResult,
    estadosPortaResult,
    estadosBbooResult,
    planesPortaResult,
    mediosDespachoResult,
    usuariosBbooResult,
    operacionResult,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, nombre, vendedor, rol')
      .eq('activo', true)
      .eq('puede_gestionar_ventas', true)
      .order('nombre', { ascending: true }),
    supabase
      .from('estados_baf')
      .select('id, codigo, nombre, orden')
      .eq('activo', true)
      .order('orden', { ascending: true })
      .order('nombre', { ascending: true }),
    supabase
      .from('estados_porta')
      .select('id, codigo, nombre, orden')
      .eq('activo', true)
      .order('orden', { ascending: true })
      .order('nombre', { ascending: true }),
    admin
      .from('estados_bboo')
      .select('id, codigo, nombre, orden')
      .eq('activo', true)
      .order('orden', { ascending: true })
      .order('nombre', { ascending: true }),
    supabase
      .from('catalogo_planes_porta')
      .select('nombre, orden')
      .eq('activo', true)
      .order('orden', { ascending: true })
      .order('nombre', { ascending: true }),
    supabase
      .from('medios_despacho_chip')
      .select('id, nombre, orden')
      .eq('activo', true)
      .order('orden', { ascending: true })
      .order('nombre', { ascending: true }),
    supabase
      .from('profiles')
      .select('id, nombre, vendedor')
      .eq('activo', true)
      .eq('rol', 'BBOO')
      .order('nombre', { ascending: true }),
    admin
      .from('operaciones')
      .select(`
        id_operacion,
        grupo_operacion,
        tipo,
        fecha_hora,
        vendedor,
        origen_dato,
        estado_sync,
        sheet_destino,
        fila_sheet,
        error_sync,
        usuario_id,
        cliente_id,
        domicilio_id,
        cliente:clientes (
          dni,
          tipo_documento,
          nombre,
          apellido,
          fecha_nacimiento,
          email,
          telefono,
          telefono_alternativo
        ),
        domicilio:domicilios (
          calle_nro,
          piso,
          dpto,
          entre_calles,
          barrio,
          localidad,
          coordenadas,
          datos_extras
        ),
        operaciones_baf (
          tipo_domicilio,
          plan,
          tv,
          cantidad_decos,
          zona,
          horario_contacto,
          convergente,
          linea_convergente,
          modalidad_plan
        ),
        operaciones_porta (
          nim,
          es_linea_nueva,
          gigas_acordados,
          tipo_sim,
          compania_actual,
          prepago_pospago,
          observaciones,
          numero_linea
        ),
        gestion_baf (
          responsable_id,
          fecha_gestion,
          prospector,
          detalle_lead,
          cia_celular,
          sds,
          orden_trabajo,
          linea_fija,
          fecha_instalacion,
          ciclo_cuenta,
          motivo_estado,
          estado_baf_id,
          estados_baf (
            nombre
          )
        ),
        gestion_porta (
          responsable_id,
          bboo_id,
          fecha_carga_stl,
          sim,
          plan_cargado,
          sds,
          spn,
          pin_lnva_nro,
          documentacion_dni,
          medio_despacho_chip_id,
          fecha_porta,
          numero_seguimiento,
          observaciones_gestion,
          estado_porta_id,
          estado_bboo_id,
          estados_porta (
            nombre
          ),
          estados_bboo (
            nombre
          ),
          medios_despacho_chip (
            nombre
          )
        )
      `)
      .eq('id_operacion', id)
      .maybeSingle(),
  ])

  const { data: responsables, error: responsablesError } = responsablesResult
  const { data: estadosBaf, error: estadosBafError } = estadosBafResult
  const { data: estadosPorta, error: estadosPortaError } = estadosPortaResult
  const { data: estadosBboo, error: estadosBbooError } = estadosBbooResult
  const { data: planesPorta, error: planesPortaError } = planesPortaResult
  const { data: mediosDespacho, error: mediosDespachoError } = mediosDespachoResult
  const { data: usuariosBboo, error: usuariosBbooError } = usuariosBbooResult
  const { data: operacion, error } = operacionResult

  if (responsablesError) throw new Error(`No se pudieron cargar los responsables: ${responsablesError.message}`)
  if (estadosBafError) throw new Error(`No se pudieron cargar los Estados BAF: ${estadosBafError.message}`)
  if (estadosPortaError) throw new Error(`No se pudieron cargar los Estados PORTA: ${estadosPortaError.message}`)
  if (estadosBbooError) throw new Error(`No se pudieron cargar los Estados BBOO: ${estadosBbooError.message}`)
  if (planesPortaError) throw new Error(`No se pudieron cargar los planes PORTA/Línea Nueva: ${planesPortaError.message}`)
  if (mediosDespachoError) throw new Error(`No se pudieron cargar los medios de despacho CHIP: ${mediosDespachoError.message}`)
  if (usuariosBbooError) throw new Error(`No se pudieron cargar los usuarios BBOO: ${usuariosBbooError.message}`)
  if (error) throw new Error(`No se pudo cargar la venta: ${error.message}`)
  if (!operacion) notFound()

  const op: any = operacion

  const query = await searchParams
  const sesionTokenSolicitado = String(query?.lock ?? '').trim() || null
  const solicitaEdicion = query?.editar === '1' && !!sesionTokenSolicitado
  const recursoClave =
    op.tipo === 'PORTA' && op.grupo_operacion
      ? String(op.grupo_operacion)
      : String(op.id_operacion)

  const { data: bloqueoActual, error: bloqueoError } = await supabase.rpc(
    'obtener_bloqueo_gestion',
    {
      p_tipo_recurso: 'VENTA',
      p_recurso_clave: recursoClave,
    }
  )

  if (bloqueoError) {
    console.error('ERROR AL CONSULTAR BLOQUEO:', bloqueoError)

    throw new Error(
      `No se pudo comprobar el bloqueo de esta venta: ${bloqueoError.message}`
    )
  }

  const bloqueo: any = bloqueoActual ?? { bloqueado: false }
  const bloqueoVigente = bloqueo?.bloqueado === true
  const bloqueoPropio = bloqueoVigente && bloqueo?.usuario_id === user.id
  const puedeEditar =
    solicitaEdicion &&
    bloqueoPropio &&
    bloqueo?.sesion_token === sesionTokenSolicitado

  let usuarioBloqueo: string | null = null
  if (bloqueoVigente && bloqueo?.usuario_id) {
    const { data: perfilBloqueo } = await admin
      .from('profiles')
      .select('nombre,vendedor')
      .eq('id', bloqueo.usuario_id)
      .maybeSingle()
    usuarioBloqueo = perfilBloqueo?.vendedor || perfilBloqueo?.nombre || null
  }

  // ================================================================
  // NUEVA ARQUITECTURA MULTIPRODUCTO
  // Si la operación posee operacion_productos, esta rama es la fuente de verdad.
  // Las ventas históricas continúan por el flujo legacy de más abajo.
  // ================================================================
  const { data: productosMultiproducto, error: productosMultiproductoError } = await admin
    .from('operacion_productos')
    .select('*')
    .eq('operacion_id', id)
    .eq('activo', true)
    .order('orden', { ascending: true })

  if (productosMultiproductoError) {
    throw new Error(`No se pudieron cargar los productos de la operación: ${productosMultiproductoError.message}`)
  }

  if ((productosMultiproducto ?? []).length > 0) {
    const productos = productosMultiproducto ?? []
    const idsProductos = productos.map((p: any) => Number(p.id))

    const [
      bafDetalleResult,
      movilDetalleResult,
      bafGestionResult,
      movilGestionResult,
      contextoResult,
      historialProductoResult,
    ] = await Promise.all([
      admin.from('operacion_producto_baf').select('*').in('producto_operacion_id', idsProductos),
      admin.from('operacion_producto_movil').select('*').in('producto_operacion_id', idsProductos),
      admin.from('gestion_producto_baf').select('*').in('producto_operacion_id', idsProductos),
      admin.from('gestion_producto_movil').select('*').in('producto_operacion_id', idsProductos),
      admin.from('operacion_contexto_comercial').select('*').eq('operacion_id', id).maybeSingle(),
      admin
        .from('historial_producto')
        .select('id,producto_operacion_id,tipo_accion,campo,etiqueta,valor_anterior,valor_nuevo,usuario_id,rol_actor,fecha_hora,observacion')
        .in('producto_operacion_id', idsProductos)
        .order('fecha_hora', { ascending: false })
        .order('id', { ascending: false }),
    ])

    for (const resultado of [bafDetalleResult, movilDetalleResult, bafGestionResult, movilGestionResult, contextoResult, historialProductoResult]) {
      if (resultado.error) {
        throw new Error(`No se pudo cargar la gestión multiproducto: ${resultado.error.message}`)
      }
    }

    const bafDetalle = new Map((bafDetalleResult.data ?? []).map((x: any) => [Number(x.producto_operacion_id), x]))
    const movilDetalle = new Map((movilDetalleResult.data ?? []).map((x: any) => [Number(x.producto_operacion_id), x]))
    const bafGestion = new Map((bafGestionResult.data ?? []).map((x: any) => [Number(x.producto_operacion_id), x]))
    const movilGestion = new Map((movilGestionResult.data ?? []).map((x: any) => [Number(x.producto_operacion_id), x]))
    const contexto: any = contextoResult.data ?? null
    const historialProducto = historialProductoResult.data ?? []
    const idsActoresHistorial = Array.from(new Set(
      historialProducto
        .map((h: any) => String(h.usuario_id ?? '').trim())
        .filter(Boolean)
    ))
    const perfilesHistorialResult = idsActoresHistorial.length
      ? await admin.from('profiles').select('id,nombre,vendedor').in('id', idsActoresHistorial)
      : { data: [] as Array<{ id: string; nombre: string | null; vendedor: string | null }>, error: null }

    if (perfilesHistorialResult.error) {
      throw new Error(`No se pudieron cargar los usuarios del historial: ${perfilesHistorialResult.error.message}`)
    }

    const nombresActorHistorial = new Map<string, string>()
    for (const perfilHistorial of perfilesHistorialResult.data ?? []) {
      nombresActorHistorial.set(
        perfilHistorial.id,
        perfilHistorial.vendedor?.trim() || perfilHistorial.nombre?.trim() || perfilHistorial.id
      )
    }

    const historialPorProducto = new Map<number, any[]>()
    for (const evento of historialProducto) {
      const productoId = Number(evento.producto_operacion_id)
      const eventos = historialPorProducto.get(productoId) ?? []
      eventos.push(evento)
      historialPorProducto.set(productoId, eventos)
    }

    const habilitaciones = new Map<number, any>()
    const productosMoviles = productos.filter((producto: any) =>
      ['PORTA', 'LINEA_NUEVA'].includes(String(producto.tipo_producto))
    )

    const habilitacionesResult = await Promise.all(
      productosMoviles.map(async (producto: any) => {
        const { data: h, error: hError } = await admin.rpc('evaluar_habilitacion_producto_movil', {
          p_producto_operacion_id: Number(producto.id),
        })
        if (hError) throw new Error(`No se pudo evaluar la habilitación móvil: ${hError.message}`)
        return [Number(producto.id), Array.isArray(h) ? h[0] : h] as const
      })
    )

    for (const [productoId, valor] of habilitacionesResult) {
      habilitaciones.set(productoId, valor)
    }

    const clienteMulti: any = op.cliente
    const domicilioMulti: any = op.domicilio
    const nombreResponsableProducto = (idResponsable: string | null | undefined) => {
      if (!idResponsable) return 'Sin asignar'
      const r = (responsables ?? []).find((x: any) => x.id === idResponsable)
      return r?.vendedor || r?.nombre || 'Usuario no disponible'
    }

    const nombreBbooProducto = (idBboo: string | null | undefined) => {
      if (!idBboo) return 'Sin BBOO asignado'
      if (idBboo === user.id && profile.rol === 'BBOO') {
        return profile.nombre?.trim() || user.email || 'Usuario BBOO'
      }
      const r = (usuariosBboo ?? []).find((x: any) => x.id === idBboo)
      return r?.vendedor || r?.nombre || 'Usuario BBOO no disponible'
    }

    return (
      <main className="min-h-screen bg-gray-50">
        <AppHeader
          rol={profile.rol}
          usuario={profile.nombre?.trim() || user.email || 'Usuario'}
          actual="GESTION_VENTAS"
          puedeGestionarVentas={profile.puede_gestionar_ventas === true}
        />

        <div className="mx-auto max-w-6xl p-4 sm:p-8">
          <CorreccionesVentaPanel operacionId={id} />
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold text-white">MULTIPRODUCTO</span>
                {contexto?.es_conexion_full === true && (
                  <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">CONEXIÓN FULL</span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Gestión de Venta</h1>
              <p className="mt-1 break-all text-sm text-gray-500">Operación: {op.id_operacion}</p>
            </div>
            <a href="/gestion-ventas" className="text-sm font-medium text-gray-600 hover:text-gray-900">Volver a Gestión de Ventas</a>
          </div>

          <GestionBloqueoControls
            tipoRecurso="VENTA"
            recursoClave={String(op.id_operacion)}
            idOperacion={op.id_operacion}
            editando={puedeEditar}
            sesionToken={puedeEditar ? sesionTokenSolicitado : null}
            bloqueado={bloqueoVigente}
            bloqueoPropio={bloqueoPropio}
            usuarioBloqueo={usuarioBloqueo}
            bloqueadoDesde={bloqueo?.bloqueado_desde ?? null}
            autoAsignarGestion
          />

          <div className="space-y-5">
            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Operación</h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Campo label="Fecha / Hora" value={fechaArgentina(op.fecha_hora)} />
                <Campo label="Vendedor" value={op.vendedor} />
                <Campo label="Origen del dato" value={op.origen_dato} />
                <Campo label="Cantidad de productos" value={productos.length} />
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Cliente</h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Campo label="Apellido y Nombre" value={[clienteMulti?.apellido, clienteMulti?.nombre].filter(Boolean).join(', ')} />
                <Campo label="Documento" value={`${clienteMulti?.tipo_documento ? `${clienteMulti.tipo_documento} ` : ''}${clienteMulti?.dni || ''}`} />
                <Campo label="Fecha de nacimiento" value={fechaSimple(clienteMulti?.fecha_nacimiento)} />
                <Campo label="Correo electrónico" value={clienteMulti?.email} />
                <Campo label="Teléfono" value={clienteMulti?.telefono} />
                <Campo label="Teléfono alternativo" value={clienteMulti?.telefono_alternativo} />
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Domicilio</h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Campo label="Calle / Número" value={domicilioMulti?.calle_nro} />
                <Campo label="Piso / Dpto" value={[domicilioMulti?.piso, domicilioMulti?.dpto].filter(Boolean).join(' / ')} />
                <Campo label="Entre calles" value={domicilioMulti?.entre_calles} />
                <Campo label="Barrio" value={domicilioMulti?.barrio} />
                <Campo label="Localidad" value={domicilioMulti?.localidad} />
                <Campo label="Coordenadas" value={domicilioMulti?.coordenadas} />
                <Campo label="Datos extras" value={domicilioMulti?.datos_extras} ancho />
              </div>
            </section>

            {contexto?.es_conexion_full === true && (
              <section className="rounded-2xl border border-red-200 bg-red-50/40 p-5">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Conexión Full</h2>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Campo label="Modalidad" value={contexto.modalidad_conexion_full} />
                  <Campo label="Servicios convergentes" value={contexto.cantidad_servicios} />
                  <Campo label="Referencia habilitante" value={contexto.tipo_referencia_habilitante} />
                  <Campo label="Referencia" value={contexto.referencia_habilitante} />
                  <Campo label="Descuento convergencia" value={contexto.descuento_convergencia != null ? `$ ${Number(contexto.descuento_convergencia).toLocaleString('es-AR')}` : '-'} />
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-gray-900">Servicios contratados</h2>
                <span className="text-xs text-gray-500">Cada producto conserva su propia gestión y Responsable.</span>
              </div>

              <div className="space-y-5">
                {[...productos].sort((a: any, b: any) => {
                  if (a.tipo_producto === 'BAF' && b.tipo_producto !== 'BAF') return -1
                  if (b.tipo_producto === 'BAF' && a.tipo_producto !== 'BAF') return 1
                  return Number(a.orden ?? 0) - Number(b.orden ?? 0)
                }).map((producto: any) => {
                  const productoId = Number(producto.id)
                  const esBaf = producto.tipo_producto === 'BAF'
                  const esLineaNueva = producto.tipo_producto === 'LINEA_NUEVA'
                  const detalle: any = esBaf ? bafDetalle.get(productoId) : movilDetalle.get(productoId)
                  const gestion: any = esBaf ? bafGestion.get(productoId) : movilGestion.get(productoId)
                  const habilitacion: any = esBaf ? { habilitado: true, motivo: 'GESTION_BAF' } : habilitaciones.get(productoId)
                  const habilitado = esBaf || habilitacion?.habilitado === true
                  const puedeEditarProducto = puedeEditar && habilitado
                  const responsableActual = producto.responsable_id ?? gestion?.responsable_id ?? null

                  return (
                    <div key={productoId} className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50/40">
                      <div className="border-b border-gray-200 bg-white p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap gap-2">
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${esBaf ? 'bg-gray-900 text-white' : esLineaNueva ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'}`}>
                                {esBaf ? 'BAF' : esLineaNueva ? 'LÍNEA NUEVA' : 'PORTA'}
                              </span>
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${habilitado ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'}`}>
                                {habilitado ? 'Habilitado' : 'Pendiente de habilitación'}
                              </span>
                            </div>
                            <h3 className="mt-3 text-lg font-semibold text-gray-900">{producto.producto_snapshot}</h3>
                            <p className="mt-1 text-sm text-gray-600">Plan: {producto.plan_snapshot || '-'}</p>
                          </div>
                          <div className="text-right text-xs text-gray-500">
                            <div>Producto #{productoId}</div>
                            <div className="mt-1">Responsable: <span className="font-semibold text-gray-700">{nombreResponsableProducto(responsableActual)}</span></div>
                            {!esBaf && (
                              <div className="mt-1">
                                BBOO: <span className="font-semibold text-gray-700">{nombreBbooProducto(gestion?.bboo_id)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {!esBaf && detalle?.es_fwa === true && (
                          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                            <div className="mb-3 text-sm font-bold text-amber-900">FWA 5G · Módem obligatorio</div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                              <Campo
                                label="Precio Módem FWA"
                                value={detalle?.precio_modem_snapshot != null ? `$ ${Number(detalle.precio_modem_snapshot).toLocaleString('es-AR')}` : '-'}
                              />
                              <Campo
                                label="Pago Módem FWA"
                                value={
                                  detalle?.forma_pago_modem === 'CONTRA_FACTURA'
                                    ? 'Contra Factura'
                                    : detalle?.forma_pago_modem === 'EFECTIVO'
                                      ? 'Efectivo'
                                      : detalle?.forma_pago_modem === 'TARJETA'
                                        ? 'Tarjeta del Cliente'
                                        : '-'
                                }
                              />
                              <Campo label="Cuotas Módem" value={detalle?.cuotas_modem} />
                            </div>
                          </div>
                        )}

                        {!esBaf && !habilitado && (
                          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                            <div className="font-semibold">Gestión móvil bloqueada</div>
                            <div className="mt-1">{habilitacion?.motivo === 'BAF_NUEVO_PENDIENTE_OT' ? 'Falta una Orden de Trabajo BAF válida de exactamente 8 dígitos.' : habilitacion?.motivo || 'El producto todavía no está habilitado.'}</div>
                            <div className="mt-1 text-xs">Motivo técnico: {habilitacion?.motivo || '-'}</div>
                          </div>
                        )}

                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                          {esBaf ? (
                            <>
                              <Campo label="Modalidad" value={detalle?.modalidad_plan} />
                              <Campo label="TV" value={detalle?.tv} />
                              <Campo label="Cantidad DECOS" value={detalle?.cantidad_decos} />
                              <Campo label="Horario / Observaciones" value={detalle?.horario_contacto} ancho />
                            </>
                          ) : (
                            <>
                              <Campo label="NIM / Línea" value={detalle?.nim || detalle?.numero_linea} />
                              <Campo label="Compañía actual" value={detalle?.compania_actual} />
                              <Campo label="PRE / POS" value={detalle?.modalidad_actual} />
                              <Campo label="Tipo SIM" value={detalle?.tipo_sim} />
                            </>
                          )}
                        </div>
                      </div>

                      <form
                        key={`${productoId}-${gestion?.updated_at ?? 'sin-gestion'}`}
                        action={guardarGestionProducto}
                        className="p-5"
                      >
                        <input type="hidden" name="id_operacion" value={op.id_operacion} />
                        <input type="hidden" name="producto_operacion_id" value={productoId} />
                        <input type="hidden" name="tipo_producto" value={producto.tipo_producto} />
                        <input type="hidden" name="recurso_clave" value={String(op.id_operacion)} />
                        <input type="hidden" name="sesion_token" value={sesionTokenSolicitado ?? ''} />

                        <fieldset disabled={!puedeEditarProducto}>
                          <div className="mb-4 rounded-lg border border-gray-200 bg-white px-3 py-2">
                            {profile.rol === 'BBOO' && !esBaf ? (
                              <>
                                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">BBOO asignado</div>
                                <div className="mt-1 text-sm font-semibold text-gray-800">
                                  {nombreBbooProducto(gestion?.bboo_id)}
                                </div>
                                <div className="mt-2 text-xs text-gray-500">
                                  Responsable comercial: <span className="font-semibold text-gray-700">{nombreResponsableProducto(responsableActual)}</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Responsable</div>
                                <div className="mt-1 text-sm font-semibold text-gray-800">
                                  {nombreResponsableProducto(responsableActual)}
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                  Al iniciar la gestión, el Responsable se asigna automáticamente al usuario gestor.
                                </p>
                              </>
                            )}
                          </div>

                          {esBaf ? (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Estado BAF</label><select name="estado_baf_id" defaultValue={gestion?.estado_baf_id ?? ''} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 opacity-100 disabled:bg-gray-100 disabled:text-gray-700 disabled:opacity-100"><option value="">Sin estado</option>{(estadosBaf ?? []).map((e: any) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></div>
                              <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">CIA Celular</label><select name="cia_celular" defaultValue={gestion?.cia_celular ?? ''} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 opacity-100 disabled:bg-gray-100 disabled:text-gray-700 disabled:opacity-100"><option value="">Seleccionar compañía</option><option>CLARO</option><option>PERSONAL</option><option>MOVISTAR</option><option>TUENTI</option></select></div>
                              <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Prospector</label><input name="prospector" defaultValue={gestion?.prospector ?? ''} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 opacity-100 disabled:bg-gray-100 disabled:text-gray-700 disabled:opacity-100" /></div>
                              <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">SDS</label><GestionInputValidado name="sds" tipo="SDS" defaultValue={gestion?.sds ?? ''} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 opacity-100 disabled:bg-gray-100 disabled:text-gray-700 disabled:opacity-100" /></div>
                              <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Orden Trabajo</label><GestionInputValidado name="orden_trabajo" tipo="OT" defaultValue={gestion?.orden_trabajo ?? ''} placeholder="8 dígitos" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 opacity-100 disabled:bg-gray-100 disabled:text-gray-700 disabled:opacity-100" /><p className="mt-1 text-xs text-gray-500">En Conexión Full con BAF nuevo, esta OT habilita automáticamente PORTA/LN.</p></div>
                              <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Observaciones</label><input name="linea_fija" defaultValue={gestion?.linea_fija ?? ''} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 opacity-100 disabled:bg-gray-100 disabled:text-gray-700 disabled:opacity-100" /></div>
                              <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Ciclo Cuenta</label><input name="ciclo_cuenta" defaultValue={gestion?.ciclo_cuenta ?? ''} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 opacity-100 disabled:bg-gray-100 disabled:text-gray-700 disabled:opacity-100" /></div>
                              <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Fecha Instalación</label><input name="fecha_instalacion" defaultValue={gestion?.fecha_instalacion ?? ''} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 opacity-100 disabled:bg-gray-100 disabled:text-gray-700 disabled:opacity-100" /></div>
                              <div className="sm:col-span-2"><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Motivo Estado</label><textarea name="motivo_estado" defaultValue={gestion?.motivo_estado ?? ''} rows={3} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 opacity-100 disabled:bg-gray-100 disabled:text-gray-700 disabled:opacity-100" /></div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Estado Vendedor</label><select name="estado_porta_id" defaultValue={gestion?.estado_porta_id ?? ''} disabled={profile.rol === 'BBOO'} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 opacity-100 disabled:bg-gray-100 disabled:text-gray-700 disabled:opacity-100"><option value="">Sin estado</option>{(estadosPorta ?? []).map((e: any) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></div>
                              <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Estado BBOO</label><select name="estado_bboo_id" defaultValue={gestion?.estado_bboo_id ?? ''} disabled={profile.rol === 'VENDEDOR'} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 opacity-100 disabled:bg-gray-100 disabled:text-gray-700 disabled:opacity-100"><option value="">Sin estado</option>{(estadosBboo ?? []).map((e: any) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></div>
                              <input type="hidden" name="bboo_id" value={profile.rol === 'BBOO' ? user.id : gestion?.bboo_id ?? ''} />
                              <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Fecha Carga STL</label>
                                <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-700">
                                  {fechaArgentina(gestion?.fecha_carga_stl ?? null)}
                                </div>
                                <p className="mt-1 text-xs text-gray-500">Automática al establecer Estado Vendedor = CARGADO STL.</p>
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Fecha PORTA</label>
                                <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-700">
                                  {fechaArgentina(gestion?.fecha_porta ?? null)}
                                </div>
                                <p className="mt-1 text-xs text-gray-500">Automática al establecer Estado Vendedor = ACTIVA NRO PORTADO.</p>
                              </div>
                              <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">SIM</label><GestionInputValidado name="sim" tipo="SIM" defaultValue={gestion?.sim ?? ''} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 opacity-100 disabled:bg-gray-100 disabled:text-gray-700 disabled:opacity-100" /></div>
                              <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Plan</label><select name="plan_cargado" defaultValue={gestion?.plan_cargado || producto.plan_snapshot || ''} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 opacity-100 disabled:bg-gray-100 disabled:text-gray-700 disabled:opacity-100"><option value="">Seleccionar plan</option>{(() => { const actual = String(gestion?.plan_cargado || producto.plan_snapshot || '').trim(); const activos = Array.from(new Set((planesPorta ?? []).map((p: any) => String(p.nombre ?? '').trim()).filter(Boolean))); const opciones = actual && !activos.includes(actual) ? [actual, ...activos] : activos; return opciones.map((nombre: string) => <option key={nombre} value={nombre}>{nombre}</option>) })()}</select></div>
                              <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">SDS</label><GestionInputValidado name="sds" tipo="SDS" defaultValue={gestion?.sds ?? ''} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 opacity-100 disabled:bg-gray-100 disabled:text-gray-700 disabled:opacity-100" /></div>
                              <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">PIN / LNVA NRO</label><input name="pin_lnva_nro" defaultValue={gestion?.pin_lnva_nro ?? ''} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 opacity-100 disabled:bg-gray-100 disabled:text-gray-700 disabled:opacity-100" /></div>
                              <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Documentación DNI</label><select name="documentacion_dni" defaultValue={gestion?.documentacion_dni === true ? 'SI' : gestion?.documentacion_dni === false ? 'NO' : ''} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 opacity-100 disabled:bg-gray-100 disabled:text-gray-700 disabled:opacity-100"><option value="">Sin informar</option><option value="SI">SI</option><option value="NO">NO</option></select></div>
                              <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Medio de despacho CHIP</label><select name="medio_despacho_chip_id" defaultValue={gestion?.medio_despacho_chip_id ?? ''} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 opacity-100 disabled:bg-gray-100 disabled:text-gray-700 disabled:opacity-100"><option value="">Sin informar</option>{(mediosDespacho ?? []).map((m: any) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></div>
                              <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Número de seguimiento</label><input name="numero_seguimiento" defaultValue={gestion?.numero_seguimiento ?? ''} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 opacity-100 disabled:bg-gray-100 disabled:text-gray-700 disabled:opacity-100" /></div>
                              <div className="sm:col-span-2"><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Observaciones gestión</label><textarea name="observaciones_gestion" defaultValue={gestion?.observaciones_gestion ?? ''} rows={3} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 opacity-100 disabled:bg-gray-100 disabled:text-gray-700 disabled:opacity-100" /></div>
                            </div>
                          )}

                          <div className="mt-5 flex justify-end">
                            <button type="submit" className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300">Guardar {esBaf ? 'BAF' : esLineaNueva ? 'Línea Nueva' : 'PORTA'}</button>
                          </div>
                        </fieldset>
                      </form>

                      <div className="border-t border-gray-200 bg-white p-5">
                        <details>
                          <summary className="cursor-pointer select-none text-sm font-semibold text-gray-900">
                            Historial / Auditoría ({(historialPorProducto.get(productoId) ?? []).length})
                          </summary>
                          <div className="mt-4 space-y-3">
                            {(historialPorProducto.get(productoId) ?? []).length === 0 ? (
                              <p className="text-sm text-gray-500">Todavía no hay cambios auditados para este producto.</p>
                            ) : (
                              (historialPorProducto.get(productoId) ?? []).map((evento: any) => (
                                <div key={evento.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                      <div className="text-sm font-semibold text-gray-900">{evento.etiqueta || evento.campo || evento.tipo_accion}</div>
                                      <div className="mt-1 text-sm text-gray-700">
                                        <span className="font-medium">{mostrar(evento.valor_anterior)}</span>
                                        <span className="mx-2 text-gray-400">→</span>
                                        <span className="font-medium">{mostrar(evento.valor_nuevo)}</span>
                                      </div>
                                    </div>
                                    <div className="text-right text-xs text-gray-500">
                                      <div>{fechaArgentina(evento.fecha_hora)}</div>
                                      <div className="mt-1">
                                        {nombresActorHistorial.get(String(evento.usuario_id)) || 'Usuario no disponible'}
                                        {evento.rol_actor ? ` · ${evento.rol_actor}` : ''}
                                      </div>
                                    </div>
                                  </div>
                                  {evento.observacion && (
                                    <div className="mt-2 whitespace-pre-wrap text-xs text-gray-600">{evento.observacion}</div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </details>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>
        </div>
      </main>
    )
  }

  // Para el Vendedor Gestor no dependemos de los joins embebidos de PostgREST:
  // primero autorizamos la operación con su sesión y luego leemos directamente,
  // del lado servidor, las tablas relacionadas con el cliente admin.
  const [
    clienteResultado,
    domicilioResultado,
    bafResultado,
    portaResultado,
  ] = await Promise.all([
    op.cliente_id
      ? admin
          .from('clientes')
          .select(`
            dni,
            tipo_documento,
            nombre,
            apellido,
            fecha_nacimiento,
            email,
            telefono,
            telefono_alternativo
          `)
          .eq('id', op.cliente_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    op.domicilio_id
      ? admin
          .from('domicilios')
          .select(`
            calle_nro,
            piso,
            dpto,
            entre_calles,
            barrio,
            localidad,
            coordenadas,
            datos_extras
          `)
          .eq('id', op.domicilio_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    op.tipo === 'BAF'
      ? admin
          .from('operaciones_baf')
          .select(`
            tipo_domicilio,
            plan,
            tv,
            cantidad_decos,
            zona,
            horario_contacto,
            convergente,
            linea_convergente,
            modalidad_plan
          `)
          .eq('operacion_id', op.id_operacion)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    op.tipo === 'PORTA'
      ? admin
          .from('operaciones_porta')
          .select(`
            nim,
            es_linea_nueva,
            gigas_acordados,
            tipo_sim,
            compania_actual,
            prepago_pospago,
            observaciones,
            numero_linea
          `)
          .eq('operacion_id', op.id_operacion)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (clienteResultado.error) {
    throw new Error(`No se pudo cargar el Cliente: ${clienteResultado.error.message}`)
  }

  if (domicilioResultado.error) {
    throw new Error(`No se pudo cargar el Domicilio: ${domicilioResultado.error.message}`)
  }

  if (bafResultado.error) {
    throw new Error(`No se pudieron cargar los datos BAF: ${bafResultado.error.message}`)
  }

  if (portaResultado.error) {
    throw new Error(`No se pudieron cargar los datos PORTA/Línea Nueva: ${portaResultado.error.message}`)
  }

  const cliente = clienteResultado.data ?? op.cliente
  const domicilio = domicilioResultado.data ?? op.domicilio
  const baf = bafResultado.data ?? op.operaciones_baf
  const porta = portaResultado.data ?? op.operaciones_porta
  const gestionBaf = op.gestion_baf
  const gestionPorta = op.gestion_porta

  let bbooActualGestion: any = null
  if (gestionPorta?.bboo_id) {
    const { data: perfilBbooActual, error: perfilBbooActualError } = await admin
      .from('profiles')
      .select('id, nombre, vendedor, rol, activo')
      .eq('id', gestionPorta.bboo_id)
      .maybeSingle()

    if (perfilBbooActualError) {
      throw new Error(`No se pudo cargar el BBOO actual: ${perfilBbooActualError.message}`)
    }

    bbooActualGestion = perfilBbooActual
  }

  const esBaf = op.tipo === 'BAF'
  const esPorta = op.tipo === 'PORTA'
  const tipoVisible =
    esPorta && porta?.es_linea_nueva
      ? 'Línea Nueva'
      : esPorta
        ? 'Portabilidad'
        : op.tipo

  const puedeEditarEstadoVendedor =
    puedeEditar &&
    (profile.rol === 'ADMIN' ||
      profile.rol === 'SUPERVISOR' ||
      (profile.rol === 'VENDEDOR' && profile.puede_gestionar_ventas === true))

  const puedeEditarEstadoBboo =
    puedeEditar &&
    (profile.rol === 'ADMIN' || profile.rol === 'SUPERVISOR' || profile.rol === 'BBOO')


  // Líneas móviles hermanas del mismo grupo.
  // Se cargan en dos pasos para no depender de joins embebidos afectados por RLS.
  let lineasGrupo: any[] = []

  if (esPorta && op.grupo_operacion) {
    const { data: operacionesGrupo, error: operacionesGrupoError } = await admin
      .from('operaciones')
      .select('id_operacion')
      .eq('grupo_operacion', op.grupo_operacion)
      .eq('tipo', 'PORTA')

    if (operacionesGrupoError) {
      throw new Error(
        `No se pudieron cargar las líneas del grupo: ${operacionesGrupoError.message}`
      )
    }

    const idsGrupo = (operacionesGrupo ?? []).map(
      (item: any) => item.id_operacion
    )

    if (idsGrupo.length > 0) {
      const { data: detallesGrupo, error: detallesGrupoError } = await admin
        .from('operaciones_porta')
        .select(`
          operacion_id,
          numero_linea,
          nim,
          es_linea_nueva,
          tipo_sim
        `)
        .in('operacion_id', idsGrupo)

      if (detallesGrupoError) {
        throw new Error(
          `No se pudieron cargar los datos de las líneas: ${detallesGrupoError.message}`
        )
      }

      lineasGrupo = (detallesGrupo ?? [])
        .map((item: any) => ({
          id_operacion: item.operacion_id,
          numero_linea: item.numero_linea,
          nim: item.nim,
          es_linea_nueva: item.es_linea_nueva,
          tipo_sim: item.tipo_sim,
        }))
        .sort(
          (a: any, b: any) =>
            Number(a.numero_linea ?? 0) - Number(b.numero_linea ?? 0)
        )
    }
  }

  const responsableActualId =
    esBaf ? gestionBaf?.responsable_id : gestionPorta?.responsable_id

  const responsableActual = (responsables ?? []).find(
    (responsable: any) => responsable.id === responsableActualId
  )

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader
        rol={profile.rol}
        usuario={profile.nombre?.trim() || user.email || 'Usuario'}
        actual="GESTION_VENTAS"
        puedeGestionarVentas={profile.puede_gestionar_ventas === true}
      />
      <div className="mx-auto max-w-6xl p-4 sm:p-8">

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2">
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                {tipoVisible}
              </span>
            </div>

            <h1 className="text-2xl font-bold text-gray-900">
              Detalle de Venta
            </h1>

            <p className="mt-1 break-all text-sm text-gray-500">
              Operación: {op.id_operacion}
            </p>
          </div>

          <a
            href="/gestion-ventas"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Volver a Gestión de Ventas
          </a>
        </div>

        <GestionBloqueoControls
          tipoRecurso="VENTA"
          recursoClave={recursoClave}
          idOperacion={op.id_operacion}
          editando={puedeEditar}
          sesionToken={puedeEditar ? sesionTokenSolicitado : null}
          bloqueado={bloqueoVigente}
          bloqueoPropio={bloqueoPropio}
          usuarioBloqueo={usuarioBloqueo}
          bloqueadoDesde={bloqueo?.bloqueado_desde ?? null}
          autoAsignarGestion
        />

        <div className="space-y-5">
            <div className="rounded-2xl border border-red-100 bg-red-50/40 p-5">
              {profile.rol === 'BBOO' && esPorta ? (
                <>
                  <h2 className="text-lg font-semibold text-gray-900">BBOO asignado</h2>
                  <div className="mt-3 text-sm text-gray-700">
                    BBOO actual:{' '}
                    <span className="font-semibold">
                      {bbooActualGestion?.vendedor ||
                        bbooActualGestion?.nombre ||
                        (gestionPorta?.bboo_id ? 'Usuario no disponible' : 'Sin BBOO asignado')}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Responsable comercial:{' '}
                    <span className="font-semibold text-gray-700">
                      {responsableActual?.vendedor ||
                        responsableActual?.nombre ||
                        (responsableActualId ? 'Usuario no disponible' : 'Sin asignar')}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-gray-900">Responsable</h2>
                  <div className="mt-3 text-sm text-gray-700">
                    Responsable actual:{' '}
                    <span className="font-semibold">
                      {responsableActual?.vendedor ||
                        responsableActual?.nombre ||
                        (responsableActualId ? 'Usuario no disponible' : 'Sin asignar')}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Al presionar Gestionar, la venta se asigna automáticamente al usuario gestor.
                  </p>
                </>
              )}
            </div>


          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Operación
            </h2>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Campo label="Fecha / Hora" value={fechaArgentina(op.fecha_hora)} />
              <Campo label="Vendedor" value={op.vendedor} />
              <Campo label="Origen del dato" value={op.origen_dato} />
              <Campo label="Grupo operación" value={op.grupo_operacion} />
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Cliente
            </h2>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Campo
                label="Apellido y Nombre"
                value={[cliente?.apellido, cliente?.nombre].filter(Boolean).join(', ')}
              />
              <Campo
                label="Documento"
                value={`${cliente?.tipo_documento ? `${cliente.tipo_documento} ` : ''}${cliente?.dni || ''}`}
              />
              <Campo
                label="Fecha de nacimiento"
                value={fechaSimple(cliente?.fecha_nacimiento)}
              />
              <Campo label="Correo electrónico" value={cliente?.email} />
              <Campo label="Teléfono" value={cliente?.telefono} />
              <Campo
                label="Teléfono alternativo"
                value={cliente?.telefono_alternativo}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Domicilio
            </h2>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Campo label="Calle / Número" value={domicilio?.calle_nro} />
              <Campo
                label="Piso / Dpto"
                value={[domicilio?.piso, domicilio?.dpto].filter(Boolean).join(' / ')}
              />
              <Campo label="Entre calles" value={domicilio?.entre_calles} />
              <Campo label="Barrio" value={domicilio?.barrio} />
              <Campo label="Localidad" value={domicilio?.localidad} />
              <Campo label="Coordenadas" value={domicilio?.coordenadas} />
              <Campo
                label="Datos extras"
                value={domicilio?.datos_extras}
                ancho
              />
            </div>
          </section>

          {esPorta && lineasGrupo.length > 1 && (
            <section
            id="lineas-operacion"
            className="mb-5 scroll-mt-6 rounded-2xl border border-gray-200 bg-white p-4"
          >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-gray-900">
                  Líneas de esta operación
                </h2>
                <span className="text-xs text-gray-500">
                  Línea {porta?.numero_linea ?? '-'} de {lineasGrupo.length}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {lineasGrupo.map((linea: any) => {
                  const activa = linea.id_operacion === op.id_operacion
                  const etiquetaTipo = linea.es_linea_nueva ? 'LN' : 'PORTA'

                  return (
                    <a
                      key={linea.id_operacion}
                      href={`/gestion-ventas/${encodeURIComponent(linea.id_operacion)}#lineas-operacion`}
                      className={
                        activa
                          ? 'rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm'
                          : 'rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100'
                      }
                    >
                      Línea {linea.numero_linea} · {etiquetaTipo}
                    </a>
                  )
                })}
              </div>

              <p className="mt-3 text-xs text-gray-500">
                Seleccioná una línea para ver y gestionar sus datos independientes.
              </p>
            </section>
          )}


          {esBaf && (
            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Datos BAF
              </h2>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Campo label="Servicio BAF" value={baf?.modalidad_plan} />
                <Campo label="Plan" value={baf?.plan} />
                <Campo label="TV" value={baf?.tv} />
                <Campo label="Cantidad DECOS" value={baf?.cantidad_decos} />
                <Campo label="Zona" value={baf?.zona} />
                <Campo label="Tipo domicilio" value={baf?.tipo_domicilio} />
                <Campo label="Convergente" value={baf?.convergente} />
                <Campo
                  label="Línea convergente"
                  value={baf?.linea_convergente}
                />
                <Campo
                  label="Horario contacto / Observaciones"
                  value={baf?.horario_contacto}
                  ancho
                />
              </div>
            </section>
          )}

          {esPorta && (
            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Datos {porta?.es_linea_nueva ? 'Línea Nueva' : 'PORTA'}
              </h2>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Campo label="NIM" value={porta?.nim} />
                <Campo label="Número de línea" value={porta?.numero_linea} />
                <Campo
                  label="Gigas acordados"
                  value={porta?.gigas_acordados}
                />
                <Campo
                  label="Tipo de SIM"
                  value={
                    porta?.tipo_sim === 'ESIM'
                      ? 'eSIM'
                      : porta?.tipo_sim === 'SIMCARD'
                        ? 'SIMCARD'
                        : porta?.tipo_sim
                  }
                />
                <Campo
                  label="Compañía actual"
                  value={porta?.compania_actual}
                />
                <Campo
                  label="PRE / POS"
                  value={porta?.prepago_pospago}
                />
                <Campo
                  label="Línea Nueva"
                  value={porta?.es_linea_nueva}
                />
                <Campo
                  label="Observaciones vendedor"
                  value={porta?.observaciones}
                  ancho
                />
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-gray-900">
                Gestión
              </h2>

              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
                Gestión inicial
              </span>
            </div>

            {esBaf ? (
              <form
                id="gestion-unificada"
                action={guardarGestionBaf}
                className="rounded-xl border border-gray-200 bg-gray-50/50 p-4"
              >
                <input type="hidden" name="id_operacion" value={op.id_operacion} />
              <input type="hidden" name="recurso_clave" value={recursoClave} />
              <input type="hidden" name="sesion_token" value={sesionTokenSolicitado ?? ''} />
              <fieldset disabled={!puedeEditar}>

                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      Gestión BAF
                    </h3>
                    <p className="mt-1 text-xs text-gray-500">
                      La Fecha Gestión se actualiza automáticamente al guardar.
                    </p>
                  </div>

                  <div className="text-xs text-gray-500">
                    Última gestión:{' '}
                    <span className="font-medium text-gray-700">
                      {fechaArgentina(gestionBaf?.fecha_gestion)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Estado BAF
                    </label>
                    <select
                      name="estado_baf_id"
                      defaultValue={gestionBaf?.estado_baf_id ?? ''}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="">Sin estado</option>
                      {(estadosBaf ?? []).map((estado: any) => (
                        <option key={estado.id} value={estado.id}>
                          {estado.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      CIA Celular
                    </label>
                    <select
                      name="cia_celular"
                      defaultValue={gestionBaf?.cia_celular ?? ''}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="">Seleccionar compañía</option>
                      <option value="CLARO">CLARO</option>
                      <option value="PERSONAL">PERSONAL</option>
                      <option value="MOVISTAR">MOVISTAR</option>
                      <option value="TUENTI">TUENTI</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Prospector
                    </label>
                    <input
                      type="text"
                      name="prospector"
                      defaultValue={gestionBaf?.prospector ?? ''}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Detalle Lead
                    </label>
                    <div className="w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700">
                      {op.origen_dato || '-'}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Proviene de la carga inicial de la venta y no se modifica desde Gestión.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      SDS
                    </label>
                    <GestionInputValidado
                      name="sds"
                      tipo="SDS"
                      defaultValue={gestionBaf?.sds ?? ''}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Orden Trabajo
                    </label>
                    <GestionInputValidado
                      name="orden_trabajo"
                      tipo="OT"
                      defaultValue={gestionBaf?.orden_trabajo ?? ''}
                      placeholder="8 dígitos"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Línea Fija
                    </label>
                    <input
                      type="text"
                      name="linea_fija"
                      defaultValue={gestionBaf?.linea_fija ?? ''}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Ciclo Cuenta
                    </label>
                    <input
                      type="text"
                      name="ciclo_cuenta"
                      defaultValue={gestionBaf?.ciclo_cuenta ?? ''}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Fecha Instalación
                    </label>
                    <input
                      type="text"
                      name="fecha_instalacion"
                      defaultValue={gestionBaf?.fecha_instalacion ?? ''}
                      placeholder="Texto libre: fecha, rango horario y aclaraciones"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Motivo Estado
                    </label>
                    <textarea
                      name="motivo_estado"
                      defaultValue={gestionBaf?.motivo_estado ?? ''}
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </div>
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    type="submit"
                    className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    Guardar
                  </button>
                </div>
              </fieldset>
            </form>
            ) : esPorta ? (
              <form
                id="gestion-unificada"
                action={guardarGestionPorta}
                className="rounded-xl border border-gray-200 bg-gray-50/50 p-4"
              >
                <input type="hidden" name="id_operacion" value={op.id_operacion} />
              <input type="hidden" name="recurso_clave" value={recursoClave} />
              <input type="hidden" name="sesion_token" value={sesionTokenSolicitado ?? ''} />
              <fieldset disabled={!puedeEditar}>

                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div
                    className={
                      porta?.es_linea_nueva
                        ? 'rounded-xl bg-green-600 px-4 py-3 text-white'
                        : 'rounded-xl bg-blue-600 px-4 py-3 text-white'
                    }
                  >
                    <div className="text-xs font-semibold uppercase tracking-wide text-white/80">
                      Tipo de venta
                    </div>
                    <h3 className="mt-1 font-semibold">
                      {porta?.es_linea_nueva ? 'Línea Nueva' : 'Portabilidad'}
                    </h3>
                  </div>

                  <div className="rounded-xl bg-green-600 px-4 py-3 text-white">
                    <div className="text-xs font-semibold uppercase tracking-wide text-white/80">
                      BBOO
                    </div>
                    <div className="mt-1 font-semibold">
                      {profile.rol === 'BBOO'
                        ? profile.nombre?.trim() || user.email || 'Usuario BBOO'
                        : bbooActualGestion?.vendedor ||
                          bbooActualGestion?.nombre ||
                          (gestionPorta?.bboo_id ? 'BBOO asignado' : 'Sin BBOO asignado')}
                    </div>
                  </div>

                  <input
                    type="hidden"
                    name="bboo_id"
                    value={profile.rol === 'BBOO' ? user.id : gestionPorta?.bboo_id ?? ''}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Estado Vendedor
                    </label>
                    <select
                      name="estado_porta_id"
                      defaultValue={gestionPorta?.estado_porta_id ?? ''}
                      disabled={!puedeEditarEstadoVendedor}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                    >
                      <option value="">Sin estado</option>
                      {(estadosPorta ?? []).map((estado: any) => (
                        <option key={estado.id} value={estado.id}>
                          {estado.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Estado BBOO
                    </label>
                    <select
                      name="estado_bboo_id"
                      defaultValue={gestionPorta?.estado_bboo_id ?? ''}
                      disabled={!puedeEditarEstadoBboo}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                    >
                      <option value="">Sin estado</option>
                      {(estadosBboo ?? []).map((estado: any) => (
                        <option key={estado.id} value={estado.id}>
                          {estado.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Fecha Carga STL
                      </label>
                      <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-700">
                        {fechaArgentina(gestionPorta?.fecha_carga_stl)}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Fecha PORTA
                      </label>
                      <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-700">
                        {fechaArgentina(gestionPorta?.fecha_porta)}
                      </div>
                    </div>

                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      SIM
                    </label>
                    <GestionInputValidado
                      name="sim"
                      tipo="SIM"
                      defaultValue={gestionPorta?.sim ?? ''}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      PLAN
                    </label>
                    <select
                      name="plan_cargado"
                      defaultValue={gestionPorta?.plan_cargado || porta?.gigas_acordados || ''}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="">Seleccionar plan</option>
                      {(() => {
                        const actual = String(
                          gestionPorta?.plan_cargado || porta?.gigas_acordados || ''
                        ).trim()
                        const activos = Array.from(new Set(
                          (planesPorta ?? []).map((plan: any) =>
                            String(plan.nombre ?? '').trim()
                          ).filter(Boolean)
                        ))
                        const opciones = actual && !activos.includes(actual)
                          ? [actual, ...activos]
                          : activos
                        return opciones.map((nombre: string) => (
                          <option key={nombre} value={nombre}>{nombre}</option>
                        ))
                      })()}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      SDS
                    </label>
                    <GestionInputValidado
                      name="sds"
                      tipo="SDS"
                      defaultValue={gestionPorta?.sds ?? ''}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      PIN / LNVA NRO
                    </label>
                    <input
                      type="text"
                      name="pin_lnva_nro"
                      defaultValue={gestionPorta?.pin_lnva_nro ?? ''}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Documentación DNI
                    </label>
                    <select
                      name="documentacion_dni"
                      defaultValue={
                        gestionPorta?.documentacion_dni === true
                          ? 'SI'
                          : gestionPorta?.documentacion_dni === false
                            ? 'NO'
                            : ''
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="">Sin informar</option>
                      <option value="SI">SI</option>
                      <option value="NO">NO</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Medio de despacho CHIP
                    </label>
                    <select
                      name="medio_despacho_chip_id"
                      defaultValue={gestionPorta?.medio_despacho_chip_id ?? ''}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="">Sin informar</option>
                      {(mediosDespacho ?? []).map((medio: any) => (
                        <option key={medio.id} value={medio.id}>
                          {medio.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Número de seguimiento
                    </label>
                    <input
                      type="text"
                      name="numero_seguimiento"
                      defaultValue={gestionPorta?.numero_seguimiento ?? ''}
                      placeholder="Ej.: código Andreani / Cadetería"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Gestión Chip
                    </label>
                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                      Pendiente de definición
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Observaciones gestión
                    </label>
                    <textarea
                      name="observaciones_gestion"
                      defaultValue={gestionPorta?.observaciones_gestion ?? ''}
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </div>
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    type="submit"
                    className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    Guardar
                  </button>
                </div>
              </fieldset>
            </form>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
                Esta venta todavía no tiene datos de gestión.
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Sincronización
            </h2>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Campo label="Estado Sync" value={op.estado_sync} />
              <Campo label="Sheet destino" value={op.sheet_destino} />
              <Campo label="Fila Sheet" value={op.fila_sheet} />
              <Campo label="Error Sync" value={op.error_sync} ancho />
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
