import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import { createAdminClient } from '../../utils/supabase/admin'
import AppHeader from '../../components/AppHeader'
import FiltrosAvanzadosVentas from '../../components/FiltrosAvanzadosVentas'

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

  if (!esVendedorGestor) redirect('/ventas')

  /*
   * Desde este punto usamos el cliente ADMIN, pero solamente después
   * de autenticar y validar que el usuario es un VENDEDOR GESTOR activo.
   *
   * Esto evita que RLS o las relaciones embebidas oculten Cliente,
   * datos PORTA/LN y demás información necesaria en el listado.
   */
  const admin = createAdminClient()

  const params = await searchParams
  const q = String(params?.q ?? '').trim().toLowerCase()
  const filtroTipo = String(params?.tipo ?? '').trim().toUpperCase()
  const filtroVendedor = String(params?.vendedor ?? '').trim()
  const filtroResponsable = String(params?.responsable ?? '').trim()
  const filtroEstado = String(params?.estado ?? '').trim()

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
          .select('operacion_id, responsable_id, fecha_gestion, updated_at, estado_baf_id')
          .in('operacion_id', idsOperaciones)
      : Promise.resolve({ data: [], error: null }),

    idsOperaciones.length > 0
      ? admin
          .from('gestion_porta')
          .select('operacion_id, responsable_id, updated_at, estado_porta_id, medio_despacho_chip_id, fecha_carga_stl, fecha_porta, pin_lnva_nro, sim')
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

  const [estadosBafResultado, estadosPortaResultado] = await Promise.all([
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

  const ventas = operacionesCompletas.filter((operacion: any) => {
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

        <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white md:block">
          <table className="w-full table-fixed text-left text-[13px]">
            <colgroup>
              <col style={{ width: '8%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '7%' }} />
            </colgroup>

            <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
              <tr>
                <th className="px-2 py-3">Fecha</th>
                <th className="px-2 py-3">Vendedor</th>
                <th className="px-2 py-3">Tipo</th>
                <th className="px-2 py-3">Estado</th>
                <th className="px-2 py-3">Responsable</th>
                <th className="px-2 py-3">Cliente</th>
                <th className="px-2 py-3">Línea</th>
                <th className="px-2 py-3">Producto / Plan</th>
                <th className="px-2 py-3">Últ. gestión</th>
                <th className="px-2 py-3 text-right">Acción</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {ventas.map((operacion: any) => {
                const vendedor = operacion.vendedor || '-'
                const responsable = nombreResponsable(operacion)
                const cliente = nombreCliente(operacion.cliente)
                const linea = lineaVisible(operacion, cantidadLineasGrupo)
                const producto = productoVisible(operacion)
                const estado = estadoVisible(operacion)

                return (
                  <tr
                    key={operacion.id_operacion}
                    className="align-top hover:bg-gray-50"
                  >
                    <td className="px-2 py-3 text-gray-600">
                      <FechaDosLineas fecha={operacion.fecha_hora} />
                    </td>

                    <td className="px-2 py-3 font-semibold text-gray-900">
                      <div
                        className="max-h-10 overflow-hidden break-words leading-5"
                        title={vendedor}
                      >
                        {vendedor}
                      </div>
                    </td>

                    <td className="px-2 py-3">
                      <span className="inline-block max-w-full rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-700">
                        {tipoVisible(operacion)}
                      </span>
                    </td>

                    <td className="px-2 py-3">
                      <span
                        className="inline-block max-h-10 max-w-full overflow-hidden rounded-lg border border-gray-200 bg-white px-2 py-0.5 text-[11px] leading-4 text-gray-700"
                        title={estado}
                      >
                        {estado}
                      </span>
                    </td>

                    <td className="px-2 py-3 text-gray-700">
                      <div
                        className="max-h-10 overflow-hidden break-words leading-5"
                        title={responsable}
                      >
                        {responsable}
                      </div>
                    </td>

                    <td className="px-2 py-3 text-gray-600">
                      <div
                        className="max-h-10 overflow-hidden break-words leading-5"
                        title={cliente}
                      >
                        {cliente}
                      </div>
                    </td>

                    <td className="px-2 py-3 text-gray-600">
                      <div
                        className="max-h-10 overflow-hidden break-words leading-5"
                        title={linea}
                      >
                        {linea}
                      </div>
                    </td>

                    <td className="px-2 py-3 text-gray-600">
                      <div
                        className="max-h-10 overflow-hidden break-words leading-5"
                        title={producto}
                      >
                        {producto}
                      </div>
                    </td>

                    <td className="px-2 py-3 text-gray-600">
                      <FechaDosLineas fecha={fechaUltimaGestion(operacion)} />
                    </td>

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
                )
              })}

              {ventas.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
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
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Vendedor
                  </div>
                  <div className="mt-1 text-base font-bold text-gray-900">
                    {operacion.vendedor || '-'}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {fechaArgentina(operacion.fecha_hora)}
                  </div>
                </div>

                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                  {tipoVisible(operacion)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-gray-400">
                    Estado
                  </div>
                  <div className="mt-1 text-gray-700">
                    {estadoVisible(operacion)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-400">
                    Responsable
                  </div>
                  <div className="mt-1 text-gray-700">
                    {nombreResponsable(operacion)}
                  </div>
                </div>

                <div className="col-span-2">
                  <div className="text-xs text-gray-400">
                    Cliente
                  </div>
                  <div className="mt-1 text-gray-700">
                    {nombreCliente(operacion.cliente)}
                  </div>
                </div>

                {operacion.tipo === 'PORTA' && (
                  <div className="col-span-2">
                    <div className="text-xs text-gray-400">
                      Línea
                    </div>
                    <div className="mt-1 text-gray-700">
                      {lineaVisible(
                        operacion,
                        cantidadLineasGrupo
                      )}
                    </div>
                  </div>
                )}

                <div className="col-span-2">
                  <div className="text-xs text-gray-400">
                    Producto / Plan
                  </div>
                  <div className="mt-1 text-gray-700">
                    {productoVisible(operacion)}
                  </div>
                </div>

                <div className="col-span-2">
                  <div className="text-xs text-gray-400">
                    Última gestión
                  </div>
                  <div className="mt-1 text-gray-700">
                    {fechaArgentina(
                      fechaUltimaGestion(operacion)
                    )}
                  </div>
                </div>
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
