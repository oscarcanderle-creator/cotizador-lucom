import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import { createAdminClient } from '../../utils/supabase/admin'
import AppHeader from '../../components/AppHeader'
import FiltrosAvanzadosVentas from '../../components/FiltrosAvanzadosVentas'
import BandejasGestionVentas from '../../components/BandejasGestionVentas'
import ExportarVentas from '../../components/ExportarVentas'

type SearchParams = Promise<{
  q?: string
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

function tipoVisible(operacion: any) {
  if (
    operacion.tipo === 'PORTA' &&
    operacion.operaciones_porta?.es_linea_nueva
  ) {
    return 'LN'
  }

  return operacion.tipo
}

function productoVisible(operacion: any) {
  if (operacion.tipo === 'BAF') {
    return operacion.operaciones_baf?.plan || '-'
  }

  if (operacion.tipo === 'PORTA') {
    const porta = operacion.operaciones_porta

    if (!porta) return '-'

    if (porta.es_linea_nueva) {
      return porta.gigas_acordados
        ? `Línea Nueva · ${porta.gigas_acordados}`
        : 'Línea Nueva'
    }

    return porta.gigas_acordados
      ? `Portabilidad · ${porta.gigas_acordados}`
      : 'Portabilidad'
  }

  return '-'
}

function estadoVisible(operacion: any) {
  if (operacion.tipo === 'BAF') {
    return operacion.gestion_baf?.estado_nombre || 'Sin gestión'
  }

  if (operacion.tipo === 'PORTA') {
    return operacion.gestion_porta?.estado_nombre || 'Sin gestión'
  }

  return 'Sin gestión'
}

function lineaVisible(
  operacion: any,
  cantidadLineasGrupo: Map<string, number>
) {
  if (operacion.tipo !== 'PORTA') return '-'

  const porta = operacion.operaciones_porta
  if (!porta) return '-'

  const numero = porta.numero_linea ?? '-'
  const cantidad = operacion.grupo_operacion
    ? cantidadLineasGrupo.get(operacion.grupo_operacion) ?? 1
    : 1

  const tipo = porta.es_linea_nueva ? 'LN' : 'PORTA'

  const nim =
    !porta.es_linea_nueva && String(porta.nim ?? '').trim()
      ? ` · ${String(porta.nim).trim()}`
      : ''

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
  const puedeGestionarVentas = esVendedorGestor || esBboo

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
          etiqueta: String(columna.etiqueta || columna.campo),
          ancho: Math.min(600, Math.max(60, Number(columna.ancho) || 140)),
          orden: Number(columna.orden) || 0,
        }))
      : columnasPredeterminadas

  const params = await searchParams
  const q = String(params?.q ?? '').trim().toLowerCase()
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
      cliente_id,
      grupo_operacion
    `)
    .in('tipo', ['BAF', 'PORTA'])
    .order('fecha_hora', { ascending: false })

  if (error) {
    throw new Error(`No se pudieron cargar las ventas: ${error.message}`)
  }

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

  const estadosBafIds = Array.from(
    new Set(
      (gestionBafResultado.data ?? [])
        .map((g: any) => g.estado_baf_id)
        .filter(Boolean)
    )
  )

  const estadosPortaIds = Array.from(
    new Set(
      (gestionPortaResultado.data ?? [])
        .map((g: any) => g.estado_porta_id)
        .filter(Boolean)
    )
  )

  const estadosBbooIds = Array.from(
    new Set(
      (gestionPortaResultado.data ?? [])
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

  const operacionesCompletas = operaciones.map((operacion: any) => ({
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
    gestion_porta:
      gestionPortaPorOperacion.get(operacion.id_operacion) ?? null,
  }))

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

  const nombreResponsable = (operacion: any) => {
    const responsableId =
      operacion.tipo === 'BAF'
        ? operacion.gestion_baf?.responsable_id
        : operacion.gestion_porta?.responsable_id

    if (!responsableId) return 'Sin responsable'

    const perfil = perfiles.find(
      (item: any) => item.id === responsableId
    )

    return (
      perfil?.vendedor ||
      perfil?.nombre ||
      'Usuario no disponible'
    )
  }

  const fechaUltimaGestion = (operacion: any) => {
    if (operacion.tipo === 'BAF') {
      return (
        operacion.gestion_baf?.updated_at ||
        operacion.gestion_baf?.fecha_gestion ||
        null
      )
    }

    return operacion.gestion_porta?.updated_at || null
  }

  const vendedores = Array.from(
    new Set(
      operacionesCompletas
        .map((o: any) => String(o.vendedor ?? '').trim())
        .filter(Boolean)
    )
  ) as string[]

  const responsables = Array.from(
    new Set(
      operacionesCompletas.map((o: any) => nombreResponsable(o))
    )
  ) as string[]

  const estados = Array.from(
    new Set(
      operacionesCompletas.map((o: any) => estadoVisible(o))
    )
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

  const filtrosActualesParaBandeja = {
    tipo: filtroTipo,
    vendedor: filtroVendedor,
    responsable: filtroResponsable,
    estado: filtroEstado,
    avanzados: filtrosAvanzados,
  }

  const puedeGuardarBandeja = Boolean(
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
    const porta = operacion.operaciones_porta
    const gestionPorta = operacion.gestion_porta

    switch (campo) {
      case 'estado':
        return estadoVisible(operacion)
      case 'tipo':
        return tipoVisible(operacion)
      case 'vendedor':
        return String(operacion.vendedor ?? '')
      case 'responsable':
        return nombreResponsable(operacion) === 'Sin responsable'
          ? ''
          : nombreResponsable(operacion)
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
    if (filtro.condicion === 'contiene') return actualNormalizado.includes(esperadoNormalizado)

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
    const cliente = operacion.cliente
    const porta = operacion.operaciones_porta
    const gestionPorta = operacion.gestion_porta
    const gestionBaf = operacion.gestion_baf

    switch (campo) {
      case 'fecha_ingreso':
        return operacion.fecha_hora || null
      case 'tipo':
        return tipoVisible(operacion)
      case 'vendedor':
        return operacion.vendedor || '-'
      case 'responsable':
        return nombreResponsable(operacion)
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

    if (campo === 'tipo') {
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

  const ventasFiltradas = operacionesCompletas.filter((operacion: any) => {
    const tipo = tipoVisible(operacion)

    if (filtroTipo && filtroTipo !== tipo) return false

    if (
      filtroVendedor &&
      operacion.vendedor !== filtroVendedor
    ) {
      return false
    }

    if (
      filtroResponsable &&
      nombreResponsable(operacion) !== filtroResponsable
    ) {
      return false
    }

    if (
      filtroEstado &&
      estadoVisible(operacion) !== filtroEstado
    ) {
      return false
    }

    if (!cumpleFiltrosAvanzados(operacion)) return false

    if (!q) return true

    const cliente = operacion.cliente
    const porta = operacion.operaciones_porta

    const texto = [
      operacion.id_operacion,
      operacion.vendedor,
      nombreResponsable(operacion),
      operacion.origen_dato,
      cliente?.dni,
      cliente?.nombre,
      cliente?.apellido,
      cliente?.telefono,
      porta?.nim,
      porta?.numero_linea,
      lineaVisible(operacion, cantidadLineasGrupo),
      productoVisible(operacion),
      estadoVisible(operacion),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return texto.includes(q)
  })

  /*
   * Orden automático de la vista:
   * - 1.ª columna visible = criterio principal.
   * - 2.ª columna visible = criterio secundario.
   * - Fechas y números: descendente.
   * - Textos: ascendente.
   * - Vacíos siempre al final.
   * - Como desempate final conservamos Fecha Ingreso descendente.
   */
  const camposFecha = new Set([
    'fecha_ingreso',
    'fecha_carga_stl',
    'fecha_porta',
    'fecha_instalacion',
  ])
  const camposNumero = new Set(['numero_linea'])
  const criteriosOrden = columnasVista.slice(0, 2).map((columna: any) => columna.campo)

  const compararCampo = (a: any, b: any, campo: string) => {
    const valorA = valorColumna(a, campo)
    const valorB = valorColumna(b, campo)

    const vacioA = valorA === null || valorA === undefined || String(valorA).trim() === '' || valorA === '-'
    const vacioB = valorB === null || valorB === undefined || String(valorB).trim() === '' || valorB === '-'

    if (vacioA && vacioB) return 0
    if (vacioA) return 1
    if (vacioB) return -1

    if (camposFecha.has(campo)) {
      const tiempoA = new Date(String(valorA)).getTime()
      const tiempoB = new Date(String(valorB)).getTime()
      if (!Number.isNaN(tiempoA) && !Number.isNaN(tiempoB)) return tiempoB - tiempoA
    }

    if (camposNumero.has(campo)) {
      const numeroA = Number(valorA)
      const numeroB = Number(valorB)
      if (Number.isFinite(numeroA) && Number.isFinite(numeroB)) return numeroB - numeroA
    }

    return String(valorA).localeCompare(String(valorB), 'es', {
      sensitivity: 'base',
      numeric: true,
    })
  }

  const ventas = [...ventasFiltradas].sort((a: any, b: any) => {
    for (const campo of criteriosOrden) {
      const resultado = compararCampo(a, b, campo)
      if (resultado !== 0) return resultado
    }

    const fechaA = new Date(a.fecha_hora || 0).getTime()
    const fechaB = new Date(b.fecha_hora || 0).getTime()
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

        <ExportarVentas puedeExportar={profile.rol === 'BBOO' || profile.rol === 'SUPERVISOR' || profile.rol === 'ADMIN'} />

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
              Responsable
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
            iniciales={filtrosAvanzados}
          />

          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-6">
            <button
              type="submit"
              className="rounded-lg bg-red-600 px-5 py-2 font-semibold text-white hover:bg-red-700"
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
          {ventas.length} {ventas.length === 1 ? 'venta' : 'ventas'}
        </div>

        <div className="hidden overflow-x-auto rounded-2xl border border-gray-200 bg-white md:block">
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
              {ventas.map((operacion: any) => (
                <tr
                  key={operacion.id_operacion}
                  className="align-top hover:bg-gray-50"
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
                    <a
                      href={`/gestion-ventas/${encodeURIComponent(
                        operacion.id_operacion
                      )}`}
                      className="whitespace-nowrap font-semibold text-red-600 hover:text-red-700"
                    >
                      Gestionar
                    </a>
                  </td>
                </tr>
              ))}

              {ventas.length === 0 && (
                <tr>
                  <td
                    colSpan={columnasVista.length + 1}
                    className="px-4 py-10 text-center text-gray-500"
                  >
                    No se encontraron ventas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 md:hidden">
          {ventas.map((operacion: any) => (
            <div
              key={operacion.id_operacion}
              className="rounded-2xl border border-gray-200 bg-white p-4"
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
                <a
                  href={`/gestion-ventas/${encodeURIComponent(
                    operacion.id_operacion
                  )}`}
                  className="text-sm font-semibold text-red-600 hover:text-red-700"
                >
                  Gestionar
                </a>
              </div>
            </div>
          ))}

          {ventas.length === 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500">
              No se encontraron ventas.
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
