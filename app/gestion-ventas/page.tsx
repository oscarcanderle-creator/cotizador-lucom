import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import { createAdminClient } from '../../utils/supabase/admin'
import AppHeader from '../../components/AppHeader'
import FiltrosAvanzadosVentas from '../../components/FiltrosAvanzadosVentas'
import BandejasGestionVentas from '../../components/BandejasGestionVentas'
import ExportarVentas from '../../components/ExportarVentas'

type SearchParams = Promise<{
  q?: string
  registro?: string
  tipo?: string
  vendedor?: string
  responsable?: string
  estado?: string
  f1_field?: string
  f1_op?: string
  f1_value?: string
  f1_value2?: string
  f2_join?: string
  f2_field?: string
  f2_op?: string
  f2_value?: string
  f2_value2?: string
  f3_join?: string
  f3_field?: string
  f3_op?: string
  f3_value?: string
  f3_value2?: string
  f4_join?: string
  f4_field?: string
  f4_op?: string
  f4_value?: string
  f4_value2?: string
  bandeja?: string
}>

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

function FechaDosLineas({ fecha }: { fecha: string | null }) {
  if (!fecha) {
    return <span>-</span>
  }

  const valor = new Date(fecha)

  if (Number.isNaN(valor.getTime())) {
    return <span>-</span>
  }

  const fechaTexto = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(valor)

  const horaTexto = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(valor)

  return (
    <div className="leading-5">
      <div className="whitespace-nowrap">{fechaTexto}</div>
      <div className="whitespace-nowrap text-xs text-gray-500">{horaTexto}</div>
    </div>
  )
}

function nombreCliente(cliente: any) {
  if (!cliente) return '-'

  const apellido = String(cliente.apellido ?? '').trim()
  const nombre = String(cliente.nombre ?? '').trim()

  return [apellido, nombre].filter(Boolean).join(', ') || '-'
}

function tiposOperacion(operacion: any): string[] {
  const productos = Array.isArray(operacion.productos_nuevos)
    ? operacion.productos_nuevos
    : []

  if (productos.length > 0) {
    return Array.from(
      new Set(
        productos.map((p: any) =>
          p.tipo_producto === 'LINEA_NUEVA' ? 'LN' : String(p.tipo_producto)
        )
      )
    ) as string[]
  }

  if (operacion.tipo === 'PORTA' && operacion.operaciones_porta?.es_linea_nueva) {
    return ['LN']
  }

  return [String(operacion.tipo)]
}

function tipoVisible(operacion: any) {
  const productos = Array.isArray(operacion.productos_nuevos)
    ? operacion.productos_nuevos
    : []

  if (productos.length > 0) {
    const tieneBaf = productos.some(
      (p: any) => p.tipo_producto === 'BAF'
    )

    const moviles = productos.filter(
      (p: any) =>
        p.tipo_producto === 'PORTA' ||
        p.tipo_producto === 'LINEA_NUEVA'
    )

    // BAF + al menos una línea móvil
    if (tieneBaf && moviles.length > 0) {
      return 'Venta Multiproducto'
    }

    // Dos o más líneas móviles sin BAF
    if (!tieneBaf && moviles.length >= 2) {
      return 'Líneas Múltiples'
    }
  }

  return tiposOperacion(operacion).join(' + ')
}

function productoVisible(operacion: any) {
  const productos = Array.isArray(operacion.productos_nuevos)
    ? operacion.productos_nuevos
    : []

  if (productos.length > 0) {
    return productos
      .map((p: any) => {
        const tipo = p.tipo_producto === 'LINEA_NUEVA' ? 'LN' : p.tipo_producto
        return `${tipo} · ${p.plan_snapshot || p.producto_snapshot || '-'}`
      })
      .join(' | ')
  }

  if (operacion.tipo === 'BAF') return operacion.operaciones_baf?.plan || '-'

  if (operacion.tipo === 'PORTA') {
    const porta = operacion.operaciones_porta
    if (!porta) return '-'
    if (porta.es_linea_nueva) return porta.gigas_acordados ? `Línea Nueva · ${porta.gigas_acordados}` : 'Línea Nueva'
    return porta.gigas_acordados ? `Portabilidad · ${porta.gigas_acordados}` : 'Portabilidad'
  }

  return '-'
}

function estadoVisible(operacion: any) {
  const productos = Array.isArray(operacion.productos_nuevos)
    ? operacion.productos_nuevos
    : []

  if (productos.length > 0) {
    return productos
      .map((p: any) => {
        const tipo = p.tipo_producto === 'LINEA_NUEVA' ? 'LN' : p.tipo_producto
        if (p.tipo_producto === 'BAF') return `${tipo}: ${p.gestion?.estado_nombre || 'Sin gestión'}`
        if (p.habilitacion && p.habilitacion.habilitado === false) return `${tipo}: Pendiente OT`
        return `${tipo}: ${p.gestion?.estado_nombre || 'Sin gestión'}`
      })
      .join(' | ')
  }

  if (operacion.tipo === 'BAF') return operacion.gestion_baf?.estado_nombre || 'Sin gestión'
  if (operacion.tipo === 'PORTA') return operacion.gestion_porta?.estado_nombre || 'Sin gestión'
  return 'Sin gestión'
}

function lineaVisible(operacion: any, cantidadLineasGrupo: Map<string, number>) {
  const productos = Array.isArray(operacion.productos_nuevos) ? operacion.productos_nuevos : []
  if (productos.length > 0) {
    const moviles = productos.filter((p: any) => ['PORTA', 'LINEA_NUEVA'].includes(p.tipo_producto))
    if (moviles.length === 0) return '-'
    return moviles.map((p: any, i: number) => {
      const d = p.detalle || {}
      const tipo = p.tipo_producto === 'LINEA_NUEVA' ? 'LN' : 'PORTA'
      const nim = tipo === 'PORTA' && String(d.nim ?? '').trim() ? ` · ${String(d.nim).trim()}` : ''
      return `Línea ${d.numero_linea ?? i + 1} de ${moviles.length} · ${tipo}${nim}`
    }).join(' | ')
  }

  if (operacion.tipo !== 'PORTA') return '-'
  const porta = operacion.operaciones_porta
  if (!porta) return '-'
  const numero = porta.numero_linea ?? '-'
  const cantidad = operacion.grupo_operacion ? cantidadLineasGrupo.get(operacion.grupo_operacion) ?? 1 : 1
  const tipo = porta.es_linea_nueva ? 'LN' : 'PORTA'
  const nim = !porta.es_linea_nueva && String(porta.nim ?? '').trim() ? ` · ${String(porta.nim).trim()}` : ''
  return `Línea ${numero} de ${cantidad} · ${tipo}${nim}`
}

