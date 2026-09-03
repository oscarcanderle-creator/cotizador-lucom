import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import AppHeader from '../../components/AppHeader'

type SearchParams = Promise<{
  q?: string
  tipo?: string
  vendedor?: string
  responsable?: string
  estado?: string
}>

function fechaArgentina(fecha: string | null) {
  if (!fecha) return '-'
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(fecha))
}

function nombreCliente(cliente: any) {
  if (!cliente) return '-'
  const apellido = String(cliente.apellido ?? '').trim()
  const nombre = String(cliente.nombre ?? '').trim()
  return [apellido, nombre].filter(Boolean).join(', ') || '-'
}

function tipoVisible(operacion: any) {
  if (operacion.tipo === 'PORTA' && operacion.operaciones_porta?.es_linea_nueva) return 'LN'
  return operacion.tipo
}

function productoVisible(operacion: any) {
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
  if (operacion.tipo === 'BAF') return operacion.gestion_baf?.estados_baf?.nombre || 'Sin gestión'
  if (operacion.tipo === 'PORTA') return operacion.gestion_porta?.estados_porta?.nombre || 'Sin gestión'
  return 'Sin gestión'
}

export default async function GestionVentasPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, rol, activo, puede_gestionar_ventas')
    .eq('id', user.id)
    .single()

  if (!profile?.activo) redirect('/login')

  const esVendedorGestor = profile.rol === 'VENDEDOR' && profile.puede_gestionar_ventas === true
  if (!esVendedorGestor) redirect('/ventas')

  const params = await searchParams
  const q = String(params?.q ?? '').trim().toLowerCase()
  const filtroTipo = String(params?.tipo ?? '').trim().toUpperCase()
  const filtroVendedor = String(params?.vendedor ?? '').trim()
  const filtroResponsable = String(params?.responsable ?? '').trim()
  const filtroEstado = String(params?.estado ?? '').trim()

  const { data: operaciones, error } = await supabase
    .from('operaciones')
    .select(`
      id_operacion,
      tipo,
      fecha_hora,
      vendedor,
      origen_dato,
      cliente:clientes (dni, tipo_documento, nombre, apellido, telefono),
      operaciones_baf (plan, modalidad_plan),
      operaciones_porta (nim, es_linea_nueva, gigas_acordados, compania_actual),
      gestion_baf (responsable_id, fecha_gestion, updated_at, estado_baf_id, estados_baf (nombre)),
      gestion_porta (responsable_id, updated_at, estado_porta_id, estados_porta (nombre))
    `)
    .in('tipo', ['BAF', 'PORTA'])
    .order('fecha_hora', { ascending: false })

  if (error) throw new Error(`No se pudieron cargar las ventas: ${error.message}`)

  const { data: perfiles, error: perfilesError } = await supabase
    .from('profiles')
    .select('id, nombre, vendedor')
    .order('nombre', { ascending: true })

  if (perfilesError) throw new Error(`No se pudieron cargar los usuarios: ${perfilesError.message}`)

  const nombreResponsable = (operacion: any) => {
    const responsableId = operacion.tipo === 'BAF'
      ? operacion.gestion_baf?.responsable_id
      : operacion.gestion_porta?.responsable_id
    if (!responsableId) return 'Sin responsable'
    const perfil = (perfiles ?? []).find((item: any) => item.id === responsableId)
    return perfil?.vendedor || perfil?.nombre || 'Usuario no disponible'
  }

  const fechaUltimaGestion = (operacion: any) => {
    if (operacion.tipo === 'BAF') return operacion.gestion_baf?.updated_at || operacion.gestion_baf?.fecha_gestion || null
    return operacion.gestion_porta?.updated_at || null
  }

  const vendedores = Array.from(new Set((operaciones ?? []).map((o: any) => String(o.vendedor ?? '').trim()).filter(Boolean))) as string[]
  const responsables = Array.from(new Set((operaciones ?? []).map((o: any) => nombreResponsable(o)))) as string[]
  const estados = Array.from(new Set((operaciones ?? []).map((o: any) => estadoVisible(o)))) as string[]
  vendedores.sort((a, b) => a.localeCompare(b, 'es'))
  responsables.sort((a, b) => a.localeCompare(b, 'es'))
  estados.sort((a, b) => a.localeCompare(b, 'es'))

  const ventas = (operaciones ?? []).filter((operacion: any) => {
    const tipo = tipoVisible(operacion)
    if (filtroTipo && filtroTipo !== tipo) return false
    if (filtroVendedor && operacion.vendedor !== filtroVendedor) return false
    if (filtroResponsable && nombreResponsable(operacion) !== filtroResponsable) return false
    if (filtroEstado && estadoVisible(operacion) !== filtroEstado) return false
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
      productoVisible(operacion),
      estadoVisible(operacion),
    ].filter(Boolean).join(' ').toLowerCase()

    return texto.includes(q)
  })

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader
        rol={profile.rol}
        usuario={profile.nombre?.trim() || user.email || 'Usuario'}
        actual="GESTION_VENTAS"
        puedeGestionarVentas={true}
      />

      <div className="mx-auto max-w-7xl p-4 sm:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Ventas</h1>
          <p className="mt-1 text-sm text-gray-500">Gestión operativa de BAF, Portabilidad y Línea Nueva.</p>
        </div>

        <form method="get" className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="md:col-span-2 xl:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-500">Buscar</label>
            <input type="text" name="q" defaultValue={params?.q ?? ''} placeholder="ID, cliente, DNI, teléfono, NIM, vendedor..." className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Tipo</label>
            <select name="tipo" defaultValue={filtroTipo} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900">
              <option value="">Todos</option><option value="BAF">BAF</option><option value="PORTA">PORTA</option><option value="LN">Línea Nueva</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Vendedor</label>
            <select name="vendedor" defaultValue={filtroVendedor} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900">
              <option value="">Todos</option>{vendedores.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Responsable</label>
            <select name="responsable" defaultValue={filtroResponsable} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900">
              <option value="">Todos</option>{responsables.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Estado</label>
            <select name="estado" defaultValue={filtroEstado} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900">
              <option value="">Todos</option>{estados.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-6">
            <button type="submit" className="rounded-lg bg-red-600 px-5 py-2 font-semibold text-white hover:bg-red-700">Filtrar</button>
            <a href="/gestion-ventas" className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50">Limpiar</a>
          </div>
        </form>

        <div className="mb-3 text-sm text-gray-500">{ventas.length} {ventas.length === 1 ? 'venta' : 'ventas'}</div>

        <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white md:block">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="w-[118px] px-3 py-3">Fecha</th>
                  <th className="w-[145px] px-3 py-3">Vendedor</th>
                  <th className="w-[72px] px-3 py-3">Tipo</th>
                  <th className="w-[145px] px-3 py-3">Estado</th>
                  <th className="w-[145px] px-3 py-3">Responsable</th>
                  <th className="w-[160px] px-3 py-3">Cliente</th>
                  <th className="w-[165px] px-3 py-3">Producto / Plan</th>
                  <th className="w-[118px] px-3 py-3">Últ. gestión</th>
                  <th className="sticky right-0 z-20 w-[92px] border-l border-gray-200 bg-gray-50 px-3 py-3 text-right shadow-[-6px_0_10px_-8px_rgba(0,0,0,0.35)]">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ventas.map((operacion: any) => (
                  <tr key={operacion.id_operacion} className="group hover:bg-gray-50">
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-600">{fechaArgentina(operacion.fecha_hora)}</td>
                    <td className="truncate px-3 py-3 font-bold text-gray-900" title={operacion.vendedor || '-'}>{operacion.vendedor || '-'}</td>
                    <td className="px-3 py-3"><span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">{tipoVisible(operacion)}</span></td>
                    <td className="px-3 py-3"><div className="truncate" title={estadoVisible(operacion)}><span className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700">{estadoVisible(operacion)}</span></div></td>
                    <td className="truncate px-3 py-3 text-gray-700" title={nombreResponsable(operacion)}>{nombreResponsable(operacion)}</td>
                    <td className="truncate px-3 py-3 text-gray-600" title={nombreCliente(operacion.cliente)}>{nombreCliente(operacion.cliente)}</td>
                    <td className="truncate px-3 py-3 text-gray-600" title={productoVisible(operacion)}>{productoVisible(operacion)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-600">{fechaArgentina(fechaUltimaGestion(operacion))}</td>
                    <td className="sticky right-0 z-10 whitespace-nowrap border-l border-gray-200 bg-white px-3 py-3 text-right shadow-[-6px_0_10px_-8px_rgba(0,0,0,0.35)] group-hover:bg-gray-50">
                      <a href={`/gestion-ventas/${encodeURIComponent(operacion.id_operacion)}`} className="font-semibold text-red-600 hover:text-red-700">Gestionar</a>
                    </td>
                  </tr>
                ))}
                {ventas.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-500">No se encontraron ventas.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3 md:hidden">
          {ventas.map((operacion: any) => (
            <div key={operacion.id_operacion} className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-400">Vendedor</div>
                  <div className="mt-1 text-base font-bold text-gray-900">{operacion.vendedor || '-'}</div>
                  <div className="mt-1 text-xs text-gray-500">{fechaArgentina(operacion.fecha_hora)}</div>
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">{tipoVisible(operacion)}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-xs text-gray-400">Estado</div><div className="mt-1 text-gray-700">{estadoVisible(operacion)}</div></div>
                <div><div className="text-xs text-gray-400">Responsable</div><div className="mt-1 text-gray-700">{nombreResponsable(operacion)}</div></div>
                <div className="col-span-2"><div className="text-xs text-gray-400">Cliente</div><div className="mt-1 text-gray-700">{nombreCliente(operacion.cliente)}</div></div>
                <div className="col-span-2"><div className="text-xs text-gray-400">Producto / Plan</div><div className="mt-1 text-gray-700">{productoVisible(operacion)}</div></div>
                <div className="col-span-2"><div className="text-xs text-gray-400">Última gestión</div><div className="mt-1 text-gray-700">{fechaArgentina(fechaUltimaGestion(operacion))}</div></div>
              </div>
              <div className="mt-4 border-t border-gray-100 pt-3 text-right">
                <a href={`/gestion-ventas/${encodeURIComponent(operacion.id_operacion)}`} className="text-sm font-semibold text-red-600 hover:text-red-700">Gestionar</a>
              </div>
            </div>
          ))}
          {ventas.length === 0 && <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500">No se encontraron ventas.</div>}
        </div>
      </div>
    </main>
  )
}
