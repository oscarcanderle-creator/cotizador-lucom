import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import AppHeader from '../../components/AppHeader'
import ExportarMisVentas from '../../components/ExportarMisVentas'

type SearchParams = Promise<{
  q?: string
  tipo?: string
}>

type ProductoNuevo = {
  id: number
  operacion_id: string
  tipo_producto: string
  plan_snapshot: string | null
  producto_snapshot: string | null
  orden: number
  activo: boolean
}

type EstadoProducto = {
  producto_operacion_id: number
  estado: string
  habilitado?: boolean
  motivo?: string
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

function nombreCliente(cliente: any) {
  if (!cliente) return '-'

  const apellido = String(cliente.apellido ?? '').trim()
  const nombre = String(cliente.nombre ?? '').trim()

  return [apellido, nombre].filter(Boolean).join(', ') || '-'
}

function tipoLegacyVisible(operacion: any) {
  if (
    operacion.tipo === 'PORTA' &&
    operacion.operaciones_porta?.es_linea_nueva
  ) {
    return 'LN'
  }

  return operacion.tipo
}

function productoLegacyVisible(operacion: any) {
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

function estadoLegacyVisible(operacion: any) {
  if (operacion.tipo === 'BAF') {
    return operacion.gestion_baf?.estados_baf?.nombre || 'Sin gestión'
  }

  if (operacion.tipo === 'PORTA') {
    return operacion.gestion_porta?.estados_porta?.nombre || 'Sin gestión'
  }

  return 'Sin gestión'
}

function etiquetaTipoProducto(tipo: string) {
  if (tipo === 'BAF') return 'Internet / BAF'
  if (tipo === 'PORTA') return 'Portabilidad'
  if (tipo === 'LINEA_NUEVA') return 'Línea Nueva'
  if (tipo === 'FWA') return 'FWA'
  if (tipo === 'TV') return 'TV'
  return tipo
}

function resumenProducto(producto: ProductoNuevo) {
  const tipo = etiquetaTipoProducto(producto.tipo_producto)
  const plan = String(producto.plan_snapshot ?? '').trim()
  return plan ? `${tipo} · ${plan}` : tipo
}

function coincideFiltroTipo(
  filtroTipo: string,
  productos: ProductoNuevo[],
  operacion: any
) {
  if (!filtroTipo) return true

  if (productos.length > 0) {
    const tipoBuscado = filtroTipo === 'LN' ? 'LINEA_NUEVA' : filtroTipo
    return productos.some((p) => p.tipo_producto === tipoBuscado)
  }

  return tipoLegacyVisible(operacion) === filtroTipo
}

export default async function MisVentasPage({
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

  const params = await searchParams
  const q = String(params?.q ?? '').trim().toLowerCase()
  const filtroTipo = String(params?.tipo ?? '').trim().toUpperCase()

  // Cabeceras. Se conservan las relaciones legacy para que Mis Ventas
  // continúe mostrando correctamente las ventas anteriores a la migración.
  const { data: operaciones, error } = await supabase
    .from('operaciones')
    .select(`
      id_operacion,
      tipo,
      fecha_hora,
      vendedor,
      origen_dato,
      grupo_operacion,
      cliente:clientes (
        dni,
        tipo_documento,
        nombre,
        apellido,
        telefono
      ),
      operaciones_baf (
        plan,
        modalidad_plan
      ),
      operaciones_porta (
        nim,
        es_linea_nueva,
        gigas_acordados,
        compania_actual
      ),
      gestion_baf (
        estado_baf_id,
        estados_baf (
          nombre
        )
      ),
      gestion_porta (
        estado_porta_id,
        estados_porta (
          nombre
        )
      )
    `)
    .eq('usuario_id', user.id)
    .in('tipo', ['BAF', 'PORTA'])
    .order('fecha_hora', { ascending: false })

  if (error) {
    throw new Error(`No se pudieron cargar las ventas: ${error.message}`)
  }

  const idsOperaciones = (operaciones ?? []).map((o: any) => o.id_operacion)

  let productosNuevos: ProductoNuevo[] = []
  const estadosPorProducto = new Map<number, EstadoProducto>()
  const contextosPorOperacion = new Map<string, any>()

  if (idsOperaciones.length > 0) {
    const { data: productos, error: errorProductos } = await supabase
      .from('operacion_productos')
      .select(`
        id,
        operacion_id,
        tipo_producto,
        plan_snapshot,
        producto_snapshot,
        orden,
        activo
      `)
      .in('operacion_id', idsOperaciones)
      .eq('activo', true)
      .order('orden', { ascending: true })

    if (errorProductos) {
      throw new Error(
        `No se pudieron cargar los productos de las ventas: ${errorProductos.message}`
      )
    }

    productosNuevos = (productos ?? []) as ProductoNuevo[]

    const idsProductos = productosNuevos.map((p) => p.id)

    if (idsProductos.length > 0) {
      const [bafResult, movilResult] = await Promise.all([
        supabase
          .from('gestion_producto_baf')
          .select(`
            producto_operacion_id,
            estado_baf_id,
            estados_baf (
              nombre
            )
          `)
          .in('producto_operacion_id', idsProductos),
        supabase
          .from('gestion_producto_movil')
          .select(`
            producto_operacion_id,
            estado_porta_id,
            estados_porta (
              nombre
            )
          `)
          .in('producto_operacion_id', idsProductos),
      ])

      if (bafResult.error) {
        throw new Error(
          `No se pudo cargar la gestión BAF multiproducto: ${bafResult.error.message}`
        )
      }

      if (movilResult.error) {
        throw new Error(
          `No se pudo cargar la gestión móvil multiproducto: ${movilResult.error.message}`
        )
      }

      for (const gestion of bafResult.data ?? []) {
        estadosPorProducto.set(Number(gestion.producto_operacion_id), {
          producto_operacion_id: Number(gestion.producto_operacion_id),
          estado: (gestion as any).estados_baf?.nombre || 'Sin gestión',
        })
      }

      for (const gestion of movilResult.data ?? []) {
        estadosPorProducto.set(Number(gestion.producto_operacion_id), {
          producto_operacion_id: Number(gestion.producto_operacion_id),
          estado: (gestion as any).estados_porta?.nombre || 'Sin gestión',
        })
      }

      // La habilitación móvil se evalúa con la misma función validada en
      // Migración 3A. Si una evaluación puntual falla, la venta sigue visible.
      const productosMoviles = productosNuevos.filter(
        (p) => p.tipo_producto === 'PORTA' || p.tipo_producto === 'LINEA_NUEVA'
      )

      await Promise.all(
        productosMoviles.map(async (producto) => {
          const { data } = await supabase.rpc(
            'evaluar_habilitacion_producto_movil',
            { p_producto_operacion_id: producto.id }
          )

          const evaluacion = Array.isArray(data) ? data[0] : data
          if (!evaluacion) return

          const actual = estadosPorProducto.get(producto.id) ?? {
            producto_operacion_id: producto.id,
            estado: 'Sin gestión',
          }

          estadosPorProducto.set(producto.id, {
            ...actual,
            habilitado: evaluacion.habilitado === true,
            motivo: evaluacion.motivo ?? undefined,
          })
        })
      )
    }

    const { data: contextos, error: errorContextos } = await supabase
      .from('operacion_contexto_comercial')
      .select(`
        operacion_id,
        es_conexion_full,
        modalidad_conexion_full,
        tipo_referencia_habilitante,
        referencia_habilitante,
        cantidad_servicios,
        descuento_convergencia
      `)
      .in('operacion_id', idsOperaciones)

    if (errorContextos) {
      throw new Error(
        `No se pudo cargar el contexto comercial: ${errorContextos.message}`
      )
    }

    for (const contexto of contextos ?? []) {
      contextosPorOperacion.set(contexto.operacion_id, contexto)
    }
  }

  const productosPorOperacion = new Map<string, ProductoNuevo[]>()

  for (const producto of productosNuevos) {
    const actuales = productosPorOperacion.get(producto.operacion_id) ?? []
    actuales.push(producto)
    productosPorOperacion.set(producto.operacion_id, actuales)
  }

  const ventas = (operaciones ?? []).filter((operacion: any) => {
    const productos = productosPorOperacion.get(operacion.id_operacion) ?? []

    if (!coincideFiltroTipo(filtroTipo, productos, operacion)) {
      return false
    }

    if (!q) return true

    const cliente = operacion.cliente
    const portaLegacy = operacion.operaciones_porta
    const contexto = contextosPorOperacion.get(operacion.id_operacion)

    const textoBusqueda = [
      operacion.id_operacion,
      operacion.vendedor,
      operacion.origen_dato,
      cliente?.dni,
      cliente?.nombre,
      cliente?.apellido,
      cliente?.telefono,
      portaLegacy?.nim,
      productos.length
        ? productos.map((p) => resumenProducto(p)).join(' ')
        : productoLegacyVisible(operacion),
      contexto?.es_conexion_full ? 'conexion full combo convergente' : '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return textoBusqueda.includes(q)
  })

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader
        rol={profile.rol}
        usuario={profile.nombre?.trim() || user.email || 'Usuario'}
        actual="MIS_VENTAS"
        puedeGestionarVentas={profile.puede_gestionar_ventas === true}
      />

      <div className="mx-auto max-w-7xl p-4 sm:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mis Ventas</h1>
          <p className="mt-1 text-sm text-gray-500">
            Una venta puede contener uno o varios servicios.
          </p>
        </div>

        <form
          method="get"
          className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:grid-cols-[1fr_180px_auto]"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Buscar
            </label>
            <input
              type="text"
              name="q"
              defaultValue={params?.q ?? ''}
              placeholder="Cliente, DNI, teléfono, operación o producto"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Servicio
            </label>
            <select
              name="tipo"
              defaultValue={filtroTipo}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
            >
              <option value="">Todos</option>
              <option value="BAF">Internet / BAF</option>
              <option value="PORTA">Portabilidad</option>
              <option value="LN">Línea Nueva</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-lg bg-red-600 px-5 py-2 font-semibold text-white hover:bg-red-700"
            >
              Filtrar
            </button>

            <a
              href="/mis-ventas"
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Limpiar
            </a>
          </div>
        </form>

        <ExportarMisVentas />

        <div className="mb-3 text-sm text-gray-500">
          {ventas.length} {ventas.length === 1 ? 'venta' : 'ventas'}
        </div>

        {/* DESKTOP */}
        <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">DNI / CUIT</th>
                  <th className="px-4 py-3">Servicios</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {ventas.map((operacion: any) => {
                  const productos =
                    productosPorOperacion.get(operacion.id_operacion) ?? []
                  const contexto = contextosPorOperacion.get(
                    operacion.id_operacion
                  )
                  const esNuevaArquitectura = productos.length > 0

                  return (
                    <tr
                      key={operacion.id_operacion}
                      className="align-top hover:bg-gray-50"
                    >
                      <td className="whitespace-nowrap px-4 py-4 text-gray-600">
                        {fechaArgentina(operacion.fecha_hora)}
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-medium text-gray-900">
                          {nombreCliente(operacion.cliente)}
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-gray-400">
                          {operacion.id_operacion}
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-gray-600">
                        {operacion.cliente?.tipo_documento
                          ? `${operacion.cliente.tipo_documento} `
                          : ''}
                        {operacion.cliente?.dni || '-'}
                      </td>

                      <td className="min-w-[300px] px-4 py-4">
                        {esNuevaArquitectura ? (
                          <div className="space-y-2">
                            {productos.map((producto) => (
                              <div
                                key={producto.id}
                                className="flex flex-wrap items-center gap-2"
                              >
                                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                                  {etiquetaTipoProducto(producto.tipo_producto)}
                                </span>
                                <span className="text-sm text-gray-700">
                                  {producto.plan_snapshot || '-'}
                                </span>
                              </div>
                            ))}

                            {contexto?.es_conexion_full && (
                              <div className="pt-1 text-xs font-semibold text-green-700">
                                Conexión Full ·{' '}
                                {contexto.modalidad_conexion_full === 'BAF_NUEVO'
                                  ? 'BAF nuevo'
                                  : 'BAF existente'}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                              {tipoLegacyVisible(operacion)}
                            </span>
                            <span className="text-gray-600">
                              {productoLegacyVisible(operacion)}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="min-w-[210px] px-4 py-4">
                        {esNuevaArquitectura ? (
                          <div className="space-y-2">
                            {productos.map((producto) => {
                              const estado = estadosPorProducto.get(producto.id)
                              const esMovil =
                                producto.tipo_producto === 'PORTA' ||
                                producto.tipo_producto === 'LINEA_NUEVA'
                              const bloqueado =
                                esMovil && estado?.habilitado === false

                              return (
                                <div key={producto.id} className="text-xs">
                                  <div className="font-medium text-gray-700">
                                    {etiquetaTipoProducto(producto.tipo_producto)}:{' '}
                                    {bloqueado
                                      ? 'Pendiente de habilitación'
                                      : estado?.estado || 'Sin gestión'}
                                  </div>
                                  {bloqueado &&
                                    estado?.motivo ===
                                      'BAF_NUEVO_PENDIENTE_OT' && (
                                      <div className="mt-0.5 text-amber-700">
                                        Falta OT del BAF
                                      </div>
                                    )}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
                            {estadoLegacyVisible(operacion)}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4 text-right">
                        <div className="flex flex-col items-end gap-2">
                          <a
                            href={`/cotizador?venta=${encodeURIComponent(operacion.id_operacion)}`}
                            className="rounded-xl border border-red-600 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                          >
                            Sincronizar datos a Cotizador
                          </a>
                          <a
                            href={`/mis-ventas/${encodeURIComponent(operacion.id_operacion)}`}
                            className="rounded-xl border border-red-600 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                          >
                            Ver detalle
                          </a>
                        </div>
                      </td>
                    </tr>
                  )
                })}

                {ventas.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-gray-500"
                    >
                      No se encontraron ventas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MOBILE */}
        <div className="space-y-3 md:hidden">
          {ventas.map((operacion: any) => {
            const productos =
              productosPorOperacion.get(operacion.id_operacion) ?? []
            const contexto = contextosPorOperacion.get(operacion.id_operacion)
            const esNuevaArquitectura = productos.length > 0

            return (
              <div
                key={operacion.id_operacion}
                className="rounded-2xl border border-gray-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-gray-900">
                      {nombreCliente(operacion.cliente)}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {fechaArgentina(operacion.fecha_hora)}
                    </div>
                  </div>

                  {contexto?.es_conexion_full ? (
                    <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                      Conexión Full
                    </span>
                  ) : !esNuevaArquitectura ? (
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                      {tipoLegacyVisible(operacion)}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 text-xs text-gray-400">
                  {operacion.cliente?.tipo_documento || 'Documento'} ·{' '}
                  {operacion.cliente?.dni || '-'}
                </div>

                <div className="mt-4 space-y-2">
                  {esNuevaArquitectura ? (
                    productos.map((producto) => {
                      const estado = estadosPorProducto.get(producto.id)
                      const esMovil =
                        producto.tipo_producto === 'PORTA' ||
                        producto.tipo_producto === 'LINEA_NUEVA'
                      const bloqueado = esMovil && estado?.habilitado === false

                      return (
                        <div
                          key={producto.id}
                          className="rounded-xl border border-gray-100 bg-gray-50 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold text-gray-800">
                              {etiquetaTipoProducto(producto.tipo_producto)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {producto.plan_snapshot || '-'}
                            </div>
                          </div>

                          <div
                            className={`mt-1 text-xs ${
                              bloqueado ? 'text-amber-700' : 'text-gray-500'
                            }`}
                          >
                            {bloqueado
                              ? estado?.motivo === 'BAF_NUEVO_PENDIENTE_OT'
                                ? 'Pendiente de habilitación · Falta OT del BAF'
                                : 'Pendiente de habilitación'
                              : estado?.estado || 'Sin gestión'}
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <div className="font-semibold text-gray-800">
                        {productoLegacyVisible(operacion)}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {estadoLegacyVisible(operacion)}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 border-t border-gray-100 pt-3">
                  <div className="mb-2 truncate font-mono text-[10px] text-gray-400">
                    {operacion.id_operacion}
                  </div>
                  <div className="flex flex-col items-stretch gap-2">
                    <a
                      href={`/cotizador?venta=${encodeURIComponent(operacion.id_operacion)}`}
                      className="rounded-xl border border-red-600 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                    >
                      Sincronizar datos a Cotizador
                    </a>
                    <a
                      href={`/mis-ventas/${encodeURIComponent(operacion.id_operacion)}`}
                      className="rounded-xl border border-red-600 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                    >
                      Ver detalle
                    </a>
                  </div>
                </div>
              </div>
            )
          })}

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
