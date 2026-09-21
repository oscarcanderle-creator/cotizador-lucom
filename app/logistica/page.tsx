import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '../../utils/supabase/server'
import { createAdminClient } from '../../utils/supabase/admin'
import AppHeader from '../../components/AppHeader'

const ROLES_LOGISTICA = ['ADMIN', 'SUPERVISOR', 'BBOO']

async function crearGestionEntrega(formData: FormData) {
  'use server'

  const operacionId = String(
    formData.get('operacion_id') ?? ''
  ).trim()

  if (!operacionId) {
    throw new Error('Operación inválida.')
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, activo')
    .eq('id', user.id)
    .single()

  if (
    !profile ||
    !profile.activo ||
    !ROLES_LOGISTICA.includes(profile.rol)
  ) {
    redirect('/ventas')
  }

  const { error } = await supabase.rpc(
    'crear_gestion_entrega',
    {
      p_operacion_id: operacionId,
    }
  )

  if (error) {
    throw new Error(
      `No se pudo crear la Gestión de Entrega: ${error.message}`
    )
  }

  revalidatePath('/logistica')
  redirect('/logistica?bandeja=EN_PREPARACION')
}

async function confirmarGestionEntregaLista(formData: FormData) {
  'use server'

  const gestionEntregaId = Number(
    formData.get('gestion_entrega_id') ?? 0
  )

  if (
    !Number.isInteger(gestionEntregaId) ||
    gestionEntregaId <= 0
  ) {
    throw new Error('Gestión de Entrega inválida.')
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, activo')
    .eq('id', user.id)
    .single()

  if (
    !profile ||
    !profile.activo ||
    !ROLES_LOGISTICA.includes(profile.rol)
  ) {
    redirect('/ventas')
  }

  const { error } = await supabase.rpc(
    'confirmar_gestion_entrega_lista',
    {
      p_gestion_entrega_id: gestionEntregaId,
    }
  )

  if (error) {
    throw new Error(
      `No se pudo confirmar la Gestión de Entrega: ${error.message}`
    )
  }

  revalidatePath('/logistica')
  redirect('/logistica?bandeja=LISTAS')
}

type SearchParams = Promise<{
  bandeja?: string
}>

function texto(valor: unknown) {
  const resultado = String(valor ?? '').trim()
  return resultado || '-'
}

function nombreCliente(cliente: any) {
  if (!cliente) return '-'

  const apellido = String(cliente.apellido ?? '').trim()
  const nombre = String(cliente.nombre ?? '').trim()

  return [apellido, nombre].filter(Boolean).join(', ') || '-'
}

function domicilioVisible(domicilio: any) {
  if (!domicilio) return '-'

  return [
    domicilio.calle_nro,
    [domicilio.piso, domicilio.dpto].filter(Boolean).join(' / '),
    domicilio.barrio,
    domicilio.localidad,
  ]
    .map((valor) => String(valor ?? '').trim())
    .filter(Boolean)
    .join(' · ') || '-'
}

function fechaArgentina(fecha: string | null | undefined) {
  if (!fecha) return '-'

  const valor = new Date(fecha)
  if (Number.isNaN(valor.getTime())) return '-'

  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(valor)
}

export default async function LogisticaPage({
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
    .select('nombre, rol, activo')
    .eq('id', user.id)
    .single()

  if (
    !profile ||
    !profile.activo ||
    !ROLES_LOGISTICA.includes(profile.rol)
  ) {
    redirect('/ventas')
  }

  const admin = createAdminClient()
  const params = await searchParams

  const bandejasValidas = [
    'PARA_PREPARAR',
    'EN_PREPARACION',
    'LISTAS',
    'DISTRIBUCION',
    'REINGRESOS',
    'HISTORIAL',
  ]

  const bandejaSolicitada = String(
    params?.bandeja ?? 'PARA_PREPARAR'
  ).toUpperCase()

  const bandejaActiva = bandejasValidas.includes(bandejaSolicitada)
    ? bandejaSolicitada
    : 'PARA_PREPARAR'

  const [
    operacionesResultado,
    productosResultado,
    gestionesMovilesResultado,
    estadosBbooResultado,
    mediosResultado,
    gestionesEntregaResultado,
    estadosEntregaResultado,
  ] = await Promise.all([
    admin
      .from('operaciones')
      .select(`
        id_operacion,
        fecha_hora,
        vendedor,
        cliente_id,
        domicilio_id,
        cliente:clientes (
          nombre,
          apellido,
          telefono
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
        )
      `)
      .order('fecha_hora', { ascending: false }),

    admin
      .from('operacion_productos')
      .select('id, operacion_id, tipo_producto, orden')
      .eq('activo', true)
      .in('tipo_producto', ['PORTA', 'LINEA_NUEVA'])
      .order('orden', { ascending: true }),

    admin
      .from('gestion_producto_movil')
      .select(`
        producto_operacion_id,
        fecha_carga_stl,
        sim,
        estado_bboo_id,
        medio_despacho_chip_id,
        numero_seguimiento
      `),

    admin
      .from('estados_bboo')
      .select('id, codigo, nombre'),

    admin
      .from('medios_despacho_chip')
      .select('id, nombre, activo'),

    admin
      .from('gestiones_entrega')
      .select(`
        id,
        codigo_gestion,
        operacion_id,
        estado_entrega_id,
        medio_despacho_chip_id,
        fecha_lista_entrega,
        fecha_primera_distribucion,
        fecha_reingreso,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false }),

    admin
      .from('estados_entrega')
      .select('id, codigo, nombre'),
  ])

  for (const [nombre, resultado] of [
    ['operaciones', operacionesResultado],
    ['productos móviles', productosResultado],
    ['gestión móvil', gestionesMovilesResultado],
    ['estados BBOO', estadosBbooResultado],
    ['medios de despacho', mediosResultado],
    ['gestiones de entrega', gestionesEntregaResultado],
    ['estados de entrega', estadosEntregaResultado],
  ] as const) {
    if (resultado.error) {
      throw new Error(
        `No se pudieron cargar ${nombre}: ${resultado.error.message}`
      )
    }
  }

  const operaciones = operacionesResultado.data ?? []
  const productos = productosResultado.data ?? []
  const gestionesMoviles = gestionesMovilesResultado.data ?? []
  const estadosBboo = estadosBbooResultado.data ?? []
  const medios = mediosResultado.data ?? []
  const gestionesEntrega = gestionesEntregaResultado.data ?? []
  const estadosEntrega = estadosEntregaResultado.data ?? []

  const operacionPorId = new Map(
    operaciones.map((operacion: any) => [
      String(operacion.id_operacion),
      operacion,
    ])
  )

  const gestionMovilPorProducto = new Map(
    gestionesMoviles.map((gestion: any) => [
      Number(gestion.producto_operacion_id),
      gestion,
    ])
  )

  const estadoBbooPorId = new Map(
    estadosBboo.map((estado: any) => [
      Number(estado.id),
      estado,
    ])
  )

  const medioPorId = new Map(
    medios.map((medio: any) => [
      Number(medio.id),
      medio,
    ])
  )

  const estadoEntregaPorId = new Map(
    estadosEntrega.map((estado: any) => [
      Number(estado.id),
      estado,
    ])
  )

  const operacionesConGE = new Set(
    gestionesEntrega.map((gestion: any) =>
      String(gestion.operacion_id)
    )
  )

  const productosPorOperacion = new Map<string, any[]>()

  for (const producto of productos) {
    const operacionId = String(producto.operacion_id)
    const lista = productosPorOperacion.get(operacionId) ?? []
    lista.push(producto)
    productosPorOperacion.set(operacionId, lista)
  }

  const paraPreparar: any[] = []

  for (const [operacionId, productosMoviles] of productosPorOperacion) {
    if (operacionesConGE.has(operacionId)) continue

    const productosVigentes = productosMoviles.filter((producto: any) => {
      const gestion = gestionMovilPorProducto.get(Number(producto.id))
      const estado = gestion?.estado_bboo_id
        ? estadoBbooPorId.get(Number(gestion.estado_bboo_id))
        : null

      return String(estado?.codigo ?? '').trim().toUpperCase() !== 'CANCELADO'
    })

    if (productosVigentes.length === 0) continue

    const preparaciones = productosVigentes.map((producto: any) => {
      const gestion = gestionMovilPorProducto.get(Number(producto.id))
      const medio = gestion?.medio_despacho_chip_id
        ? medioPorId.get(Number(gestion.medio_despacho_chip_id))
        : null

      return {
        producto,
        gestion,
        medio,
      }
    })

    const todosCargados = preparaciones.every(
      ({ gestion }) => Boolean(gestion?.fecha_carga_stl)
    )

    const todosConSim = preparaciones.every(
      ({ gestion }) => String(gestion?.sim ?? '').trim() !== ''
    )

    const todosConMedioValido = preparaciones.every(({ medio }) => {
      const nombre = String(medio?.nombre ?? '').trim().toUpperCase()

      return (
        medio?.activo === true &&
        ['CADETERIA', 'LUCOM TERRENO'].includes(nombre)
      )
    })

    const idsMedio = new Set(
      preparaciones
        .map(({ gestion }) =>
          gestion?.medio_despacho_chip_id != null
            ? Number(gestion.medio_despacho_chip_id)
            : null
        )
        .filter((id) => id != null)
    )

    const mismoMedio =
      idsMedio.size === 1 &&
      preparaciones.length === productosVigentes.length

    if (
      !todosCargados ||
      !todosConSim ||
      !todosConMedioValido ||
      !mismoMedio
    ) {
      continue
    }

    const operacion = operacionPorId.get(operacionId)
    if (!operacion) continue

    paraPreparar.push({
      operacion,
      productos: preparaciones,
      medio: preparaciones[0]?.medio ?? null,
    })
  }

  const gestionesCompletas = gestionesEntrega.map((gestion: any) => {
    const estado = estadoEntregaPorId.get(Number(gestion.estado_entrega_id))
    const medio = medioPorId.get(Number(gestion.medio_despacho_chip_id))
    const operacion = operacionPorId.get(String(gestion.operacion_id))

    return {
      ...gestion,
      estado,
      medio,
      operacion,
    }
  })

  const enPreparacion = gestionesCompletas.filter(
    (gestion: any) =>
      String(gestion.estado?.codigo ?? '').toUpperCase() ===
      'EN_PREPARACION'
  )

  const listas = gestionesCompletas.filter(
    (gestion: any) =>
      String(gestion.estado?.codigo ?? '').toUpperCase() ===
      'LISTA_PARA_ENTREGA'
  )

  const distribucion = gestionesCompletas.filter(
    (gestion: any) =>
      String(gestion.estado?.codigo ?? '').toUpperCase() ===
      'EN_DISTRIBUCION'
  )

  const reingresos = gestionesCompletas.filter((gestion: any) =>
    ['REINGRESO_PENDIENTE', 'REINGRESADO'].includes(
      String(gestion.estado?.codigo ?? '').toUpperCase()
    )
  )

  const historial = gestionesCompletas.filter((gestion: any) =>
    ['ENTREGADO', 'NO_ENTREGADO'].includes(
      String(gestion.estado?.codigo ?? '').toUpperCase()
    )
  )

  const bandejas = [
    {
      key: 'PARA_PREPARAR',
      label: 'Para preparar',
      cantidad: paraPreparar.length,
    },
    {
      key: 'EN_PREPARACION',
      label: 'En preparación',
      cantidad: enPreparacion.length,
    },
    {
      key: 'LISTAS',
      label: 'Listas para entrega',
      cantidad: listas.length,
    },
    {
      key: 'DISTRIBUCION',
      label: 'En distribución',
      cantidad: distribucion.length,
    },
    {
      key: 'REINGRESOS',
      label: 'Reingresos',
      cantidad: reingresos.length,
    },
    {
      key: 'HISTORIAL',
      label: 'Historial',
      cantidad: historial.length,
    },
  ]

  const registrosGE =
    bandejaActiva === 'EN_PREPARACION'
      ? enPreparacion
      : bandejaActiva === 'LISTAS'
        ? listas
        : bandejaActiva === 'DISTRIBUCION'
        ? distribucion
        : bandejaActiva === 'REINGRESOS'
          ? reingresos
          : historial

  const nombreUsuario =
    profile.nombre?.trim() ||
    user.email ||
    'Usuario'

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader
        rol={profile.rol}
        usuario={nombreUsuario}
        actual="LOGISTICA"
      />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Logística
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Preparación, despacho y seguimiento de entregas de chips.
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {bandejas.map((bandeja) => {
            const activa = bandeja.key === bandejaActiva

            return (
              <a
                key={bandeja.key}
                href={`/logistica?bandeja=${bandeja.key}`}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  activa
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {bandeja.label}
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                    activa
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {bandeja.cantidad}
                </span>
              </a>
            )
          })}
        </div>

        {bandejaActiva === 'PARA_PREPARAR' ? (
          <div className="space-y-4">
            {paraPreparar.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
                <div className="font-semibold text-gray-800">
                  No hay ventas listas para preparar.
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  Aparecerán aquí cuando todos los chips vigentes de la venta tengan Carga STL, SIM y un mismo medio de despacho válido.
                </div>
              </div>
            ) : (
              paraPreparar.map((registro: any) => {
                const operacion = registro.operacion
                const cliente = Array.isArray(operacion?.cliente)
                  ? operacion.cliente[0]
                  : operacion?.cliente
                const domicilio = Array.isArray(operacion?.domicilio)
                  ? operacion.domicilio[0]
                  : operacion?.domicilio

                return (
                  <section
                    key={operacion.id_operacion}
                    className="overflow-hidden rounded-2xl border border-gray-200 bg-white"
                  >
                    <div className="flex flex-col gap-3 border-b border-gray-200 p-5 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                            PARA PREPARAR
                          </span>
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                            {texto(registro.medio?.nombre)}
                          </span>
                        </div>

                        <h2 className="mt-3 text-lg font-semibold text-gray-900">
                          {nombreCliente(cliente)}
                        </h2>

                        <div className="mt-1 text-sm text-gray-500">
                          Operación {texto(operacion.id_operacion)}
                        </div>
                      </div>

                      <div className="flex flex-col items-start gap-3 sm:items-end">
                        <div className="text-sm text-gray-500">
                          {fechaArgentina(operacion.fecha_hora)}
                        </div>

                        <form action={crearGestionEntrega}>
                          <input
                            type="hidden"
                            name="operacion_id"
                            value={operacion.id_operacion}
                          />
                          <button
                            type="submit"
                            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                          >
                            Preparar entrega
                          </button>
                        </form>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Contacto
                        </div>
                        <div className="mt-1 text-sm font-medium text-gray-800">
                          {texto(cliente?.telefono)}
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Domicilio
                        </div>
                        <div className="mt-1 text-sm font-medium text-gray-800">
                          {domicilioVisible(domicilio)}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Vendedor
                        </div>
                        <div className="mt-1 text-sm text-gray-800">
                          {texto(operacion.vendedor)}
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Chips a preparar
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {registro.productos.map(({ producto, gestion }: any) => (
                            <span
                              key={producto.id}
                              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700"
                            >
                              <span className="font-semibold">
                                {producto.tipo_producto === 'LINEA_NUEVA'
                                  ? 'LÍNEA NUEVA'
                                  : 'PORTA'}
                              </span>
                              {' · SIM '}
                              {texto(gestion?.sim)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                )
              })
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {registrosGE.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
                <div className="font-semibold text-gray-800">
                  No hay gestiones en esta bandeja.
                </div>
              </div>
            ) : (
              registrosGE.map((gestion: any) => {
                const operacion = gestion.operacion
                const cliente = Array.isArray(operacion?.cliente)
                  ? operacion.cliente[0]
                  : operacion?.cliente
                const domicilio = Array.isArray(operacion?.domicilio)
                  ? operacion.domicilio[0]
                  : operacion?.domicilio

                return (
                  <section
                    key={gestion.id}
                    className="rounded-2xl border border-gray-200 bg-white p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white">
                            {texto(gestion.codigo_gestion)}
                          </span>
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                            {texto(gestion.estado?.nombre)}
                          </span>
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                            {texto(gestion.medio?.nombre)}
                          </span>
                        </div>

                        <h2 className="mt-3 text-lg font-semibold text-gray-900">
                          {nombreCliente(cliente)}
                        </h2>

                        <div className="mt-1 text-sm text-gray-500">
                          Operación {texto(gestion.operacion_id)}
                        </div>

                        <div className="mt-3 text-sm text-gray-700">
                          {domicilioVisible(domicilio)}
                        </div>
                      </div>

                      <div className="text-sm text-gray-500">
                        <div>
                          Creada: {fechaArgentina(gestion.created_at)}
                        </div>

                        {gestion.fecha_lista_entrega && (
                          <div className="mt-1">
                            Lista: {fechaArgentina(gestion.fecha_lista_entrega)}
                          </div>
                        )}

                        {gestion.fecha_primera_distribucion && (
                          <div className="mt-1">
                            Distribución: {fechaArgentina(gestion.fecha_primera_distribucion)}
                          </div>
                        )}

                        {gestion.fecha_reingreso && (
                          <div className="mt-1">
                            Reingreso: {fechaArgentina(gestion.fecha_reingreso)}
                          </div>
                        )}

                        {bandejaActiva === 'EN_PREPARACION' && (
                          <form
                            action={confirmarGestionEntregaLista}
                            className="mt-4"
                          >
                            <input
                              type="hidden"
                              name="gestion_entrega_id"
                              value={gestion.id}
                            />
                            <button
                              type="submit"
                              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                            >
                              Marcar lista para entrega
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  </section>
                )
              })
            )}
          </div>
        )}
      </div>
    </main>
  )
}