export default async function GestionVentasPage({
  searchParams,
}: {
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

  const esVendedorGestor =
    profile.rol === 'VENDEDOR' &&
    profile.puede_gestionar_ventas === true

  const esBboo = profile.rol === 'BBOO'
  const esSupervisor = profile.rol === 'SUPERVISOR'
  const esAdmin = profile.rol === 'ADMIN'
  const puedeGestionarVentas =
    esVendedorGestor || esBboo || esSupervisor || esAdmin

  if (!puedeGestionarVentas) redirect('/ventas')

  /*
   * Desde este punto usamos el cliente ADMIN, pero solamente después
   * de autenticar y validar que el usuario puede gestionar ventas
   * (VENDEDOR GESTOR o BBOO activo).
   *
   * Esto evita que RLS o las relaciones embebidas oculten Cliente,
   * datos PORTA/LN y demás información necesaria en el listado.
   */
  const admin = createAdminClient()

  const rolVista =
    profile.rol === 'BBOO'
      ? 'BBOO'
      : profile.rol === 'VENDEDOR'
        ? 'VENDEDOR'
        : profile.rol === 'SUPERVISOR'
          ? 'SUPERVISOR'
          : 'ADMIN'

  const { data: vistaConfigurada, error: errorVista } = await admin
    .from('vistas_gestion_ventas')
    .select('campo, etiqueta, visible, orden, ancho')
    .eq('rol', rolVista)
    .eq('visible', true)
    .order('orden', { ascending: true })
    .order('campo', { ascending: true })

  if (errorVista) {
    throw new Error(
      `No se pudo cargar la configuración de la vista ${rolVista}: ${errorVista.message}`
    )
  }

  const columnasPredeterminadas = [
    { campo: 'fecha_ingreso', etiqueta: 'Fecha Ingreso', ancho: 125, orden: 1 },
    { campo: 'tipo', etiqueta: 'Tipo', ancho: 95, orden: 2 },
    { campo: 'vendedor', etiqueta: 'Vendedor', ancho: 170, orden: 3 },
    { campo: 'responsable', etiqueta: 'Responsable', ancho: 170, orden: 4 },
    { campo: 'cliente', etiqueta: 'Cliente', ancho: 190, orden: 5 },
    { campo: 'numero_linea', etiqueta: 'Número Línea', ancho: 135, orden: 8 },
    { campo: 'plan_cargado', etiqueta: 'Plan Cargado', ancho: 125, orden: 12 },
    { campo: 'estado_vendedor', etiqueta: 'Estado Vendedor', ancho: 170, orden: 13 },
    { campo: 'estado_bboo', etiqueta: 'Estado BBOO', ancho: 180, orden: 14 },
  ]

  const columnasVista =
    (vistaConfigurada ?? []).length > 0
      ? (vistaConfigurada ?? []).map((columna: any) => ({
          campo: String(columna.campo),
          etiqueta:
            esBboo && String(columna.campo) === 'responsable'
              ? 'BBOO asignado'
              : String(columna.etiqueta || columna.campo),
          ancho: Math.min(600, Math.max(60, Number(columna.ancho) || 140)),
          orden: Number(columna.orden) || 0,
        }))
      : columnasPredeterminadas

  const params = await searchParams
  const q = String(params?.q ?? '').trim().toLowerCase()
  const filtroRegistro = String(params?.registro ?? '').trim().toUpperCase()
  const filtroTipo = String(params?.tipo ?? '').trim().toUpperCase()
  const filtroVendedor = String(params?.vendedor ?? '').trim()
  const filtroResponsable = String(params?.responsable ?? '').trim()
  const filtroEstado = String(params?.estado ?? '').trim()
  const bandejaActiva = String(params?.bandeja ?? '').trim()

  const { data: bandejasResultado, error: errorBandejas } = await admin
    .from('bandejas_gestion_ventas')
    .select('id, nombre, filtros')
    .eq('usuario_id', user.id)
    .order('nombre', { ascending: true })

  if (errorBandejas) {
    throw new Error(`No se pudieron cargar las bandejas: ${errorBandejas.message}`)
  }

  const { data: operacionesBase, error } = await admin
    .from('operaciones')
    .select(`
      id_operacion,
      tipo,
      fecha_hora,
      vendedor,
      origen_dato,
      obs,
      cliente_id,
      grupo_operacion
    `)
    .in('tipo', ['BAF', 'PORTA'])
    .order('fecha_hora', { ascending: false })

  if (error) {
    throw new Error(`No se pudieron cargar las ventas: ${error.message}`)
  }

  const { data: consultasBase, error: errorConsultas } = esVendedorGestor
    ? await admin
        .from('consultas')
        .select(`
          id,
          marca_temporal,
          tipo_consulta_id,
          vendedor_id,
          responsable_id,
          cliente_id,
          cliente,
          dni,
          telefono,
          tipo_domicilio,
          domicilio,
          entrecalles,
          localidad,
          observaciones,
          estado_consulta_id,
          estado_deuda_id,
          estado_cobertura_id,
          fecha_estado,
          fecha_gestion,
          operacion_id
        `)
        .order('marca_temporal', { ascending: false })
    : { data: [], error: null }

  if (errorConsultas) {
    throw new Error(`No se pudieron cargar las consultas: ${errorConsultas.message}`)
  }

  const consultas = consultasBase ?? []

  const operaciones = operacionesBase ?? []
  const idsOperaciones = operaciones.map((o: any) => o.id_operacion)
  const idsClientes = Array.from(
    new Set(
      operaciones
        .map((o: any) => o.cliente_id)
        .filter(Boolean)
    )
  )

  const [
    clientesResultado,
    bafResultado,
    portaResultado,
    gestionBafResultado,
    gestionPortaResultado,
    perfilesResultado,
    mediosDespachoResultado,
    productosNuevosResultado,
    tiposConsultaResultado,
    estadosConsultaResultado,
  ] = await Promise.all([
    idsClientes.length > 0
      ? admin
          .from('clientes')
          .select('id, dni, tipo_documento, nombre, apellido, telefono')
          .in('id', idsClientes)
      : Promise.resolve({ data: [], error: null }),

    idsOperaciones.length > 0
      ? admin
          .from('operaciones_baf')
          .select('operacion_id, plan, modalidad_plan')
          .in('operacion_id', idsOperaciones)
      : Promise.resolve({ data: [], error: null }),

    idsOperaciones.length > 0
      ? admin
          .from('operaciones_porta')
          .select(`
            operacion_id,
            nim,
            es_linea_nueva,
            gigas_acordados,
            compania_actual,
            numero_linea,
            tipo_sim
          `)
          .in('operacion_id', idsOperaciones)
      : Promise.resolve({ data: [], error: null }),

    idsOperaciones.length > 0
      ? admin
          .from('gestion_baf')
          .select('operacion_id, responsable_id, fecha_gestion, updated_at, estado_baf_id, sds, fecha_instalacion, orden_trabajo')
          .in('operacion_id', idsOperaciones)
      : Promise.resolve({ data: [], error: null }),

    idsOperaciones.length > 0
      ? admin
          .from('gestion_porta')
          .select('operacion_id, responsable_id, updated_at, estado_porta_id, estado_bboo_id, bboo_id, medio_despacho_chip_id, fecha_carga_stl, fecha_porta, pin_lnva_nro, sim, plan_cargado, sds, numero_seguimiento')
          .in('operacion_id', idsOperaciones)
      : Promise.resolve({ data: [], error: null }),

    admin
      .from('profiles')
      .select('id, nombre, vendedor')
      .order('nombre', { ascending: true }),

    admin
      .from('medios_despacho_chip')
      .select('id, nombre')
      .order('nombre', { ascending: true }),

    idsOperaciones.length > 0
      ? admin
          .from('operacion_productos')
          .select('id, operacion_id, tipo_producto, responsable_id, orden, producto_snapshot, plan_snapshot')
          .in('operacion_id', idsOperaciones)
          .eq('activo', true)
          .order('orden', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    admin
      .from('tipos_consulta')
      .select('id, codigo, nombre')
      .eq('activo', true)
      .order('orden', { ascending: true }),
    admin
      .from('estados_consulta')
      .select('id, codigo, nombre, tipo_estado, ambito')
      .eq('activo', true)
      .order('orden', { ascending: true }),
  ])

  if (clientesResultado.error) {
    throw new Error(
      `No se pudieron cargar los clientes: ${clientesResultado.error.message}`
    )
  }

  if (bafResultado.error) {
    throw new Error(
      `No se pudieron cargar los datos BAF: ${bafResultado.error.message}`
    )
  }

  if (portaResultado.error) {
    throw new Error(
      `No se pudieron cargar las líneas PORTA/LN: ${portaResultado.error.message}`
    )
  }

  if (gestionBafResultado.error) {
    throw new Error(
      `No se pudo cargar la gestión BAF: ${gestionBafResultado.error.message}`
    )
  }

  if (gestionPortaResultado.error) {
    throw new Error(
      `No se pudo cargar la gestión PORTA/LN: ${gestionPortaResultado.error.message}`
    )
  }

  if (perfilesResultado.error) {
    throw new Error(
      `No se pudieron cargar los usuarios: ${perfilesResultado.error.message}`
    )
  }

  if (mediosDespachoResultado.error) {
    throw new Error(
      `No se pudieron cargar los medios de despacho: ${mediosDespachoResultado.error.message}`
    )
  }

  if (productosNuevosResultado.error) {
    throw new Error(
      `No se pudieron cargar los productos de la nueva arquitectura: ${productosNuevosResultado.error.message}`
    )
  }

  if (tiposConsultaResultado.error) {
    throw new Error(
      `No se pudieron cargar los tipos de consulta: ${tiposConsultaResultado.error.message}`
    )
  }

  if (estadosConsultaResultado.error) {
    throw new Error(
      `No se pudieron cargar los estados de consulta: ${estadosConsultaResultado.error.message}`
    )
  }

  const tipoConsultaPorId = new Map(
    (tiposConsultaResultado.data ?? []).map((t: any) => [t.id, t])
  )

  const estadoConsultaPorId = new Map(
    (estadosConsultaResultado.data ?? []).map((e: any) => [e.id, e])
  )

  const productosNuevos = productosNuevosResultado.data ?? []
  const idsProductosNuevos = productosNuevos.map((p: any) => p.id)

  const [detalleBafNuevoResultado, detalleMovilNuevoResultado, gestionBafNuevaResultado, gestionMovilNuevaResultado] = await Promise.all([
    idsProductosNuevos.length > 0
      ? admin.from('operacion_producto_baf').select('*').in('producto_operacion_id', idsProductosNuevos)
      : Promise.resolve({ data: [], error: null }),
    idsProductosNuevos.length > 0
      ? admin.from('operacion_producto_movil').select('*').in('producto_operacion_id', idsProductosNuevos)
      : Promise.resolve({ data: [], error: null }),
    idsProductosNuevos.length > 0
      ? admin.from('gestion_producto_baf').select('*').in('producto_operacion_id', idsProductosNuevos)
      : Promise.resolve({ data: [], error: null }),
    idsProductosNuevos.length > 0
      ? admin.from('gestion_producto_movil').select('*').in('producto_operacion_id', idsProductosNuevos)
      : Promise.resolve({ data: [], error: null }),
  ])

  for (const resultado of [detalleBafNuevoResultado, detalleMovilNuevoResultado, gestionBafNuevaResultado, gestionMovilNuevaResultado]) {
    if (resultado.error) throw new Error(`No se pudo cargar la arquitectura multiproducto: ${resultado.error.message}`)
  }

  const estadosBafIds = Array.from(
    new Set(
      [...(gestionBafResultado.data ?? []), ...(gestionBafNuevaResultado.data ?? [])]
        .map((g: any) => g.estado_baf_id)
        .filter(Boolean)
    )
  )

  const estadosPortaIds = Array.from(
    new Set(
      [...(gestionPortaResultado.data ?? []), ...(gestionMovilNuevaResultado.data ?? [])]
        .map((g: any) => g.estado_porta_id)
        .filter(Boolean)
    )
  )

  const estadosBbooIds = Array.from(
    new Set(
      [...(gestionPortaResultado.data ?? []), ...(gestionMovilNuevaResultado.data ?? [])]
        .map((g: any) => g.estado_bboo_id)
        .filter(Boolean)
    )
  )

  const [
    estadosBafResultado,
    estadosPortaResultado,
    estadosBbooResultado,
  ] = await Promise.all([
    estadosBafIds.length > 0
      ? admin
          .from('estados_baf')
          .select('id, nombre')
          .in('id', estadosBafIds)
      : Promise.resolve({ data: [], error: null }),

    estadosPortaIds.length > 0
      ? admin
          .from('estados_porta')
          .select('id, nombre')
          .in('id', estadosPortaIds)
      : Promise.resolve({ data: [], error: null }),

    estadosBbooIds.length > 0
      ? admin
          .from('estados_bboo')
          .select('id, nombre')
          .in('id', estadosBbooIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (estadosBafResultado.error) {
    throw new Error(
      `No se pudieron cargar los Estados BAF: ${estadosBafResultado.error.message}`
    )
  }

  if (estadosPortaResultado.error) {
    throw new Error(
      `No se pudieron cargar los Estados PORTA: ${estadosPortaResultado.error.message}`
    )
  }

  if (estadosBbooResultado.error) {
    throw new Error(
      `No se pudieron cargar los Estados BBOO: ${estadosBbooResultado.error.message}`
    )
  }

  const clientesPorId = new Map(
    (clientesResultado.data ?? []).map((c: any) => [c.id, c])
  )

  const bafPorOperacion = new Map(
    (bafResultado.data ?? []).map((b: any) => [b.operacion_id, b])
  )

  const portaPorOperacion = new Map(
    (portaResultado.data ?? []).map((p: any) => [p.operacion_id, p])
  )

  const estadoBafPorId = new Map(
    (estadosBafResultado.data ?? []).map((e: any) => [e.id, e.nombre])
  )

  const estadoPortaPorId = new Map(
    (estadosPortaResultado.data ?? []).map((e: any) => [e.id, e.nombre])
  )

  const estadoBbooPorId = new Map(
    (estadosBbooResultado.data ?? []).map((e: any) => [e.id, e.nombre])
  )

  const gestionBafPorOperacion = new Map(
    (gestionBafResultado.data ?? []).map((g: any) => [
      g.operacion_id,
      {
        ...g,
        estado_nombre: g.estado_baf_id
          ? estadoBafPorId.get(g.estado_baf_id) ?? null
          : null,
      },
    ])
  )

  const gestionPortaPorOperacion = new Map(
    (gestionPortaResultado.data ?? []).map((g: any) => [
      g.operacion_id,
      {
        ...g,
        estado_nombre: g.estado_porta_id
          ? estadoPortaPorId.get(g.estado_porta_id) ?? null
          : null,
        estado_vendedor_nombre: g.estado_porta_id
          ? estadoPortaPorId.get(g.estado_porta_id) ?? null
          : null,
        estado_bboo_nombre: g.estado_bboo_id
          ? estadoBbooPorId.get(g.estado_bboo_id) ?? null
          : null,
      },
    ])
  )

  const detalleBafNuevoPorProducto = new Map((detalleBafNuevoResultado.data ?? []).map((x: any) => [x.producto_operacion_id, x]))
  const detalleMovilNuevoPorProducto = new Map((detalleMovilNuevoResultado.data ?? []).map((x: any) => [x.producto_operacion_id, x]))
  const gestionBafNuevaPorProducto = new Map((gestionBafNuevaResultado.data ?? []).map((x: any) => [x.producto_operacion_id, x]))
  const gestionMovilNuevaPorProducto = new Map((gestionMovilNuevaResultado.data ?? []).map((x: any) => [x.producto_operacion_id, x]))

  const habilitacionesMoviles = new Map<number, any>()

  const productosMovilesParaEvaluar = productosNuevos.filter(
    (producto: any) =>
      ['PORTA', 'LINEA_NUEVA'].includes(String(producto.tipo_producto))
  )

  if (productosMovilesParaEvaluar.length > 0) {
    const { data: habilitacionesResultado, error: errorHabilitaciones } =
      await admin.rpc('evaluar_habilitaciones_productos_moviles', {
        p_producto_operacion_ids: productosMovilesParaEvaluar.map(
          (producto: any) => producto.id
        ),
      })

    if (errorHabilitaciones) {
      throw new Error(
        `No se pudieron evaluar las habilitaciones móviles: ${errorHabilitaciones.message}`
      )
    }

    for (const habilitacion of habilitacionesResultado ?? []) {
      habilitacionesMoviles.set(
        Number(habilitacion.producto_operacion_id),
        habilitacion
      )
    }
  }

  const productosPorOperacion = new Map<string, any[]>()
  for (const producto of productosNuevos) {
    const gestionBase = producto.tipo_producto === 'BAF'
      ? gestionBafNuevaPorProducto.get(producto.id)
      : gestionMovilNuevaPorProducto.get(producto.id)
    const gestion = gestionBase
      ? {
          ...gestionBase,
          estado_nombre: producto.tipo_producto === 'BAF'
            ? (gestionBase.estado_baf_id ? estadoBafPorId.get(gestionBase.estado_baf_id) ?? null : null)
            : (gestionBase.estado_porta_id ? estadoPortaPorId.get(gestionBase.estado_porta_id) ?? null : null),
          estado_vendedor_nombre: gestionBase.estado_porta_id ? estadoPortaPorId.get(gestionBase.estado_porta_id) ?? null : null,
          estado_bboo_nombre: gestionBase.estado_bboo_id ? estadoBbooPorId.get(gestionBase.estado_bboo_id) ?? null : null,
        }
      : null
    const detalle = producto.tipo_producto === 'BAF'
      ? detalleBafNuevoPorProducto.get(producto.id) ?? null
      : detalleMovilNuevoPorProducto.get(producto.id) ?? null

    const habilitacion =
      habilitacionesMoviles.get(producto.id) ?? null

    const completo = { ...producto, detalle, gestion, habilitacion }
    const lista = productosPorOperacion.get(producto.operacion_id) ?? []
    lista.push(completo)
    productosPorOperacion.set(producto.operacion_id, lista)
  }

  const operacionesCompletas = operaciones.map((operacion: any) => {
    const gestionPorta =
      gestionPortaPorOperacion.get(operacion.id_operacion) ?? null

    const productosNuevos =
      productosPorOperacion.get(operacion.id_operacion) ?? []

    const tratadaNueva = productosNuevos.some(
      (producto: any) =>
        producto.tipo_producto === 'BAF'
          ? Boolean(producto.gestion?.estado_nombre)
          : ['PORTA', 'LINEA_NUEVA'].includes(
              String(producto.tipo_producto)
            ) &&
            Boolean(producto.gestion?.estado_vendedor_nombre)
    )

    const tratadaHistorica =
      operacion.tipo === 'BAF'
        ? Boolean(
            gestionBafPorOperacion.get(operacion.id_operacion)?.estado_nombre
          )
        : operacion.tipo === 'PORTA'
          ? Boolean(gestionPorta?.estado_vendedor_nombre)
          : false

    return {
      ...operacion,
      cliente: operacion.cliente_id
        ? clientesPorId.get(operacion.cliente_id) ?? null
        : null,
      operaciones_baf:
        bafPorOperacion.get(operacion.id_operacion) ?? null,
      operaciones_porta:
        portaPorOperacion.get(operacion.id_operacion) ?? null,
      gestion_baf:
        gestionBafPorOperacion.get(operacion.id_operacion) ?? null,
      gestion_porta: gestionPorta,
      productos_nuevos: productosNuevos,
      tratada: tratadaNueva || tratadaHistorica,
    }
  })

  const cantidadLineasGrupo = new Map<string, number>()

  for (const operacion of operacionesCompletas) {
    if (
      operacion.tipo === 'PORTA' &&
      operacion.grupo_operacion
    ) {
      cantidadLineasGrupo.set(
        operacion.grupo_operacion,
        (cantidadLineasGrupo.get(operacion.grupo_operacion) ?? 0) + 1
      )
    }
  }

  const perfiles = perfilesResultado.data ?? []

  const mediosDespacho = mediosDespachoResultado.data ?? []
  const medioDespachoPorId = new Map(
    mediosDespacho.map((m: any) => [m.id, m.nombre])
  )

  const companias = Array.from(
    new Set(
      (portaResultado.data ?? [])
        .map((p: any) => String(p.compania_actual ?? '').trim())
        .filter(Boolean)
    )
  ) as string[]
  companias.sort((a, b) => a.localeCompare(b, 'es'))

  const nombresResponsables = (operacion: any) => {
    const productos = Array.isArray(operacion.productos_nuevos) ? operacion.productos_nuevos : []
    if (productos.length > 0) {
      const nombres = productos.map((p: any) => {
        const id = p.responsable_id || p.gestion?.responsable_id
        if (!id) return 'Sin responsable'
        const perfil = perfiles.find((item: any) => item.id === id)
        return perfil?.vendedor || perfil?.nombre || 'Usuario no disponible'
      })
      return Array.from(new Set(nombres)) as string[]
    }
    const responsableId = operacion.tipo === 'BAF' ? operacion.gestion_baf?.responsable_id : operacion.gestion_porta?.responsable_id
    if (!responsableId) return ['Sin responsable']
    const perfil = perfiles.find((item: any) => item.id === responsableId)
    return [perfil?.vendedor || perfil?.nombre || 'Usuario no disponible']
  }

  const nombreResponsable = (operacion: any) => nombresResponsables(operacion).join(' | ')

  const nombresBboo = (operacion: any) => {
    const productos = Array.isArray(operacion.productos_nuevos) ? operacion.productos_nuevos : []

    if (productos.length > 0) {
      const moviles = productos.filter((p: any) =>
        ['PORTA', 'LINEA_NUEVA'].includes(String(p.tipo_producto))
      )
      if (moviles.length === 0) return ['-']

      const nombres = moviles.map((p: any) => {
        const id = p.gestion?.bboo_id
        if (!id) return 'Sin BBOO asignado'
        const perfil = perfiles.find((item: any) => item.id === id)
        return perfil?.vendedor || perfil?.nombre || 'Usuario no disponible'
      })
      return Array.from(new Set(nombres)) as string[]
    }

    if (operacion.tipo !== 'PORTA') return ['-']
    const id = operacion.gestion_porta?.bboo_id
    if (!id) return ['Sin BBOO asignado']
    const perfil = perfiles.find((item: any) => item.id === id)
    return [perfil?.vendedor || perfil?.nombre || 'Usuario no disponible']
  }

  const nombreBboo = (operacion: any) => nombresBboo(operacion).join(' | ')

  const nombresAsignacionVista = (operacion: any) =>
    esBboo ? nombresBboo(operacion) : nombresResponsables(operacion)

  const nombreAsignacionVista = (operacion: any) =>
    esBboo ? nombreBboo(operacion) : nombreResponsable(operacion)

  const fechaUltimaGestion = (operacion: any) => {
    if (Array.isArray(operacion.productos_nuevos) && operacion.productos_nuevos.length > 0) {
      const fechas = operacion.productos_nuevos.map((p: any) => p.gestion?.updated_at || p.gestion?.fecha_gestion).filter(Boolean).sort()
      return fechas.length ? fechas[fechas.length - 1] : null
    }
    if (operacion.tipo === 'BAF') {
      return (
        operacion.gestion_baf?.updated_at ||
        operacion.gestion_baf?.fecha_gestion ||
        null
      )
    }

    return operacion.gestion_porta?.updated_at || null
  }

  const consultasCompletas = consultas.map((consulta: any) => {
    const tipoConsulta = tipoConsultaPorId.get(consulta.tipo_consulta_id) as any
    const codigoTipo = String(tipoConsulta?.codigo ?? '')
    const vendedorConsulta = perfiles.find((p: any) => p.id === consulta.vendedor_id)
    const responsableConsulta = consulta.responsable_id
      ? perfiles.find((p: any) => p.id === consulta.responsable_id)
      : null

    const nombreEstado = (id: any) => {
      if (id == null) return null
      const estadoConsulta = estadoConsultaPorId.get(id) as any
      return estadoConsulta?.nombre ? String(estadoConsulta.nombre) : null
    }

    const estadoEsGestionado = (id: any) => {
      if (id == null) return false
      const estadoConsulta = estadoConsultaPorId.get(id) as any
      return String(estadoConsulta?.tipo_estado ?? '').toUpperCase() === 'GESTIONADO'
    }

    let estado = 'Sin gestión'
    let gestionada = false

    if (codigoTipo === 'RELLAMADO_VENTA_GESTION') {
      estado = nombreEstado(consulta.estado_consulta_id) ?? 'Sin gestión'
      gestionada = estadoEsGestionado(consulta.estado_consulta_id)
    } else if (codigoTipo === 'DEUDA_CLIENTE') {
      estado = nombreEstado(consulta.estado_deuda_id) ?? 'Sin gestión'
      gestionada = estadoEsGestionado(consulta.estado_deuda_id)
    } else if (codigoTipo === 'DOMICILIO_COBERTURA') {
      estado = nombreEstado(consulta.estado_cobertura_id) ?? 'Sin gestión'
      gestionada = estadoEsGestionado(consulta.estado_cobertura_id)
    } else if (codigoTipo === 'DOMICILIO_DEUDA') {
      const estadoDeuda = nombreEstado(consulta.estado_deuda_id)
      const estadoCobertura = nombreEstado(consulta.estado_cobertura_id)

      if (estadoDeuda || estadoCobertura) {
        estado = [
          estadoDeuda ? `Deuda: ${estadoDeuda}` : 'Deuda: Sin gestión',
          estadoCobertura ? `Cobertura: ${estadoCobertura}` : 'Cobertura: Sin gestión',
        ].join(' | ')
      }

      gestionada =
        estadoEsGestionado(consulta.estado_deuda_id) &&
        estadoEsGestionado(consulta.estado_cobertura_id)
    } else {
      estado = nombreEstado(consulta.estado_consulta_id) ?? 'Sin gestión'
      gestionada = estadoEsGestionado(consulta.estado_consulta_id)
    }

    return {
      clase: 'CONSULTA' as const,
      id: String(consulta.id),
      fecha_ingreso: consulta.marca_temporal,
      registro: 'CONSULTA',
      tipo: tipoConsulta?.nombre || codigoTipo || 'Consulta',
      tipo_codigo: codigoTipo,
      vendedor:
        vendedorConsulta?.vendedor ||
        vendedorConsulta?.nombre ||
        'Usuario no disponible',
      responsable:
        responsableConsulta?.vendedor ||
        responsableConsulta?.nombre ||
        'Sin asignar',
      cliente: consulta.cliente || '-',
      dni: consulta.dni || '-',
      telefono: consulta.telefono || '-',
      estado,
      gestionada,
      operacion_vinculada: consulta.operacion_id || '-',
      domicilio: consulta.domicilio || '-',
      localidad: consulta.localidad || '-',
      observaciones: consulta.observaciones || '-',
      original: consulta,
    }
  })

  const vendedores = Array.from(
    new Set([
      ...operacionesCompletas
        .map((o: any) => String(o.vendedor ?? '').trim())
        .filter(Boolean),
      ...consultasCompletas
        .map((c: any) => String(c.vendedor ?? '').trim())
        .filter(Boolean),
    ])
  ) as string[]

  const responsables = Array.from(
    new Set([
      ...operacionesCompletas.flatMap((o: any) => nombresAsignacionVista(o)),
      ...consultasCompletas
        .map((c: any) => String(c.responsable ?? '').trim())
        .filter((nombre: string) => nombre && nombre !== 'Sin asignar'),
    ])
  ) as string[]

  const estados = Array.from(
    new Set([
      ...operacionesCompletas.flatMap((o: any) => {
        const p = o.productos_nuevos ?? []
        return p.length
          ? p.map((x: any) =>
              x.tipo_producto === 'BAF'
                ? x.gestion?.estado_nombre || 'Sin gestión'
                : x.habilitacion?.habilitado === false
                  ? 'Pendiente OT'
                  : x.gestion?.estado_nombre || 'Sin gestión'
            )
          : [estadoVisible(o)]
      }),
      ...consultasCompletas
        .map((c: any) => String(c.estado ?? '').trim())
        .filter(Boolean),
    ])
  ) as string[]

  vendedores.sort((a, b) => a.localeCompare(b, 'es'))
  responsables.sort((a, b) => a.localeCompare(b, 'es'))
  estados.sort((a, b) => a.localeCompare(b, 'es'))

  type FiltroAvanzado = {
    campo: string
    condicion: string
    valor: string
    valor2: string
    conector: 'AND' | 'OR'
  }

  const filtrosAvanzados: FiltroAvanzado[] = [1, 2, 3, 4]
    .map((numero) => {
      const campo = String((params as any)[`f${numero}_field`] ?? '').trim()
      const condicion = String((params as any)[`f${numero}_op`] ?? '').trim()
      const valor = String((params as any)[`f${numero}_value`] ?? '').trim()
      const valor2 = String((params as any)[`f${numero}_value2`] ?? '').trim()
      const conector =
        numero > 1 && String((params as any)[`f${numero}_join`] ?? 'AND') === 'OR'
          ? 'OR'
          : 'AND'

      return { campo, condicion, valor, valor2, conector } as FiltroAvanzado
    })
    .filter((filtro) => filtro.campo && filtro.condicion)

  const hayFiltrosAplicados = Boolean(
    q ||
    filtroRegistro ||
    filtroTipo ||
    filtroVendedor ||
    filtroResponsable ||
    filtroEstado ||
    bandejaActiva ||
    filtrosAvanzados.length > 0
  )

  const filtrosActualesParaBandeja = {
    registro: filtroRegistro,
    tipo: filtroTipo,
    vendedor: filtroVendedor,
    responsable: filtroResponsable,
    estado: filtroEstado,
    avanzados: filtrosAvanzados,
  }

  const puedeGuardarBandeja = Boolean(
    filtroRegistro ||
    filtroTipo ||
    filtroVendedor ||
    filtroResponsable ||
    filtroEstado ||
    filtrosAvanzados.length > 0
  )

  const fechaSoloDiaArgentina = (valor: string | null | undefined) => {
    if (!valor) return ''
    const fecha = new Date(valor)
    if (Number.isNaN(fecha.getTime())) return ''

    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(fecha)
  }

  const valorCampoAvanzado = (operacion: any, campo: string) => {
    if (operacion.clase === 'CONSULTA') {
      switch (campo) {
        case 'registro':
          return 'CONSULTA'
        case 'estado':
          return String(operacion.estado ?? '')
        case 'tipo':
        case 'servicios':
          return String(operacion.tipo ?? '')
        case 'vendedor':
          return String(operacion.vendedor ?? '')
        case 'responsable':
          return operacion.responsable === 'Sin asignar'
            ? ''
            : String(operacion.responsable ?? '')
        case 'domicilio':
          return operacion.domicilio === '-'
            ? ''
            : String(operacion.domicilio ?? '')
        case 'localidad':
          return operacion.localidad === '-'
            ? ''
            : String(operacion.localidad ?? '')
        case 'operacion_vinculada':
          return operacion.operacion_vinculada === '-'
            ? ''
            : String(operacion.operacion_vinculada ?? '')
        case 'observaciones':
          return operacion.observaciones === '-'
            ? ''
            : String(operacion.observaciones ?? '')
        default:
          return ''
      }
    }

    const porta = operacion.operaciones_porta
    const gestionPorta = operacion.gestion_porta

    switch (campo) {
      case 'registro':
        return 'VENTA'
      case 'estado':
        return estadoVisible(operacion)
      case 'tipo':
      case 'servicios':
        return tipoVisible(operacion)
      case 'vendedor':
        return String(operacion.vendedor ?? '')
      case 'responsable': {
        const nombre = nombreAsignacionVista(operacion)
        if (nombre === 'Sin responsable' || nombre === 'Sin BBOO asignado' || nombre === '-') return ''
        return nombre
      }
      case 'medio_despacho':
        return gestionPorta?.medio_despacho_chip_id
          ? String(medioDespachoPorId.get(gestionPorta.medio_despacho_chip_id) ?? '')
          : ''
      case 'tipo_sim':
        return porta?.tipo_sim === 'ESIM' ? 'eSIM' : String(porta?.tipo_sim ?? '')
      case 'compania_actual':
        return String(porta?.compania_actual ?? '')
      case 'fecha_carga_stl':
        return fechaSoloDiaArgentina(gestionPorta?.fecha_carga_stl)
      case 'fecha_porta':
        return fechaSoloDiaArgentina(gestionPorta?.fecha_porta)
      case 'pin':
        return String(gestionPorta?.pin_lnva_nro ?? '').trim()
      case 'sim_operativo':
        return String(gestionPorta?.sim ?? '').trim()
      case 'numero_seguimiento':
        return String(gestionPorta?.numero_seguimiento ?? '').trim()
      default:
        return ''
    }
  }

  const cumpleFiltroAvanzado = (operacion: any, filtro: FiltroAvanzado) => {
    const actual = valorCampoAvanzado(operacion, filtro.campo).trim()
    const esperado = filtro.valor.trim()

    if (filtro.condicion === 'vacio') return actual === ''
    if (filtro.condicion === 'no_vacio') return actual !== ''

    if (['fecha_carga_stl', 'fecha_porta'].includes(filtro.campo)) {
      if (!actual || !esperado) return false
      if (filtro.condicion === 'es') return actual === esperado
      if (filtro.condicion === 'antes') return actual < esperado
      if (filtro.condicion === 'despues') return actual > esperado
      if (filtro.condicion === 'entre') {
        return Boolean(filtro.valor2) && actual >= esperado && actual <= filtro.valor2
      }
      return false
    }

    const actualNormalizado = actual.toLocaleLowerCase('es')
    const esperadoNormalizado = esperado.toLocaleLowerCase('es')

    if (filtro.condicion === 'es') return actualNormalizado === esperadoNormalizado
    if (filtro.condicion === 'no_es') return actualNormalizado !== esperadoNormalizado
    if (filtro.condicion === 'contiene') {
      if (!esperadoNormalizado) return false
      return actualNormalizado.includes(esperadoNormalizado)
    }

    return true
  }

  const cumpleFiltrosAvanzados = (operacion: any) => {
    if (filtrosAvanzados.length === 0) return true

    let resultado = cumpleFiltroAvanzado(operacion, filtrosAvanzados[0])

    for (let i = 1; i < filtrosAvanzados.length; i += 1) {
      const filtro = filtrosAvanzados[i]
      const cumple = cumpleFiltroAvanzado(operacion, filtro)
      resultado = filtro.conector === 'OR' ? resultado || cumple : resultado && cumple
    }

    return resultado
  }

  const nombrePerfilPorId = (id: string | null | undefined) => {
    if (!id) return '-'
    const perfil = perfiles.find((item: any) => item.id === id)
    return perfil?.vendedor || perfil?.nombre || 'Usuario no disponible'
  }

  const fechaSoloArgentinaVisual = (valor: string | null | undefined) => {
    if (!valor) return '-'

    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      const [anio, mes, dia] = valor.split('-')
      return `${dia}/${mes}/${anio}`
    }

    const fecha = new Date(valor)
    if (Number.isNaN(fecha.getTime())) return '-'

    return new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(fecha)
  }

  const valorColumna = (operacion: any, campo: string) => {
    if (operacion.clase === 'CONSULTA') {
      switch (campo) {
        case 'fecha_ingreso':
          return operacion.fecha_ingreso || null
        case 'registro':
          return 'CONSULTA'
        case 'tipo':
        case 'servicios':
          return operacion.tipo || 'Consulta'
        case 'vendedor':
          return operacion.vendedor || '-'
        case 'responsable':
          return operacion.responsable || 'Sin asignar'
        case 'cliente':
          return operacion.cliente || '-'
        case 'dni':
          return operacion.dni || '-'
        case 'telefono':
          return operacion.telefono || '-'
        case 'estado':
          return operacion.estado || 'Sin gestión'
        case 'operacion_vinculada':
          return operacion.operacion_vinculada || '-'
        case 'domicilio':
          return operacion.domicilio || '-'
        case 'localidad':
          return operacion.localidad || '-'
        case 'observaciones':
          return operacion.observaciones || '-'
        case 'general_1':
        case 'general_2':
        case 'general_3':
          return '-'
        default:
          return '-'
      }
    }

    const cliente = operacion.cliente
    const porta = operacion.operaciones_porta
    const gestionPorta = operacion.gestion_porta
    const gestionBaf = operacion.gestion_baf
    const productosNuevos = Array.isArray(operacion.productos_nuevos) ? operacion.productos_nuevos : []
    const esNueva = productosNuevos.length > 0

    if (campo === 'id_mis_referidos') {
      return String(operacion.origen_dato || '').toUpperCase() === 'PSR'
        ? operacion.obs || '-'
        : '-'
    }

    const bafNuevo = productosNuevos.find((p: any) => p.tipo_producto === 'BAF')
    const movilesNuevos = productosNuevos.filter((p: any) => ['PORTA', 'LINEA_NUEVA'].includes(p.tipo_producto))
    const valoresMoviles = (fn: (p: any) => any) => movilesNuevos.map(fn).filter((v: any) => v !== null && v !== undefined && String(v).trim() !== '').join(' | ') || '-'

    if (esNueva) {
      switch (campo) {
        case 'tipo': return tipoVisible(operacion)
        case 'servicios': return tipoVisible(operacion)
        case 'responsable': return nombreAsignacionVista(operacion)
        case 'numero_linea': return valoresMoviles((p) => p.detalle?.numero_linea)
        case 'compania_actual': return valoresMoviles((p) => p.detalle?.compania_actual)
        case 'tipo_sim': return valoresMoviles((p) => p.detalle?.tipo_sim === 'ESIM' ? 'eSIM' : p.detalle?.tipo_sim)
        case 'plan_acordado': return valoresMoviles((p) => p.plan_snapshot)
        case 'plan_cargado': return valoresMoviles((p) => p.gestion?.plan_cargado)
        case 'estado_vendedor': return valoresMoviles((p) => p.habilitacion?.habilitado === false ? 'Pendiente OT' : (p.gestion?.estado_vendedor_nombre || 'Sin gestión'))
        case 'estado_bboo': return valoresMoviles((p) => p.habilitacion?.habilitado === false ? 'Pendiente OT' : (p.gestion?.estado_bboo_nombre || 'Sin gestión'))
        case 'estado_baf': return bafNuevo?.gestion?.estado_nombre || (bafNuevo ? 'Sin gestión' : '-')
        case 'bboo': return valoresMoviles((p) => nombrePerfilPorId(p.gestion?.bboo_id))
        case 'fecha_carga_stl': return movilesNuevos.find((p: any) => p.gestion?.fecha_carga_stl)?.gestion?.fecha_carga_stl || null
        case 'fecha_porta': return movilesNuevos.find((p: any) => p.gestion?.fecha_porta)?.gestion?.fecha_porta || null
        case 'medio_despacho_chip': return valoresMoviles((p) => p.gestion?.medio_despacho_chip_id ? medioDespachoPorId.get(p.gestion.medio_despacho_chip_id) : '')
        case 'numero_seguimiento': return valoresMoviles((p) => p.gestion?.numero_seguimiento)
        case 'pin': return valoresMoviles((p) => p.gestion?.pin_lnva_nro)
        case 'sim_operativo': return valoresMoviles((p) => p.gestion?.sim)
        case 'sds': return [bafNuevo?.gestion?.sds, ...movilesNuevos.map((p: any) => p.gestion?.sds)].filter(Boolean).join(' | ') || '-'
        case 'fecha_instalacion': return bafNuevo?.gestion?.fecha_instalacion || null
        case 'orden_trabajo': return bafNuevo?.gestion?.orden_trabajo || '-'
      }
    }

    switch (campo) {
      case 'fecha_ingreso':
        return operacion.fecha_hora || null
      case 'registro':
        return 'VENTA'
      case 'tipo':
      case 'servicios':
        return tipoVisible(operacion)
      case 'estado':
        return estadoVisible(operacion)
      case 'vendedor':
        return operacion.vendedor || '-'
      case 'responsable':
        return nombreAsignacionVista(operacion)
      case 'cliente':
        return nombreCliente(cliente)
      case 'dni':
        return cliente?.dni || '-'
      case 'telefono':
        return cliente?.telefono || '-'
      case 'numero_linea':
        return operacion.tipo === 'PORTA' ? porta?.numero_linea || '-' : '-'
      case 'compania_actual':
        return operacion.tipo === 'PORTA' ? porta?.compania_actual || '-' : '-'
      case 'tipo_sim':
        if (operacion.tipo !== 'PORTA') return '-'
        return porta?.tipo_sim === 'ESIM' ? 'eSIM' : porta?.tipo_sim || '-'
      case 'plan_acordado':
        return operacion.tipo === 'PORTA' ? porta?.gigas_acordados || '-' : '-'
      case 'plan_cargado':
        return operacion.tipo === 'PORTA' ? gestionPorta?.plan_cargado || '-' : '-'
      case 'estado_vendedor':
        return operacion.tipo === 'PORTA'
          ? gestionPorta?.estado_vendedor_nombre || 'Sin gestión'
          : '-'
      case 'estado_bboo':
        return operacion.tipo === 'PORTA'
          ? gestionPorta?.estado_bboo_nombre || 'Sin gestión'
          : '-'
      case 'estado_baf':
        return operacion.tipo === 'BAF'
          ? gestionBaf?.estado_nombre || 'Sin gestión'
          : '-'
      case 'bboo':
        return operacion.tipo === 'PORTA'
          ? nombrePerfilPorId(gestionPorta?.bboo_id)
          : '-'
      case 'fecha_carga_stl':
        return operacion.tipo === 'PORTA' ? gestionPorta?.fecha_carga_stl || null : null
      case 'fecha_porta':
        return operacion.tipo === 'PORTA' && !porta?.es_linea_nueva
          ? gestionPorta?.fecha_porta || null
          : null
      case 'medio_despacho_chip':
        return operacion.tipo === 'PORTA' && gestionPorta?.medio_despacho_chip_id
          ? medioDespachoPorId.get(gestionPorta.medio_despacho_chip_id) || '-'
          : '-'
      case 'numero_seguimiento':
        return operacion.tipo === 'PORTA' ? gestionPorta?.numero_seguimiento || '-' : '-'
      case 'pin':
        return operacion.tipo === 'PORTA' ? gestionPorta?.pin_lnva_nro || '-' : '-'
      case 'sim_operativo':
        return operacion.tipo === 'PORTA' ? gestionPorta?.sim || '-' : '-'
      case 'sds':
        return operacion.tipo === 'BAF'
          ? gestionBaf?.sds || '-'
          : gestionPorta?.sds || '-'
      case 'fecha_instalacion':
        return operacion.tipo === 'BAF' ? gestionBaf?.fecha_instalacion || null : null
      case 'orden_trabajo':
        return operacion.tipo === 'BAF' ? gestionBaf?.orden_trabajo || '-' : '-'
      default:
        return '-'
    }
  }

  const renderColumna = (operacion: any, campo: string) => {
    const valor = valorColumna(operacion, campo)

    if (campo === 'fecha_ingreso') {
      return <FechaDosLineas fecha={valor ? String(valor) : null} />
    }

    if (['fecha_carga_stl', 'fecha_porta', 'fecha_instalacion'].includes(campo)) {
      return <span>{fechaSoloArgentinaVisual(valor ? String(valor) : null)}</span>
    }

    if (campo === 'tipo' || campo === 'servicios') {
      return (
        <span className="inline-block max-w-full rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-700">
          {String(valor ?? '-')}
        </span>
      )
    }

    if (['estado_vendedor', 'estado_bboo', 'estado_baf'].includes(campo)) {
      return (
        <span
          className="inline-block max-h-10 max-w-full overflow-hidden rounded-lg border border-gray-200 bg-white px-2 py-0.5 text-[11px] leading-4 text-gray-700"
          title={String(valor ?? '-')}
        >
          {String(valor ?? '-')}
        </span>
      )
    }

    return (
      <div
        className="max-h-10 overflow-hidden break-words leading-5"
        title={String(valor ?? '-')}
      >
        {String(valor ?? '-')}
      </div>
    )
  }

  const anchoAccion = 90
  const anchoTabla =
    columnasVista.reduce((total: number, columna: any) => total + columna.ancho, 0) +
    anchoAccion

  const registrosGestion = [
    ...operacionesCompletas,
    ...consultasCompletas,
  ]

  const registrosFiltrados = registrosGestion.filter((registro: any) => {
    const esConsulta = registro.clase === 'CONSULTA'

    if (filtroRegistro) {
      const claseRegistro = esConsulta ? 'CONSULTA' : 'VENTA'
      if (claseRegistro !== filtroRegistro) return false
    }

    if (filtroTipo) {
      if (esConsulta) {
        if (String(registro.tipo_codigo ?? '').toUpperCase() !== filtroTipo) {
          return false
        }
      } else {
        const tipos = tiposOperacion(registro)
        if (!tipos.includes(filtroTipo)) return false
      }
    }

    if (filtroVendedor) {
      if (String(registro.vendedor ?? '') !== filtroVendedor) return false
    }

    if (filtroResponsable) {
      if (esConsulta) {
        if (String(registro.responsable ?? '') !== filtroResponsable) return false
      } else {
        if (!nombresAsignacionVista(registro).includes(filtroResponsable)) {
          return false
        }
      }
    }

    if (filtroEstado) {
      if (esConsulta) {
        if (String(registro.estado ?? '') !== filtroEstado) return false
      } else {
        if (!estadoVisible(registro).includes(filtroEstado)) return false
      }
    }

    if (!cumpleFiltrosAvanzados(registro)) return false

    if (!q) return true

    if (esConsulta) {
      const texto = [
        registro.id,
        registro.registro,
        registro.tipo,
        registro.tipo_codigo,
        registro.vendedor,
        registro.responsable,
        registro.cliente,
        registro.dni,
        registro.telefono,
        registro.estado,
        registro.operacion_vinculada,
        registro.domicilio,
        registro.localidad,
        registro.observaciones,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return texto.includes(q)
    }

    const cliente = registro.cliente
    const porta = registro.operaciones_porta

    const texto = [
      registro.id_operacion,
      registro.vendedor,
      nombreResponsable(registro),
      nombreBboo(registro),
      registro.origen_dato,
      registro.obs,
      cliente?.dni,
      cliente?.nombre,
      cliente?.apellido,
      cliente?.telefono,
      porta?.nim,
      porta?.numero_linea,
      lineaVisible(registro, cantidadLineasGrupo),
      productoVisible(registro),
      estadoVisible(registro),
      ...(registro.productos_nuevos ?? []).flatMap((p: any) => [
        p.tipo_producto,
        p.plan_snapshot,
        p.producto_snapshot,
        p.detalle?.nim,
        p.detalle?.numero_linea,
        p.detalle?.compania_actual,
      ]),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return texto.includes(q)
  })

  /*
   * Orden cronológico fijo de Gestión de Ventas.
   * Los filtros y la disposición de columnas no alteran el orden de las filas.
   * Más reciente primero, según la fecha original de ingreso.
   */
  const ventas = [...registrosFiltrados].sort((a: any, b: any) => {
    const fechaA = new Date(
      a.clase === 'CONSULTA' ? a.fecha_ingreso : a.fecha_hora || 0
    ).getTime()

    const fechaB = new Date(
      b.clase === 'CONSULTA' ? b.fecha_ingreso : b.fecha_hora || 0
    ).getTime()

    return fechaB - fechaA
  })

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader
        rol={profile.rol}
        usuario={
          profile.nombre?.trim() ||
          user.email ||
          'Usuario'
        }
        actual="GESTION_VENTAS"
        puedeGestionarVentas={true}
      />

      <div className="mx-auto max-w-7xl p-4 sm:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Gestión de Ventas
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestión operativa de BAF, Portabilidad y Línea Nueva.
          </p>
        </div>

        <ExportarVentas
          puedeExportar={
            profile.rol === 'BBOO' ||
            profile.rol === 'SUPERVISOR' ||
            profile.rol === 'ADMIN' ||
            (profile.rol === 'VENDEDOR' && profile.puede_gestionar_ventas === true)
          }
        />

        <BandejasGestionVentas
          bandejas={(bandejasResultado ?? []).map((b: any) => ({
            id: String(b.id),
            nombre: String(b.nombre ?? ''),
            filtros: b.filtros ?? {},
          }))}
          filtrosActuales={filtrosActualesParaBandeja}
          puedeGuardar={puedeGuardarBandeja}
          bandejaActiva={bandejaActiva}
        />

        <form
          method="get"
          className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-6"
        >
          <div className="md:col-span-2 xl:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Buscar
            </label>
            <input
              type="text"
              name="q"
              defaultValue={params?.q ?? ''}
              placeholder="ID, cliente, DNI, teléfono, NIM, línea, vendedor..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
            />
          </div>

          {!esBboo && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Registro
              </label>
              <select
                name="registro"
                defaultValue={filtroRegistro}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
              >
                <option value="">Todos</option>
                <option value="VENTA">Venta</option>
                <option value="CONSULTA">Consulta</option>
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Tipo
            </label>
            <select
              name="tipo"
              defaultValue={filtroTipo}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
            >
              <option value="">Todos</option>
              <option value="BAF">BAF</option>
              <option value="PORTA">PORTA</option>
              <option value="LN">Línea Nueva</option>
              {!esBboo &&
                (tiposConsultaResultado.data ?? []).map((tipo: any) => (
                  <option key={`consulta-${tipo.id}`} value={tipo.codigo}>
                    {tipo.nombre}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Vendedor
            </label>
            <select
              name="vendedor"
              defaultValue={filtroVendedor}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
            >
              <option value="">Todos</option>
              {vendedores.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              {esBboo ? 'BBOO asignado' : 'Responsable'}
            </label>
            <select
              name="responsable"
              defaultValue={filtroResponsable}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
            >
              <option value="">Todos</option>
              {responsables.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Estado
            </label>
            <select
              name="estado"
              defaultValue={filtroEstado}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
            >
              <option value="">Todos</option>
              {estados.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>

          <FiltrosAvanzadosVentas
            estados={estados}
            vendedores={vendedores}
            responsables={responsables}
            mediosDespacho={mediosDespacho.map((m: any) => String(m.nombre ?? '')).filter(Boolean)}
            companias={companias}
            tiposConsulta={(tiposConsultaResultado.data ?? [])
              .map((tipo: any) => String(tipo.codigo ?? ''))
              .filter(Boolean)}
            iniciales={filtrosAvanzados}
          />

          <div className="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-6">
            <button
              type="submit"
              className={`rounded-lg bg-red-600 px-5 py-2 font-semibold text-white hover:bg-red-700 ${
                hayFiltrosAplicados
                  ? 'animate-pulse ring-2 ring-red-300 ring-offset-2'
                  : ''
              }`}
            >
              Aplicar filtros
            </button>
            <a
              href="/gestion-ventas"
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Limpiar
            </a>
          </div>
        </form>

        <div className="mb-3 text-sm text-gray-500">
          {ventas.length} {ventas.length === 1 ? 'registro' : 'registros'}
        </div>

        <div className="hidden overflow-x-auto rounded-2xl border border-gray-200 bg-white lg:block">
          <table
            className="table-fixed text-left text-[13px]"
            style={{ width: `${anchoTabla}px`, minWidth: '100%' }}
          >
            <colgroup>
              {columnasVista.map((columna: any) => (
                <col
                  key={columna.campo}
                  style={{ width: `${columna.ancho}px` }}
                />
              ))}
              <col style={{ width: `${anchoAccion}px` }} />
            </colgroup>

            <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
              <tr>
                {columnasVista.map((columna: any) => (
                  <th
                    key={columna.campo}
                    className="px-2 py-3"
                    title={columna.etiqueta}
                  >
                    {columna.etiqueta}
                  </th>
                ))}
                <th className="px-2 py-3 text-right">Acción</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {ventas.map((operacion: any) => {
                const esConsultaFila = operacion.clase === 'CONSULTA'

                return (
                <tr
                  key={
                    esConsultaFila
                      ? `consulta-${operacion.id}`
                      : `venta-${operacion.id_operacion}`
                  }
                  className={
                    esConsultaFila
                      ? operacion.gestionada
                        ? 'align-top bg-green-50 hover:bg-green-100'
                        : 'align-top bg-yellow-100 hover:bg-yellow-200'
                      : operacion.tratada
                        ? 'align-top bg-green-200 hover:bg-green-300'
                        : 'align-top hover:bg-gray-50'
                  }
                >
                  {columnasVista.map((columna: any) => (
                    <td
                      key={columna.campo}
                      className={
                        columna.campo === 'vendedor'
                          ? 'px-2 py-3 font-semibold text-gray-900'
                          : 'px-2 py-3 text-gray-600'
                      }
                    >
                      {renderColumna(operacion, columna.campo)}
                    </td>
                  ))}

                  <td className="px-2 py-3 text-right">
                    {esConsultaFila ? (
                      <a
                        href={`/gestion-ventas/consulta/${encodeURIComponent(
                          String(operacion.id)
                        )}`}
                        className="whitespace-nowrap font-semibold text-amber-700 hover:text-amber-800"
                      >
                        Gestionar
                      </a>
                    ) : (
                      <a
                        href={`/gestion-ventas/${encodeURIComponent(
                          operacion.id_operacion
                        )}`}
                        className="whitespace-nowrap font-semibold text-red-600 hover:text-red-700"
                      >
                        Gestionar
                      </a>
                    )}
                  </td>
                </tr>
                )
              })}

              {ventas.length === 0 && (
                <tr>
                  <td
                    colSpan={columnasVista.length + 1}
                    className="px-4 py-10 text-center text-gray-500"
                  >
                    No se encontraron registros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 lg:hidden">
          {ventas.map((operacion: any) => (
            <div
              key={
                operacion.clase === 'CONSULTA'
                  ? `consulta-${operacion.id}`
                  : `venta-${operacion.id_operacion}`
              }
              className={
                operacion.clase === 'CONSULTA'
                  ? operacion.gestionada
                    ? 'rounded-2xl border border-green-100 bg-green-50 p-4 hover:bg-green-100'
                    : 'rounded-2xl border border-yellow-200 bg-yellow-100 p-4 hover:bg-yellow-200'
                  : operacion.tratada
                    ? 'rounded-2xl border border-green-300 bg-green-200 p-4 hover:bg-green-300'
                    : 'rounded-2xl border border-gray-200 bg-white p-4'
              }
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {columnasVista.map((columna: any) => (
                  <div key={columna.campo}>
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      {columna.etiqueta}
                    </div>
                    <div className="mt-1 text-sm text-gray-700">
                      {renderColumna(operacion, columna.campo)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-gray-100 pt-3 text-right">
                {operacion.clase === 'CONSULTA' ? (
                  <a
                    href={`/gestion-ventas/consulta/${encodeURIComponent(
                      String(operacion.id)
                    )}`}
                    className="text-sm font-semibold text-amber-700 hover:text-amber-800"
                  >
                    Gestionar
                  </a>
                ) : (
                  <a
                    href={`/gestion-ventas/${encodeURIComponent(
                      operacion.id_operacion
                    )}`}
                    className="text-sm font-semibold text-red-600 hover:text-red-700"
                  >
                    Gestionar
                  </a>
                )}
              </div>
            </div>
          ))}

          {ventas.length === 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500">
              No se encontraron registros.
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
