import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import AppHeader from '../../components/AppHeader'

type SearchParams = Promise<{
  q?: string
  tipo?: string
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

function nombreCliente(cliente: any) {
  if (!cliente) return '-'

  const apellido = String(cliente.apellido ?? '').trim()
  const nombre = String(cliente.nombre ?? '').trim()

  return [apellido, nombre].filter(Boolean).join(', ') || '-'
}

function tipoVisible(operacion: any) {
  if (operacion.tipo === 'PORTA' && operacion.operaciones_porta?.es_linea_nueva) {
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
    return operacion.gestion_baf?.estados_baf?.nombre || 'Sin gestión'
  }

  if (operacion.tipo === 'PORTA') {
    return operacion.gestion_porta?.estados_porta?.nombre || 'Sin gestión'
  }

  return 'Sin gestión'
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
    .select('nombre, rol, activo')
    .eq('id', user.id)
    .single()

  if (!profile?.activo) redirect('/login')

  const params = await searchParams
  const q = String(params?.q ?? '').trim().toLowerCase()
  const filtroTipo = String(params?.tipo ?? '').trim().toUpperCase()

  const { data: operaciones, error } = await supabase
    .from('operaciones')
    .select(`
      id_operacion,
      tipo,
      fecha_hora,
      vendedor,
      origen_dato,
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

  const ventas = (operaciones ?? []).filter((operacion: any) => {
    const tipo = tipoVisible(operacion)

    if (filtroTipo && filtroTipo !== tipo) {
      return false
    }

    if (!q) return true

    const cliente = operacion.cliente
    const porta = operacion.operaciones_porta

    const texto = [
      operacion.id_operacion,
      operacion.vendedor,
      operacion.origen_dato,
      cliente?.dni,
      cliente?.nombre,
      cliente?.apellido,
      cliente?.telefono,
      porta?.nim,
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
        usuario={profile.nombre?.trim() || user.email || 'Usuario'}
        actual="MIS_VENTAS"
      />
      <div className="mx-auto max-w-7xl p-4 sm:p-8">


        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Mis Ventas
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Operaciones registradas por {profile.nombre || user.email}.
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
              placeholder="Cliente, DNI, teléfono o NIM"
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
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">DNI / CUIT</th>
                  <th className="px-4 py-3">Producto / Plan</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {ventas.map((operacion: any) => (
                  <tr
                    key={operacion.id_operacion}
                    className="hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {fechaArgentina(operacion.fecha_hora)}
                    </td>

                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                        {tipoVisible(operacion)}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-medium text-gray-900">
                      {nombreCliente(operacion.cliente)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {operacion.cliente?.tipo_documento
                        ? `${operacion.cliente.tipo_documento} `
                        : ''}
                      {operacion.cliente?.dni || '-'}
                    </td>

                    <td className="px-4 py-3 text-gray-600">
                      {productoVisible(operacion)}
                    </td>

                    <td className="px-4 py-3">
                      <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
                        {estadoVisible(operacion)}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <a
                        href={`/mis-ventas/${encodeURIComponent(operacion.id_operacion)}`}
                        className="font-medium text-red-600 hover:text-red-700"
                      >
                        Ver detalle
                      </a>
                    </td>
                  </tr>
                ))}

                {ventas.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
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
          {ventas.map((operacion: any) => (
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

                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                  {tipoVisible(operacion)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-gray-400">
                    DNI / CUIT
                  </div>
                  <div className="mt-1 text-gray-700">
                    {operacion.cliente?.dni || '-'}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-400">
                    Estado
                  </div>
                  <div className="mt-1 text-gray-700">
                    {estadoVisible(operacion)}
                  </div>
                </div>

                <div className="col-span-2">
                  <div className="text-xs text-gray-400">
                    Producto / Plan
                  </div>
                  <div className="mt-1 text-gray-700">
                    {productoVisible(operacion)}
                  </div>
                </div>
              </div>

              <div className="mt-4 border-t border-gray-100 pt-3 text-right">
                <a
                  href={`/mis-ventas/${encodeURIComponent(operacion.id_operacion)}`}
                  className="text-sm font-semibold text-red-600 hover:text-red-700"
                >
                  Ver detalle
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
