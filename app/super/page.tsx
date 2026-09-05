import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import AppHeader from '../../components/AppHeader'
import FiltrosAvanzadosVentas from '../../components/FiltrosAvanzadosVentas'

type SearchParams = Promise<{
  q?: string
  tipo?: string
  vendedor?: string
  responsable?: string
  estado?: string
  pagina?: string
  por_pagina?: string
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

export default async function SuperVentasPage({
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
  if (!['ADMIN', 'SUPERVISOR'].includes(profile.rol)) redirect('/ventas')

  const params = await searchParams
  const q = String(params?.q ?? '').trim().toLowerCase()
  const filtroTipo = String(params?.tipo ?? '').trim().toUpperCase()
  const filtroVendedor = String(params?.vendedor ?? '').trim()
  const filtroResponsable = String(params?.responsable ?? '').trim()
  const filtroEstado = String(params?.estado ?? '').trim()
  const paginaSolicitada = Math.max(1, parseInt(String(params?.pagina ?? '1'), 10) || 1)
  const opcionesPorPagina = [10, 20, 50]
  const porPaginaSolicitado = parseInt(String(params?.por_pagina ?? '20'), 10) || 20
  const porPagina = opcionesPorPagina.includes(porPaginaSolicitado) ? porPaginaSolicitado : 20

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
        compania_actual,
        tipo_sim
      ),
      gestion_baf (
        responsable_id,
        estado_baf_id,
        estados_baf (
          nombre
        )
      ),
      gestion_porta (
        responsable_id,
        estado_porta_id,
        medio_despacho_chip_id,
        fecha_carga_stl,
        fecha_porta,
        pin_lnva_nro,
        sim,
        numero_seguimiento,
        estados_porta (
          nombre
        )
      )
    `)
    .in('tipo', ['BAF', 'PORTA'])
    .order('fecha_hora', { ascending: false })

  if (error) {
    throw new Error(`No se pudieron cargar las ventas: ${error.message}`)
  }

  const { data: perfiles, error: perfilesError } = await supabase
    .from('profiles')
    .select('id, nombre, vendedor')
    .order('nombre', { ascending: true })

  if (perfilesError) {
    throw new Error(`No se pudieron cargar los usuarios: ${perfilesError.message}`)
  }

  const { data: mediosDespacho, error: mediosDespachoError } = await supabase
    .from('medios_despacho_chip')
    .select('id, nombre')
    .order('nombre', { ascending: true })

  if (mediosDespachoError) {
    throw new Error(`No se pudieron cargar los medios de despacho: ${mediosDespachoError.message}`)
  }

  const medioDespachoPorId = new Map(
    (mediosDespacho ?? []).map((medio: any) => [medio.id, medio.nombre])
  )

  const nombreResponsable = (operacion: any) => {
    const responsableId = operacion.tipo === 'BAF'
      ? operacion.gestion_baf?.responsable_id
      : operacion.gestion_porta?.responsable_id

    if (!responsableId) return 'Sin responsable'
    const perfil = (perfiles ?? []).find((item: any) => item.id === responsableId)
    return perfil?.vendedor || perfil?.nombre || 'Usuario no disponible'
  }

  const vendedores = Array.from(new Set(
    (operaciones ?? []).map((o: any) => String(o.vendedor ?? '').trim()).filter(Boolean)
  )) as string[]

  const responsables = Array.from(new Set(
    (operaciones ?? []).map((o: any) => nombreResponsable(o))
  )) as string[]

  const estados = Array.from(new Set(
    (operaciones ?? []).map((o: any) => estadoVisible(o))
  )) as string[]

  vendedores.sort((a, b) => a.localeCompare(b, 'es'))
  responsables.sort((a, b) => a.localeCompare(b, 'es'))
  estados.sort((a, b) => a.localeCompare(b, 'es'))

  const companias = Array.from(new Set(
    (operaciones ?? [])
      .map((o: any) => String(o.operaciones_porta?.compania_actual ?? '').trim())
      .filter(Boolean)
  )) as string[]
  companias.sort((a, b) => a.localeCompare(b, 'es'))

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

  const ventas = (operaciones ?? []).filter((operacion: any) => {
    const tipo = tipoVisible(operacion)

    if (filtroTipo && filtroTipo !== tipo) return false
    if (filtroVendedor && operacion.vendedor !== filtroVendedor) return false
    if (filtroResponsable && nombreResponsable(operacion) !== filtroResponsable) return false
    if (filtroEstado && estadoVisible(operacion) !== filtroEstado) return false
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
      productoVisible(operacion),
      estadoVisible(operacion),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return texto.includes(q)
  })


  const totalPaginas = Math.max(1, Math.ceil(ventas.length / porPagina))
  const pagina = Math.min(paginaSolicitada, totalPaginas)
  const inicio = (pagina - 1) * porPagina
  const fin = Math.min(inicio + porPagina, ventas.length)
  const ventasPagina = ventas.slice(inicio, fin)

  const hrefPagina = (n: number) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', String(params.q))
    if (filtroTipo) qs.set('tipo', filtroTipo)
    if (filtroVendedor) qs.set('vendedor', filtroVendedor)
    if (filtroResponsable) qs.set('responsable', filtroResponsable)
    if (filtroEstado) qs.set('estado', filtroEstado)
    filtrosAvanzados.forEach((filtro, indice) => {
      const numero = indice + 1
      if (numero > 1) qs.set(`f${numero}_join`, filtro.conector)
      qs.set(`f${numero}_field`, filtro.campo)
      qs.set(`f${numero}_op`, filtro.condicion)
      if (filtro.valor) qs.set(`f${numero}_value`, filtro.valor)
      if (filtro.valor2) qs.set(`f${numero}_value2`, filtro.valor2)
    })
    qs.set('pagina', String(n))
    qs.set('por_pagina', String(porPagina))
    return `/super?${qs.toString()}`
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
          <h1 className="text-2xl font-bold text-gray-900">
            Super / Ventas
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Vista global de todas las operaciones registradas.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <a
            href="/super"
            className="rounded-2xl border border-red-600 bg-red-600 text-white shadow-sm p-4 transition"
          >
            <div className="flex min-h-[60px] flex-col justify-center">
              <div className="text-sm font-semibold text-white">Ventas</div>
              <div className="mt-1 text-xs text-red-50">BAF, PORTA y Línea Nueva</div>
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
            className="rounded-2xl border border-gray-200 bg-gray-100 text-gray-900 hover:bg-gray-200 p-4 transition"
          >
            <div className="flex min-h-[60px] flex-col justify-center">
              <div className="text-sm font-semibold text-gray-900">Pedidos</div>
              <div className="mt-1 text-xs text-gray-500">Acometida, Proyecto, Ampliación y Rellamado</div>
            </div>
          </a>
        </div>

        <form method="get" className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="md:col-span-2 xl:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-500">Buscar</label>
            <input type="text" name="q" defaultValue={params?.q ?? ''} placeholder="Cliente, DNI, teléfono, NIM, vendedor..." className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900" />
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
              <option value="">Todos</option>
              {vendedores.map((v: string) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Responsable</label>
            <select name="responsable" defaultValue={filtroResponsable} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900">
              <option value="">Todos</option>
              {responsables.map((r: string) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Estado</label>
            <select name="estado" defaultValue={filtroEstado} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900">
              <option value="">Todos</option>
              {estados.map((e: string) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <FiltrosAvanzadosVentas
            estados={estados}
            vendedores={vendedores}
            responsables={responsables}
            mediosDespacho={(mediosDespacho ?? []).map((m: any) => String(m.nombre ?? '')).filter(Boolean)}
            companias={companias}
            iniciales={filtrosAvanzados}
          />

          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-6">
            <button type="submit" className="rounded-lg bg-red-600 px-5 py-2 font-semibold text-white hover:bg-red-700">Aplicar filtros</button>
            <a href="/super" className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50">Limpiar</a>
          </div>
        </form>

        <div className="mb-3 text-sm text-gray-500">
          {ventas.length} {ventas.length === 1 ? 'venta' : 'ventas'}
        </div>

        {/* DESKTOP */}
        <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white md:block">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-[13px]">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-3">Fecha</th>
                  <th className="px-3 py-3">Tipo</th>
                  <th className="px-3 py-3">Cliente</th>
                  <th className="px-3 py-3">DNI / CUIT</th>
                  <th className="px-3 py-3">Producto / Plan</th>
                  <th className="px-3 py-3">Vendedor</th>
                  <th className="px-3 py-3">Responsable</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="sticky right-0 z-20 w-[94px] border-l border-gray-200 bg-gray-50 px-3 py-3 text-center">Acción</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {ventasPagina.map((operacion: any) => (
                  <tr
                    key={operacion.id_operacion}
                    className="group hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap px-3 py-3 text-gray-600">
                      {fechaArgentina(operacion.fecha_hora)}
                    </td>

                    <td className="px-3 py-3">
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                        {tipoVisible(operacion)}
                      </span>
                    </td>

                    <td className="px-3 py-3 font-medium text-gray-900">
                      {nombreCliente(operacion.cliente)}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3 text-gray-600">
                      {operacion.cliente?.tipo_documento
                        ? `${operacion.cliente.tipo_documento} `
                        : ''}
                      {operacion.cliente?.dni || '-'}
                    </td>

                    <td className="px-3 py-3 text-gray-600">
                      {productoVisible(operacion)}
                    </td>

                    <td className="px-3 py-3 text-gray-600">{operacion.vendedor || '-'}</td>
                    <td className="px-3 py-3 text-gray-600">{nombreResponsable(operacion)}</td>

                    <td className="px-3 py-3">
                      <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
                        {estadoVisible(operacion)}
                      </span>
                    </td>

                    <td className="sticky right-0 z-10 whitespace-nowrap border-l border-gray-200 bg-white px-3 py-3 text-center group-hover:bg-gray-50">
                      <a
                        href={`/super/ventas/${encodeURIComponent(operacion.id_operacion)}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 font-medium text-gray-700 hover:border-red-300 hover:text-red-600"
                      >
                        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="1.7" />
                          <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.7" />
                        </svg>
                        Ver
                      </a>
                    </td>
                  </tr>
                ))}

                {ventas.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
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


        <div className="mt-3 flex flex-col items-center justify-between gap-3 text-sm text-gray-500 sm:flex-row">
          <div>{ventas.length === 0 ? 'Sin resultados' : `Mostrando ${inicio + 1} a ${fin} de ${ventas.length} ventas`}</div>
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
            {filtrosAvanzados.map((filtro, indice) => {
              const numero = indice + 1
              return (
                <span key={`filtro-${numero}`} className="hidden">
                  {numero > 1 && <input type="hidden" name={`f${numero}_join`} value={filtro.conector} />}
                  <input type="hidden" name={`f${numero}_field`} value={filtro.campo} />
                  <input type="hidden" name={`f${numero}_op`} value={filtro.condicion} />
                  {filtro.valor && <input type="hidden" name={`f${numero}_value`} value={filtro.valor} />}
                  {filtro.valor2 && <input type="hidden" name={`f${numero}_value2`} value={filtro.valor2} />}
                </span>
              )
            })}
            <span>Por página:</span>
            <select name="por_pagina" defaultValue={String(porPagina)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700">
              {opcionesPorPagina.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <button className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700">Aplicar</button>
          </form>
        </div>

        {/* MOBILE */}
        <div className="space-y-3 md:hidden">
          {ventasPagina.map((operacion: any) => (
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

                <div>
                  <div className="text-xs text-gray-400">Vendedor</div>
                  <div className="mt-1 text-gray-700">{operacion.vendedor || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Responsable</div>
                  <div className="mt-1 text-gray-700">{nombreResponsable(operacion)}</div>
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
                  href={`/super/ventas/${encodeURIComponent(operacion.id_operacion)}`}
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
