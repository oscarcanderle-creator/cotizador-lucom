import { redirect } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'
import { createAdminClient } from '../../../utils/supabase/admin'
import AppHeader from '../../../components/AppHeader'

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
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(fecha))
}

export default async function SuperConsultasPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, rol, activo')
    .eq('id', user.id)
    .single()

  if (!profile?.activo) redirect('/login')
  if (!['ADMIN', 'SUPERVISOR'].includes(profile.rol)) redirect('/ventas')

  // SUPER y ADMIN ya fueron validados arriba. Para esta vista global de solo lectura
  // usamos el cliente administrativo del servidor y evitamos que RLS recorte el listado.
  const dataClient = createAdminClient()

  const params = await searchParams
  const q = String(params?.q ?? '').trim().toLowerCase()
  const filtroTipo = String(params?.tipo ?? '').trim()
  const filtroVendedor = String(params?.vendedor ?? '').trim()
  const filtroResponsable = String(params?.responsable ?? '').trim()
  const filtroEstado = String(params?.estado ?? '').trim()

  const [
    { data: consultas, error: consultasError },
    { data: tipos, error: tiposError },
    { data: estados, error: estadosError },
    { data: perfiles, error: perfilesError },
  ] = await Promise.all([
    dataClient
      .from('consultas')
      .select(`
        id, marca_temporal, tipo_consulta_id, vendedor_id, responsable_id,
        cliente, dni, telefono, domicilio, localidad, observaciones,
        estado_consulta_id, estado_deuda_id, estado_cobertura_id, fecha_estado
      `)
      .order('marca_temporal', { ascending: false }),
    dataClient
      .from('tipos_consulta')
      .select('id, codigo, nombre')
      .order('orden', { ascending: true })
      .order('nombre', { ascending: true }),
    dataClient
      .from('estados_consulta')
      .select('id, codigo, nombre, ambito, tipo_estado, activo')
      .order('orden', { ascending: true })
      .order('nombre', { ascending: true }),
    dataClient
      .from('profiles')
      .select('id, nombre, vendedor')
      .order('nombre', { ascending: true }),
  ])

  if (consultasError) throw new Error(`No se pudieron cargar las Consultas: ${consultasError.message}`)
  if (tiposError) throw new Error(`No se pudieron cargar los Tipos de Consulta: ${tiposError.message}`)
  if (estadosError) throw new Error(`No se pudieron cargar los Estados de Consulta: ${estadosError.message}`)
  if (perfilesError) throw new Error(`No se pudieron cargar los usuarios: ${perfilesError.message}`)

  const tipoMap = new Map((tipos ?? []).map((x: any) => [String(x.id), x]))
  const estadoMap = new Map((estados ?? []).map((x: any) => [String(x.id), x]))
  const perfilMap = new Map((perfiles ?? []).map((x: any) => [String(x.id), x]))

  const nombrePerfil = (id: string | null) => {
    if (!id) return 'Sin responsable'
    const p: any = perfilMap.get(String(id))
    return p?.vendedor || p?.nombre || 'Usuario no disponible'
  }

  const estadoTexto = (c: any) => {
    const deuda: any = c.estado_deuda_id ? estadoMap.get(String(c.estado_deuda_id)) : null
    const cobertura: any = c.estado_cobertura_id ? estadoMap.get(String(c.estado_cobertura_id)) : null
    const legado: any = c.estado_consulta_id ? estadoMap.get(String(c.estado_consulta_id)) : null
    const partes = [
      deuda ? `Deuda: ${deuda.nombre}` : null,
      cobertura ? `Cobertura: ${cobertura.nombre}` : null,
    ].filter(Boolean)
    return partes.length ? partes.join(' · ') : (legado?.nombre || 'Sin estado')
  }

  const vendedores = Array.from(new Set(
    (consultas ?? []).map((c: any) => nombrePerfil(c.vendedor_id)).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, 'es'))

  const responsables = Array.from(new Set(
    (consultas ?? []).map((c: any) => nombrePerfil(c.responsable_id)).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, 'es'))

  const estadosFiltro = Array.from(new Set(
    (consultas ?? []).map((c: any) => estadoTexto(c))
  )).sort((a, b) => a.localeCompare(b, 'es'))

  const filas = (consultas ?? []).filter((c: any) => {
    const tipo: any = tipoMap.get(String(c.tipo_consulta_id))
    const vendedor = nombrePerfil(c.vendedor_id)
    const responsable = nombrePerfil(c.responsable_id)
    const estado = estadoTexto(c)

    if (filtroTipo && String(c.tipo_consulta_id) !== filtroTipo) return false
    if (filtroVendedor && vendedor !== filtroVendedor) return false
    if (filtroResponsable && responsable !== filtroResponsable) return false
    if (filtroEstado && estado !== filtroEstado) return false
    if (!q) return true

    return [
      c.id, c.cliente, c.dni, c.telefono, c.domicilio, c.localidad,
      c.observaciones, tipo?.nombre, vendedor, responsable, estado,
    ].filter(Boolean).join(' ').toLowerCase().includes(q)
  })

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader
        rol={profile.rol}
        usuario={profile.nombre?.trim() || user.email || 'Usuario'}
        actual="SUPER"
      />

      <div className="mx-auto max-w-7xl p-4 sm:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Super / Consultas</h1>
          <p className="mt-1 text-sm text-gray-500">
            Supervisión global de Consultas. Esta pantalla es de control y lectura.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <a href="/super" className="rounded-2xl border border-gray-200 bg-white p-4 hover:border-red-300">
            <div className="text-sm font-semibold text-gray-900">Ventas</div>
            <div className="mt-1 text-xs text-gray-500">BAF, PORTA y Línea Nueva</div>
          </a>
          <a href="/super/consultas" className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="text-sm font-semibold text-red-700">Consultas</div>
            <div className="mt-1 text-xs text-gray-500">Deuda y Cobertura</div>
          </a>
          <a href="/super/pedidos" className="rounded-2xl border border-gray-200 bg-white p-4 hover:border-red-300">
            <div className="text-sm font-semibold text-gray-900">Pedidos</div>
            <div className="mt-1 text-xs text-gray-500">Pedidos y Rellamados</div>
          </a>
        </div>

        <form method="get" className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="md:col-span-2 xl:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-500">Buscar</label>
            <input name="q" defaultValue={params?.q ?? ''} placeholder="Cliente, DNI, teléfono, domicilio..." className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Tipo</label>
            <select name="tipo" defaultValue={filtroTipo} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900">
              <option value="">Todos</option>
              {(tipos ?? []).map((t: any) => <option key={t.id} value={String(t.id)}>{t.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Vendedor</label>
            <select name="vendedor" defaultValue={filtroVendedor} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900">
              <option value="">Todos</option>
              {vendedores.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Responsable</label>
            <select name="responsable" defaultValue={filtroResponsable} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900">
              <option value="">Todos</option>
              {responsables.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Estado</label>
            <select name="estado" defaultValue={filtroEstado} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900">
              <option value="">Todos</option>
              {estadosFiltro.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-6">
            <button className="rounded-lg bg-red-600 px-5 py-2 font-semibold text-white hover:bg-red-700">Filtrar</button>
            <a href="/super/consultas" className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50">Limpiar</a>
          </div>
        </form>

        <div className="mb-3 text-sm text-gray-500">{filas.length} {filas.length === 1 ? 'consulta' : 'consultas'}</div>

        <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Cliente</th><th className="px-4 py-3">DNI</th>
                  <th className="px-4 py-3">Teléfono</th><th className="px-4 py-3">Vendedor</th>
                  <th className="px-4 py-3">Responsable</th><th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filas.map((c: any) => {
                  const tipo: any = tipoMap.get(String(c.tipo_consulta_id))
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">{fechaArgentina(c.marca_temporal)}</td>
                      <td className="px-4 py-3">{tipo?.nombre || '-'}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{c.cliente || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.dni || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.telefono || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{nombrePerfil(c.vendedor_id)}</td>
                      <td className="px-4 py-3 text-gray-600">{nombrePerfil(c.responsable_id)}</td>
                      <td className="px-4 py-3 text-gray-600">{estadoTexto(c)}</td>
                      <td className="px-4 py-3 text-right"><a href={`/super/consultas/${c.id}`} className="font-medium text-red-600 hover:text-red-700">Ver detalle</a></td>
                    </tr>
                  )
                })}
                {filas.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-500">No se encontraron Consultas.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3 md:hidden">
          {filas.map((c: any) => {
            const tipo: any = tipoMap.get(String(c.tipo_consulta_id))
            return (
              <div key={c.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><div className="font-semibold text-gray-900">{c.cliente || '-'}</div><div className="mt-1 text-xs text-gray-500">{fechaArgentina(c.marca_temporal)}</div></div>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">{tipo?.nombre || 'Consulta'}</span>
                </div>
                <div className="mt-4 space-y-2 text-sm text-gray-700">
                  <div><b>DNI:</b> {c.dni || '-'}</div><div><b>Teléfono:</b> {c.telefono || '-'}</div>
                  <div><b>Vendedor:</b> {nombrePerfil(c.vendedor_id)}</div><div><b>Responsable:</b> {nombrePerfil(c.responsable_id)}</div>
                  <div><b>Estado:</b> {estadoTexto(c)}</div>
                </div>
                <div className="mt-4 border-t border-gray-100 pt-3 text-right"><a href={`/super/consultas/${c.id}`} className="text-sm font-semibold text-red-600">Ver detalle</a></div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
