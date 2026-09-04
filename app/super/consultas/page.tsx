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
  pagina?: string
  por_pagina?: string
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
  const paginaSolicitada = Math.max(1, parseInt(String(params?.pagina ?? '1'), 10) || 1)
  const opcionesPorPagina = [10, 20, 50]
  const porPaginaSolicitado = parseInt(String(params?.por_pagina ?? '20'), 10) || 20
  const porPagina = opcionesPorPagina.includes(porPaginaSolicitado) ? porPaginaSolicitado : 20

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
        estado_consulta_id, estado_deuda_id, estado_cobertura_id, fecha_estado, fecha_gestion
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

    return [c.id, c.dni, c.telefono]
      .filter((valor) => valor !== null && valor !== undefined)
      .some((valor) => String(valor).toLowerCase().includes(q))
  })


  const totalPaginas = Math.max(1, Math.ceil(filas.length / porPagina))
  const pagina = Math.min(paginaSolicitada, totalPaginas)
  const inicio = (pagina - 1) * porPagina
  const fin = Math.min(inicio + porPagina, filas.length)
  const filasPagina = filas.slice(inicio, fin)

  const hrefPagina = (n: number) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', String(params.q))
    if (filtroTipo) qs.set('tipo', filtroTipo)
    if (filtroVendedor) qs.set('vendedor', filtroVendedor)
    if (filtroResponsable) qs.set('responsable', filtroResponsable)
    if (filtroEstado) qs.set('estado', filtroEstado)
    qs.set('pagina', String(n))
    qs.set('por_pagina', String(porPagina))
    return `/super/consultas?${qs.toString()}`
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader
        rol={profile.rol}
        usuario={profile.nombre?.trim() || user.email || 'Usuario'}
        actual="SUPER"
      />

      <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Super / Consultas</h1>
          <p className="mt-1 text-sm text-gray-500">
            Supervisión global de Consultas. Esta pantalla es de control y lectura.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <a
            href="/super"
            className="rounded-2xl border border-gray-200 bg-gray-100 text-gray-900 hover:bg-gray-200 p-4 transition"
          >
            <div className="flex min-h-[60px] flex-col justify-center">
              <div className="text-sm font-semibold text-gray-900">Ventas</div>
              <div className="mt-1 text-xs text-gray-500">BAF, PORTA y Línea Nueva</div>
            </div>
          </a>
          <a
            href="/super/consultas"
            className="rounded-2xl border border-red-600 bg-red-600 text-white shadow-sm p-4 transition"
          >
            <div className="flex min-h-[60px] flex-col justify-center">
              <div className="text-sm font-semibold text-white">Consultas</div>
              <div className="mt-1 text-xs text-red-50">Deuda y Cobertura</div>
            </div>
          </a>
          <a
            href="/super/pedidos"
            className="rounded-2xl border border-gray-200 bg-gray-100 text-gray-900 hover:bg-gray-200 p-4 transition"
          >
            <div className="flex min-h-[60px] flex-col justify-center">
              <div className="text-sm font-semibold text-gray-900">Pedidos</div>
              <div className="mt-1 text-xs text-gray-500">Pedidos y Rellamados</div>
            </div>
          </a>
        </div>

        <form method="get" className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="md:col-span-2 xl:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-500">Buscar</label>
            <input name="q" defaultValue={params?.q ?? ''} placeholder="ID, DNI o teléfono..." className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900" />
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
            <table className="min-w-[1380px] w-full table-fixed text-left text-[13px]">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="w-[70px] px-3 py-3">ID</th><th className="w-[135px] px-3 py-3">Fecha</th><th className="w-[135px] px-3 py-3">Fecha Gestión</th><th className="w-[140px] px-3 py-3">Tipo</th>
                  <th className="w-[150px] px-3 py-3">Cliente</th><th className="w-[110px] px-3 py-3">DNI</th>
                  <th className="w-[120px] px-3 py-3">Teléfono</th><th className="w-[170px] px-3 py-3">Vendedor</th>
                  <th className="w-[170px] px-3 py-3">Responsable</th><th className="w-[200px] px-3 py-3">Estado</th>
                  <th className="sticky right-0 z-20 w-[94px] border-l border-gray-200 bg-gray-50 px-3 py-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filasPagina.map((c: any) => {
                  const tipo: any = tipoMap.get(String(c.tipo_consulta_id))
                  return (
                    <tr key={c.id} className="group hover:bg-gray-50">
                      <td className="px-3 py-3 font-semibold text-gray-900">#{c.id}</td><td className="px-3 py-3 align-top text-gray-600"><div className="leading-5">{fechaArgentina(c.marca_temporal)}</div></td><td className="px-3 py-3 align-top text-gray-600"><div className="leading-5">{fechaArgentina(c.fecha_gestion)}</div></td>
                      <td className="px-3 py-3 align-top"><div className="whitespace-normal break-words leading-5">{tipo?.nombre || '-'}</div></td>
                      <td className="px-3 py-3 align-top font-medium text-gray-900"><div className="whitespace-normal break-words leading-5">{c.cliente || '-'}</div></td>
                      <td className="px-3 py-3 text-gray-600">{c.dni || '-'}</td>
                      <td className="px-3 py-3 text-gray-600">{c.telefono || '-'}</td>
                      <td className="px-3 py-3 align-top text-gray-600"><div className="break-words leading-5">{nombrePerfil(c.vendedor_id)}</div></td>
                      <td className="px-3 py-3 align-top text-gray-600"><div className="break-words leading-5">{nombrePerfil(c.responsable_id)}</div></td>
                      <td className="px-3 py-3 align-top text-gray-600"><div className="whitespace-normal break-words leading-5">{estadoTexto(c)}</div></td>
                      <td className="sticky right-0 z-10 whitespace-nowrap border-l border-gray-200 bg-white px-3 py-3 text-center group-hover:bg-gray-50"><a href={`/super/consultas/${c.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 font-medium text-gray-700 hover:border-red-300 hover:text-red-600"><svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="1.7" /><circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.7" /></svg><span>Ver</span></a></td>
                    </tr>
                  )
                })}
                {filas.length === 0 && <tr><td colSpan={11} className="px-4 py-10 text-center text-gray-500">No se encontraron Consultas.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>


        <div className="mt-3 flex flex-col items-center justify-between gap-3 text-sm text-gray-500 sm:flex-row">
          <div>{filas.length === 0 ? 'Sin resultados' : `Mostrando ${inicio + 1} a ${fin} de ${filas.length} consultas`}</div>
          <div className="flex items-center gap-2">
            <a href={hrefPagina(1)} className={`rounded-lg border px-3 py-2 ${pagina === 1 ? 'pointer-events-none text-gray-300' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>«</a>
            <a href={hrefPagina(Math.max(1, pagina - 1))} className={`rounded-lg border px-3 py-2 ${pagina === 1 ? 'pointer-events-none text-gray-300' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>‹</a>
            <span className="rounded-lg bg-red-600 px-3 py-2 font-semibold text-white">{pagina}</span>
            <a href={hrefPagina(Math.min(totalPaginas, pagina + 1))} className={`rounded-lg border px-3 py-2 ${pagina === totalPaginas ? 'pointer-events-none text-gray-300' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>›</a>
            <a href={hrefPagina(totalPaginas)} className={`rounded-lg border px-3 py-2 ${pagina === totalPaginas ? 'pointer-events-none text-gray-300' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>»</a>
          </div>
          <form method="get" className="flex items-center gap-2">
            {params?.q && <input type="hidden" name="q" value={String(params.q)} />}
            {filtroTipo && <input type="hidden" name="tipo" value={filtroTipo} />}
            {filtroVendedor && <input type="hidden" name="vendedor" value={filtroVendedor} />}
            {filtroResponsable && <input type="hidden" name="responsable" value={filtroResponsable} />}
            {filtroEstado && <input type="hidden" name="estado" value={filtroEstado} />}
            <span>Por página:</span>
            <select name="por_pagina" defaultValue={String(porPagina)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700">
              {opcionesPorPagina.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <button className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700">Aplicar</button>
          </form>
        </div>

        <div className="space-y-3 md:hidden">
          {filasPagina.map((c: any) => {
            const tipo: any = tipoMap.get(String(c.tipo_consulta_id))
            return (
              <div key={c.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><div className="font-semibold text-gray-900">Consulta #{c.id} · {c.cliente || '-'}</div><div className="mt-1 text-xs text-gray-500">{fechaArgentina(c.marca_temporal)}</div></div>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">{tipo?.nombre || 'Consulta'}</span>
                </div>
                <div className="mt-4 space-y-2 text-sm text-gray-700">
                  <div><b>ID:</b> #{c.id}</div><div><b>Fecha Gestión:</b> {fechaArgentina(c.fecha_gestion)}</div><div><b>DNI:</b> {c.dni || '-'}</div><div><b>Teléfono:</b> {c.telefono || '-'}</div>
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
