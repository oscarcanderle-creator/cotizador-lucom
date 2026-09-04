import { redirect } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'
import { createAdminClient } from '../../../utils/supabase/admin'
import AppHeader from '../../../components/AppHeader'

type SearchParams = Promise<{ q?: string; tipo?: string; vendedor?: string; responsable?: string; estado?: string; pagina?: string; por_pagina?: string }>

function fechaArgentina(fecha: string | null) {
  if (!fecha) return '-'
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(fecha))
}

export default async function SuperPedidosPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('nombre,rol,activo').eq('id', user.id).single()
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
    { data: pedidos, error: pedidosError },
    { data: tipos, error: tiposError },
    { data: estados, error: estadosError },
    { data: perfiles, error: perfilesError },
  ] = await Promise.all([
    dataClient.from('pedidos').select(`
      id, codigo, marca_temporal, tipo_pedido_id, vendedor_id, responsable_id,
      dni, telefono, domicilio, observaciones_vendedor, observaciones_gestion,
      estado_pedido_id, fecha_ok, fecha_gestion, wo
    `).order('marca_temporal', { ascending: false }),
    dataClient.from('tipos_pedido').select('id,codigo,nombre').order('orden').order('nombre'),
    dataClient.from('estados_pedido').select('id,codigo,nombre,tipo_estado,activo').order('orden').order('nombre'),
    dataClient.from('profiles').select('id,nombre,vendedor').order('nombre'),
  ])
  if (pedidosError) throw new Error(`No se pudieron cargar los Pedidos: ${pedidosError.message}`)
  if (tiposError) throw new Error(`No se pudieron cargar los Tipos de Pedido: ${tiposError.message}`)
  if (estadosError) throw new Error(`No se pudieron cargar los Estados de Pedido: ${estadosError.message}`)
  if (perfilesError) throw new Error(`No se pudieron cargar los usuarios: ${perfilesError.message}`)

  const tipoMap = new Map((tipos ?? []).map((x:any)=>[String(x.id),x]))
  const estadoMap = new Map((estados ?? []).map((x:any)=>[String(x.id),x]))
  const perfilMap = new Map((perfiles ?? []).map((x:any)=>[String(x.id),x]))
  const nombrePerfil = (id:string|null) => {
    if (!id) return 'Sin responsable'
    const p:any = perfilMap.get(String(id))
    return p?.vendedor || p?.nombre || 'Usuario no disponible'
  }
  const estadoTexto = (p:any) => p.estado_pedido_id ? ((estadoMap.get(String(p.estado_pedido_id)) as any)?.nombre || 'Estado no disponible') : 'Sin estado'

  const vendedores = Array.from(new Set((pedidos ?? []).map((p:any)=>nombrePerfil(p.vendedor_id)))).sort((a,b)=>a.localeCompare(b,'es'))
  const responsables = Array.from(new Set((pedidos ?? []).map((p:any)=>nombrePerfil(p.responsable_id)))).sort((a,b)=>a.localeCompare(b,'es'))
  const estadosFiltro = Array.from(new Set((pedidos ?? []).map((p:any)=>estadoTexto(p)))).sort((a,b)=>a.localeCompare(b,'es'))

  const filas = (pedidos ?? []).filter((p:any)=>{
    const tipo:any = tipoMap.get(String(p.tipo_pedido_id))
    const vendedor=nombrePerfil(p.vendedor_id), responsable=nombrePerfil(p.responsable_id), estado=estadoTexto(p)
    if (filtroTipo && String(p.tipo_pedido_id)!==filtroTipo) return false
    if (filtroVendedor && vendedor!==filtroVendedor) return false
    if (filtroResponsable && responsable!==filtroResponsable) return false
    if (filtroEstado && estado!==filtroEstado) return false
    if (!q) return true
    return [p.id,p.dni,p.telefono].filter((valor) => valor !== null && valor !== undefined).some((valor) => String(valor).toLowerCase().includes(q))
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
    return `/super/pedidos?${qs.toString()}`
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader rol={profile.rol} usuario={profile.nombre?.trim() || user.email || 'Usuario'} actual="SUPER" />
      <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
        <div className="mb-6"><h1 className="text-2xl font-bold text-gray-900">Super / Pedidos</h1><p className="mt-1 text-sm text-gray-500">Supervisión global de Pedidos. Esta pantalla es de control y lectura.</p></div>
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
            className="rounded-2xl border border-gray-200 bg-gray-100 text-gray-900 hover:bg-gray-200 p-4 transition"
          >
            <div className="flex min-h-[60px] flex-col justify-center">
              <div className="text-sm font-semibold text-gray-900">Consultas</div>
              <div className="mt-1 text-xs text-gray-500">Deuda y Cobertura</div>
            </div>
          </a>
          <a
            href="/super/pedidos"
            className="rounded-2xl border border-red-600 bg-red-600 text-white shadow-sm p-4 transition"
          >
            <div className="flex min-h-[60px] flex-col justify-center">
              <div className="text-sm font-semibold text-white">Pedidos</div>
              <div className="mt-1 text-xs text-red-50">Pedidos y Rellamados</div>
            </div>
          </a>
        </div>

        <form method="get" className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="md:col-span-2 xl:col-span-2"><label className="mb-1 block text-xs font-medium text-gray-500">Buscar</label><input name="q" defaultValue={params?.q ?? ''} placeholder="ID, DNI o teléfono..." className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900" /></div>
          <div><label className="mb-1 block text-xs font-medium text-gray-500">Tipo</label><select name="tipo" defaultValue={filtroTipo} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"><option value="">Todos</option>{(tipos ?? []).map((t:any)=><option key={t.id} value={String(t.id)}>{t.nombre}</option>)}</select></div>
          <div><label className="mb-1 block text-xs font-medium text-gray-500">Vendedor</label><select name="vendedor" defaultValue={filtroVendedor} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"><option value="">Todos</option>{vendedores.map(v=><option key={v} value={v}>{v}</option>)}</select></div>
          <div><label className="mb-1 block text-xs font-medium text-gray-500">Responsable</label><select name="responsable" defaultValue={filtroResponsable} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"><option value="">Todos</option>{responsables.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
          <div><label className="mb-1 block text-xs font-medium text-gray-500">Estado</label><select name="estado" defaultValue={filtroEstado} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"><option value="">Todos</option>{estadosFiltro.map(e=><option key={e} value={e}>{e}</option>)}</select></div>
          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-6"><button className="rounded-lg bg-red-600 px-5 py-2 font-semibold text-white hover:bg-red-700">Filtrar</button><a href="/super/pedidos" className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50">Limpiar</a></div>
        </form>

        <div className="mb-3 text-sm text-gray-500">{filas.length} {filas.length===1?'pedido':'pedidos'}</div>
        <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white md:block"><div className="overflow-x-auto"><table className="min-w-[1400px] w-full table-fixed text-left text-[13px]">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="w-[70px] px-3 py-3">ID</th><th className="w-[135px] px-3 py-3">Fecha</th><th className="w-[135px] px-3 py-3">Fecha Gestión</th><th className="w-[135px] px-3 py-3">Código</th><th className="w-[180px] px-3 py-3">Tipo</th><th className="w-[110px] px-3 py-3">DNI</th><th className="w-[120px] px-3 py-3">Teléfono</th><th className="w-[170px] px-3 py-3">Vendedor</th><th className="w-[170px] px-3 py-3">Responsable</th><th className="w-[170px] px-3 py-3">Estado</th><th className="sticky right-0 z-20 w-[94px] border-l border-gray-200 bg-gray-50 px-3 py-3 text-center">Acción</th></tr></thead>
          <tbody className="divide-y divide-gray-100">{filasPagina.map((p:any)=>{const tipo:any=tipoMap.get(String(p.tipo_pedido_id)); return <tr key={p.id} className="group hover:bg-gray-50"><td className="px-3 py-3 font-semibold text-gray-900">#{p.id}</td><td className="px-3 py-3 align-top text-gray-600"><div className="leading-5">{fechaArgentina(p.marca_temporal)}</div></td><td className="px-3 py-3 align-top text-gray-600"><div className="leading-5">{fechaArgentina(p.fecha_gestion)}</div></td><td className="px-3 py-3 font-medium text-gray-900">{p.codigo || `#${p.id}`}</td><td className="px-3 py-3 align-top"><div className="whitespace-normal break-words leading-5">{tipo?.nombre || '-'}</div></td><td className="px-3 py-3 text-gray-600">{p.dni || '-'}</td><td className="px-3 py-3 text-gray-600">{p.telefono || '-'}</td><td className="px-3 py-3 align-top text-gray-600"><div className="break-words leading-5">{nombrePerfil(p.vendedor_id)}</div></td><td className="px-3 py-3 align-top text-gray-600"><div className="break-words leading-5">{nombrePerfil(p.responsable_id)}</div></td><td className="px-3 py-3 align-top text-gray-600"><div className="whitespace-normal break-words leading-5">{estadoTexto(p)}</div></td><td className="sticky right-0 z-10 whitespace-nowrap border-l border-gray-200 bg-white px-3 py-3 text-center group-hover:bg-gray-50"><a href={`/super/pedidos/${p.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 font-medium text-gray-700 hover:border-red-300 hover:text-red-600"><svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="1.7" /><circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.7" /></svg><span>Ver</span></a></td></tr>})}{filas.length===0&&<tr><td colSpan={11} className="px-4 py-10 text-center text-gray-500">No se encontraron Pedidos.</td></tr>}</tbody>
        </table></div></div>


        <div className="mt-3 flex flex-col items-center justify-between gap-3 text-sm text-gray-500 sm:flex-row">
          <div>{filas.length === 0 ? 'Sin resultados' : `Mostrando ${inicio + 1} a ${fin} de ${filas.length} pedidos`}</div>
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

        <div className="space-y-3 md:hidden">{filasPagina.map((p:any)=>{const tipo:any=tipoMap.get(String(p.tipo_pedido_id)); return <div key={p.id} className="rounded-2xl border border-gray-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-gray-900">Pedido #{p.id} · {p.codigo || 'Sin código'}</div><div className="mt-1 text-xs text-gray-500">{fechaArgentina(p.marca_temporal)}</div></div><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">{tipo?.nombre || 'Pedido'}</span></div><div className="mt-4 space-y-2 text-sm text-gray-700"><div><b>ID:</b> #{p.id}</div><div><b>Fecha Gestión:</b> {fechaArgentina(p.fecha_gestion)}</div><div><b>DNI:</b> {p.dni || '-'}</div><div><b>Teléfono:</b> {p.telefono || '-'}</div><div><b>Vendedor:</b> {nombrePerfil(p.vendedor_id)}</div><div><b>Responsable:</b> {nombrePerfil(p.responsable_id)}</div><div><b>Estado:</b> {estadoTexto(p)}</div></div><div className="mt-4 border-t border-gray-100 pt-3 text-right"><a href={`/super/pedidos/${p.id}`} className="text-sm font-semibold text-red-600">Ver detalle</a></div></div>})}</div>
      </div>
    </main>
  )
}
