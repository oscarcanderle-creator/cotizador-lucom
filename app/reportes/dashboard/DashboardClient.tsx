'use client'

import { useEffect, useState } from 'react'

type TotalesPdv = { '2PLAY': number; '3PLAY': number; 'AÑADIR TV': number; total: number }
type RespuestaPdv = {
  desde: string
  hasta: string
  totales: TotalesPdv
  porPdv: { punto_venta_id: string; punto_venta: string; totales: TotalesPdv; vendedores: Record<string, TotalesPdv> }[]
  diarios: Record<string, TotalesPdv>
}
type Tema = 'ejecutivo' | 'oscuro' | 'compacto'
type Indicador = 'ingresadas' | 'cargadas' | 'finalizadas' | 'canceladas'
type Categoria = '2PLAY' | '3PLAY' | 'AÑADIR TV' | 'SIN CLASIFICAR'
type DetallePlanes = {
  desde: string
  hasta: string
  planes: { plan: string; porta: number; ln: number }[]
  totales: { porta: number; ln: number }
  fwa: number
}
type Respuesta = {
  desde: string
  hasta: string
  totales: Record<Indicador, number>
  categorias: Record<Indicador, Record<Categoria, number>>
  porCanal: Record<string, { totales: Record<Indicador, number>; vendedores: Record<string, Record<Indicador, number>> }>
  porVendedor: Record<string, Record<Indicador, number>>
  diarios: Record<string, Record<Indicador, number>>
}

const indicadores: { clave: Indicador; titulo: string; descripcion: string }[] = [
  { clave: 'ingresadas', titulo: 'Ventas ingresadas', descripcion: 'Fecha de ingreso de la venta' },
  { clave: 'cargadas', titulo: 'BAF cargadas', descripcion: 'Fecha de gestión y SDS' },
  { clave: 'finalizadas', titulo: 'BAF finalizadas', descripcion: 'Fecha de cierre informada por Claro' },
  { clave: 'canceladas', titulo: 'BAF canceladas', descripcion: 'Fecha de cierre informada por Claro' },
]
const categorias: Categoria[] = ['2PLAY', '3PLAY', 'AÑADIR TV', 'SIN CLASIFICAR']
const formatoNumero = new Intl.NumberFormat('es-AR')

function hoyArgentina(): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).formatToParts(new Date())
  const tomar = (tipo: string) => partes.find(p => p.type === tipo)?.value ?? ''
  return `${tomar('year')}-${tomar('month')}-${tomar('day')}`
}
function mesAnterior(desde: string) {
  const [anio, mes] = desde.split('-').map(Number)
  const inicio = new Date(Date.UTC(anio, mes - 2, 1))
  const fin = new Date(Date.UTC(anio, mes - 1, 0))
  return { desde: inicio.toISOString().slice(0, 10), hasta: fin.toISOString().slice(0, 10) }
}
function etiquetaMes(fecha: string) {
  return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(fecha + 'T12:00:00Z'))
}
function rangoPeriodo(periodo: string) {
  const hoy = hoyArgentina()
  const [anio, mes, dia] = hoy.split('-').map(Number)
  const inicioMes = `${anio}-${String(mes).padStart(2, '0')}-01`
  if (periodo === 'hoy') return { desde: hoy, hasta: hoy }
  if (periodo === 'mes') return { desde: inicioMes, hasta: hoy }
  if (periodo === 'anterior') {
    const inicio = new Date(Date.UTC(anio, mes - 2, 1))
    const fin = new Date(Date.UTC(anio, mes - 1, 0))
    return { desde: inicio.toISOString().slice(0, 10), hasta: fin.toISOString().slice(0, 10) }
  }
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  const diaSemana = (fecha.getUTCDay() + 6) % 7
  fecha.setUTCDate(fecha.getUTCDate() - diaSemana)
  return { desde: fecha.toISOString().slice(0, 10), hasta: hoy }
}

export default function DashboardClient({ puedeVerTodos }: { puedeVerTodos: boolean }) {
  const [tema, setTema] = useState<Tema>('ejecutivo')
  const [periodo, setPeriodo] = useState('mes')
  const [fechaInicio, setFechaInicio] = useState(() => hoyArgentina().slice(0, 7) + '-01')
  const [fechaFinal, setFechaFinal] = useState(() => hoyArgentina())
  const [canal, setCanal] = useState('call')
  const [datosPdv, setDatosPdv] = useState<RespuestaPdv | null>(null)
  const [datos, setDatos] = useState<Respuesta | null>(null)
  const [comparacion, setComparacion] = useState<Respuesta | null>(null)
  const [detallePlanes, setDetallePlanes] = useState<DetallePlanes | null>(null)
  const [errorPlanes, setErrorPlanes] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (canal === 'todos' && !puedeVerTodos) {
      setError('No tenés permisos para consultar todos los canales.')
      setDatosPdv(null)
      setDatos(null)
      setComparacion(null)
      setDetallePlanes(null)
      setCargando(false)
      return
    }
    const controlador = new AbortController()
    const { desde, hasta } = periodo === 'personalizado'
      ? { desde: fechaInicio, hasta: fechaFinal }
      : rangoPeriodo(periodo)
    if (periodo === 'personalizado' && (!desde || !hasta || desde > hasta)) {
      setError('La fecha de inicio debe ser anterior o igual a la fecha final.')
      setDatos(null)
      setComparacion(null)
      setDetallePlanes(null)
      setCargando(false)
      return
    }
    setCargando(true)
    setError('')
    setDatosPdv(null)
    setDatos(null)
    setComparacion(null)
    setDetallePlanes(null)
    setErrorPlanes('')
    if (canal === 'pdv' || canal === 'todos') {
      const consultaPdv = fetch(`/api/dashboard/baf-pdv?desde=${desde}&hasta=${hasta}`, {
        signal: controlador.signal, cache: 'no-store',
      }).then(async respuesta => {
        const json = await respuesta.json()
        if (!respuesta.ok) throw new Error(json.error || 'No se pudieron recuperar las BAF de PDV.')
        return json as RespuestaPdv
      })
      if (canal === 'pdv') {
        consultaPdv
          .then(actual => { if (!controlador.signal.aborted) setDatosPdv(actual) })
          .catch((err: unknown) => {
            if (!controlador.signal.aborted) setError(err instanceof Error ? err.message : 'Error al consultar PDV.')
          })
          .finally(() => { if (!controlador.signal.aborted) setCargando(false) })
        return () => controlador.abort()
      }
      const consultaCall = fetch(`/api/dashboard/baf?desde=${desde}&hasta=${hasta}`, {
        signal: controlador.signal, cache: 'no-store',
      }).then(async respuesta => {
        const json = await respuesta.json()
        if (!respuesta.ok) throw new Error(json.error || 'No se pudieron recuperar las BAF de Call.')
        return json as Respuesta
      })
      Promise.all([consultaCall, consultaPdv])
        .then(([call, pdv]) => {
          if (!controlador.signal.aborted) {
            setDatos(call)
            setDatosPdv(pdv)
          }
        })
        .catch((err: unknown) => {
          if (!controlador.signal.aborted) setError(err instanceof Error ? err.message : 'Error al consolidar BAF.')
        })
        .finally(() => { if (!controlador.signal.aborted) setCargando(false) })
      return () => controlador.abort()
    }
    const comparar = periodo === 'mes' || periodo === 'anterior'
    const anterior = mesAnterior(desde)
    async function consultar(inicio: string, fin: string): Promise<Respuesta> {
      const respuesta = await fetch(`/api/dashboard/baf?desde=${inicio}&hasta=${fin}`, {
        signal: controlador.signal, cache: 'no-store',
      })
      const json = await respuesta.json()
      if (!respuesta.ok) throw new Error(json.error || 'No se pudieron recuperar los indicadores.')
      return json as Respuesta
    }
    fetch(`/api/dashboard/planes-movil?desde=${desde}&hasta=${hasta}`, {
      signal: controlador.signal, cache: 'no-store',
    })
      .then(async respuesta => {
        const json = await respuesta.json()
        if (!respuesta.ok) throw new Error(json.error || 'No se pudo consultar el detalle de planes.')
        if (!controlador.signal.aborted) setDetallePlanes(json as DetallePlanes)
      })
      .catch((err: unknown) => {
        if (!controlador.signal.aborted) setErrorPlanes(err instanceof Error ? err.message : 'Error al consultar planes.')
      })
    Promise.all([
      consultar(desde, hasta),
      comparar ? consultar(anterior.desde, anterior.hasta) : Promise.resolve(null),
    ])
      .then(([actual, previo]) => {
        if (!controlador.signal.aborted) {
          setDatos(actual)
          setComparacion(previo)
        }
      })
      .catch((err: unknown) => {
        if (!controlador.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Error al consultar los indicadores.')
        }
      })
      .finally(() => { if (!controlador.signal.aborted) setCargando(false) })
    return () => controlador.abort()
  }, [periodo, fechaInicio, fechaFinal, canal, puedeVerTodos])

  const oscuro = tema === 'oscuro'
  const fondo = oscuro ? 'bg-[#101827] text-white' : 'bg-gray-50 text-gray-900'
  const tarjeta = oscuro
    ? 'border-slate-700 bg-[#1b2638] text-white'
    : 'border-gray-200 bg-white text-gray-900'
  const secundario = oscuro ? 'text-slate-300' : 'text-gray-500'
  const control = oscuro
    ? 'border-slate-600 bg-slate-800 text-white'
    : 'border-gray-300 bg-white text-gray-900'
  const borde = oscuro ? 'border-slate-600' : 'border-gray-200'
  const fondoSuave = oscuro ? 'bg-slate-700/60' : 'bg-gray-50'
  const tituloSeccion = oscuro ? 'text-sky-300' : 'text-[#1b5594]'

  const productos = [
    { nombre: 'BAF', icono: '◉', color: 'bg-[#07559b]', activo: true },
    { nombre: 'PORTA', icono: '▣', color: 'bg-[#e21f2b]', activo: true },
    { nombre: 'LÍNEA NUEVA', icono: '▤', color: 'bg-[#7646d9]', activo: true },
    { nombre: 'FWA', icono: '⌁', color: 'bg-[#fa9800]', activo: true },
    { nombre: 'CATER / EQUIPOS', icono: '▣', color: 'bg-[#008c84]', activo: false },
    { nombre: '1175', icono: '▤', color: 'bg-[#6942c9]', activo: false },
  ]
  const bafTodosListo = canal === 'todos' && !!datos && !!datosPdv
  const bafTodos2 = (datos?.categorias.cargadas['2PLAY'] ?? 0) + (datosPdv?.totales['2PLAY'] ?? 0)
  const bafTodos3 = (datos?.categorias.cargadas['3PLAY'] ?? 0) + (datosPdv?.totales['3PLAY'] ?? 0)
  const bafTodosPlay = bafTodos2 + bafTodos3
  const bafTodosAnadir = (datos?.categorias.cargadas['AÑADIR TV'] ?? 0) + (datosPdv?.totales['AÑADIR TV'] ?? 0)
  const b2 = datos?.categorias.cargadas['2PLAY'] ?? 0
  const b3 = datos?.categorias.cargadas['3PLAY'] ?? 0
  const sumaPlay = b2 + b3
  const porcentaje2 = sumaPlay ? b2 / sumaPlay * 100 : 0
  const porcentaje3 = sumaPlay ? b3 / sumaPlay * 100 : 0
  const previo2 = comparacion?.categorias.cargadas['2PLAY'] ?? 0
  const previo3 = comparacion?.categorias.cargadas['3PLAY'] ?? 0
  const totalPrevio = previo2 + previo3
  const maximo = Math.max(sumaPlay, totalPrevio, 1)
  const variacion = totalPrevio ? ((sumaPlay - totalPrevio) / totalPrevio) * 100 : null
  const dias = datos ? Object.entries(datos.diarios ?? {}).sort(([a], [b]) => a.localeCompare(b)) : []
  const maximoDiario = Math.max(1, ...dias.flatMap(([, d]) => [d.cargadas, d.finalizadas, d.canceladas]))
  const coloresDiarios: { clave: 'cargadas' | 'finalizadas' | 'canceladas'; nombre: string; color: string }[] = [
    { clave: 'cargadas', nombre: 'Cargadas', color: '#2563eb' },
    { clave: 'finalizadas', nombre: 'Finalizadas', color: '#0d9488' },
    { clave: 'canceladas', nombre: 'Canceladas', color: '#dc2626' },
  ]
  const ordenCanales = ['CALL LUCOM', 'LUCOM TERRENO', 'DISTRIBUCIÓN', 'LUCOM BOT-IA', 'REDES LUCOM', 'REFERIDOS', 'SIN CLASIFICAR']
  const canalesOrdenados = ordenCanales
    .filter(nombre => !!datos?.porCanal?.[nombre])
    .map(nombre => ({ nombre, ...datos!.porCanal[nombre] }))
    .sort((a, b) => b.totales.cargadas - a.totales.cargadas || ordenCanales.indexOf(a.nombre) - ordenCanales.indexOf(b.nombre))
  const totalCanales = canalesOrdenados.reduce((acumulado, canal) => {
    for (const indicador of indicadores) acumulado[indicador.clave] += canal.totales[indicador.clave]
    return acumulado
  }, { ingresadas: 0, cargadas: 0, finalizadas: 0, canceladas: 0 })
  const concilia = datos && indicadores.every(indicador => totalCanales[indicador.clave] === datos.totales[indicador.clave])
  const barras = [
    { nombre: datos ? etiquetaMes(datos.desde) : 'Mes seleccionado', dos: b2, tres: b3, total: sumaPlay },
    { nombre: comparacion ? etiquetaMes(comparacion.desde) : 'Mes anterior', dos: previo2, tres: previo3, total: totalPrevio },
  ]

  return (
    <section className={'' + fondo + (oscuro ? ' border-slate-700' : ' border-gray-200') + ' overflow-hidden rounded-2xl border'}>
      <header className="flex flex-wrap items-center justify-between gap-4 bg-[#17457e] px-5 py-5 text-white sm:px-7">
        <div className="flex items-center gap-5">
          <div className="border-r border-blue-300/50 pr-5 text-2xl font-black italic tracking-tight">Lucom</div>
          <div>
            <h2 className="text-2xl font-bold leading-tight">Ventas y Activaciones</h2>
            <p className="text-sm text-blue-100">Call Lucom + Puntos de Venta</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setTema(actual => actual === 'oscuro' ? 'ejecutivo' : 'oscuro')}
            aria-label={oscuro ? 'Activar modo claro' : 'Activar modo oscuro'}
            aria-pressed={oscuro}
            className="rounded-lg border border-blue-200/50 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            {oscuro ? '☀ Modo claro' : '☾ Modo oscuro'}
          </button>
          <div className="text-right text-xs text-blue-100">
          <div>Origen de información</div>
          <div className="mt-1 font-semibold text-white">PGL · datos en consulta</div>
          <div className="text-blue-200">Claro · pendiente de integración</div>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-5">
        <div className={'' + tarjeta + ' mb-4 grid grid-cols-1 gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3'}>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Rango de fechas
            <span className={'' + control + ' flex min-w-0 items-center rounded-lg border font-normal'}>
              <select
                value={periodo}
                onChange={e => setPeriodo(e.target.value)}
                aria-label="Seleccionar rango de fechas"
                title={periodo === 'personalizado' ? 'Cambiar tipo de período' : undefined}
                className={periodo === 'personalizado'
                  ? 'w-9 shrink-0 cursor-pointer bg-transparent py-2 pl-1 text-transparent outline-none'
                  : 'min-w-0 w-full bg-transparent px-3 py-2 outline-none'}
              >
                <option value="hoy">Hoy</option>
                <option value="semana">Esta semana</option>
                <option value="mes">Mes en curso</option>
                <option value="anterior">Mes anterior</option>
                <option value="personalizado">Rango personalizado</option>
              </select>
              {periodo === 'personalizado' && (
                <span className={'grid min-w-0 flex-1 grid-cols-2 border-l ' + (oscuro ? 'border-slate-600' : 'border-gray-300')}>
                  <span className="flex min-w-0 flex-col px-1 text-[10px]">
                    Desde
                    <input type="date" aria-label="Fecha inicio" value={fechaInicio} max={fechaFinal || hoyArgentina()} onChange={e => setFechaInicio(e.target.value)} className={'min-w-0 w-full bg-transparent text-[11px] font-normal outline-none ' + (oscuro ? '[color-scheme:dark]' : '')} />
                  </span>
                  <span className={'flex min-w-0 flex-col border-l px-1 text-[10px] ' + (oscuro ? 'border-slate-600' : 'border-gray-300')}>
                    Hasta
                    <input type="date" aria-label="Fecha final" value={fechaFinal} min={fechaInicio} max={hoyArgentina()} onChange={e => setFechaFinal(e.target.value)} className={'min-w-0 w-full bg-transparent text-[11px] font-normal outline-none ' + (oscuro ? '[color-scheme:dark]' : '')} />
                  </span>
                </span>
              )}
            </span>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Canal principal
            <select value={canal} onChange={e => setCanal(e.target.value)} className={'' + control + ' rounded-lg border px-3 py-2 font-normal'}>
              <option value="call">Call Lucom</option>
              {puedeVerTodos && <option value="todos">Todos los canales</option>}
              <option value="pdv">Puntos de Venta</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Canales de venta / PDV
            <select disabled className={'' + control + ' rounded-lg border px-3 py-2 font-normal opacity-60'}>
              <option>Próxima etapa</option>
            </select>
          </label>
        </div>

        {canal === 'todos' && <p className={'' + tarjeta + ' mb-4 rounded-xl border p-4 text-sm'}>BAF consolidado: Call Lucom (cargadas con SDS) + Puntos de Venta (activaciones). PORTA, Línea Nueva, FWA, CATER y 1175: pendientes de consolidación; no se presentan totales parciales como totales de agencia.</p>}
        {error && <p role="alert" className="mb-4 text-sm font-semibold text-red-600">{error}</p>}
        {cargando && <p className={'' + secundario + ' mb-4 text-sm'}>Consultando indicadores BAF...</p>}

        {/* Tarjetas comunes Call y PDV */}
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {productos.map(producto => (
            <div key={producto.nombre} className={'' + tarjeta + ' overflow-hidden rounded-xl border shadow-sm'}>
              <div className={'' + producto.color + ' flex items-center justify-between px-3 py-3 font-bold text-white'}>
                <span className="text-lg">{producto.icono}</span>
                <span className="text-sm">{producto.nombre}</span>
              </div>
              <div className="px-3 py-4 text-center">
                <div className="text-3xl font-bold tabular-nums">{bafTodosListo && producto.nombre === 'BAF' ? formatoNumero.format(datos!.totales.cargadas + datosPdv!.totales.total) : canal === 'pdv' && producto.nombre === 'BAF' && datosPdv ? formatoNumero.format(datosPdv.totales.total) : canal === 'call' && producto.nombre === 'BAF' && datos ? formatoNumero.format(datos.totales.cargadas) : canal === 'call' && detallePlanes && producto.nombre === 'PORTA' ? formatoNumero.format(detallePlanes.totales.porta) : canal === 'call' && detallePlanes && producto.nombre === 'LÍNEA NUEVA' ? formatoNumero.format(detallePlanes.totales.ln) : canal === 'call' && detallePlanes && producto.nombre === 'FWA' ? formatoNumero.format(Number.isFinite(detallePlanes.fwa) ? detallePlanes.fwa : 0) : '—'}</div>
                <div className={'' + secundario + ' mt-1 text-xs'}>{producto.nombre === 'BAF' ? (canal === 'todos' ? 'Call cargadas + PDV activadas' : canal === 'pdv' ? 'Activaciones · Fecha activación' : 'BAF cargadas · SDS validada') : ['PORTA', 'LÍNEA NUEVA', 'FWA'].includes(producto.nombre) ? 'CARGADO STL · Fecha Carga STL' : 'Pendiente de integración'}</div>
                {producto.nombre === 'BAF' && canal === 'todos' && bafTodosListo && (
                  <>
                    <div className={'mt-3 flex h-3 overflow-hidden rounded ' + (oscuro ? 'bg-slate-700' : 'bg-gray-200')}>
                      <div style={{ width: (bafTodosPlay ? bafTodos2 / bafTodosPlay * 100 : 0) + '%', backgroundColor: '#2563eb' }} />
                      <div style={{ width: (bafTodosPlay ? bafTodos3 / bafTodosPlay * 100 : 0) + '%', backgroundColor: '#0d9488' }} />
                    </div>
                    <div className="mt-2 flex justify-between gap-2 text-xs">
                      <span>2PLAY <strong>{formatoNumero.format(bafTodos2)}</strong></span>
                      <span>3PLAY <strong>{formatoNumero.format(bafTodos3)}</strong></span>
                    </div>
                    <p className={'' + secundario + ' mt-1 text-[11px]'}>AÑADIR TV: {formatoNumero.format(bafTodosAnadir)} · se contabiliza por separado</p>
                  </>
                )}
                {producto.nombre === 'BAF' && canal === 'pdv' && datosPdv && (() => {
                  const dosPlay = datosPdv.totales['2PLAY']
                  const tresPlay = datosPdv.totales['3PLAY']
                  const totalPlay = dosPlay + tresPlay
                  return (
                    <>
                      <div className={'mt-3 flex h-3 overflow-hidden rounded ' + (oscuro ? 'bg-slate-700' : 'bg-gray-200')}>
                        <div style={{ width: (totalPlay ? dosPlay / totalPlay * 100 : 0) + '%', backgroundColor: '#2563eb' }} />
                        <div style={{ width: (totalPlay ? tresPlay / totalPlay * 100 : 0) + '%', backgroundColor: '#0d9488' }} />
                      </div>
                      <div className="mt-2 flex justify-between gap-2 text-xs">
                        <span>2PLAY <strong>{formatoNumero.format(dosPlay)}</strong></span>
                        <span>3PLAY <strong>{formatoNumero.format(tresPlay)}</strong></span>
                      </div>
                      <p className={'' + secundario + ' mt-1 text-[11px]'}>AÑADIR TV: {formatoNumero.format(datosPdv.totales['AÑADIR TV'])} · se contabiliza por separado</p>
                    </>
                  )
                })()}
                {producto.nombre === 'BAF' && canal === 'call' && (
                  <>
                    <div className={'mt-3 flex h-3 overflow-hidden rounded ' + (oscuro ? 'bg-slate-700' : 'bg-gray-200')}>
                      <div style={{ width: porcentaje2 + '%', backgroundColor: '#2563eb' }} />
                      <div style={{ width: porcentaje3 + '%', backgroundColor: '#0d9488' }} />
                    </div>
                    <div className="mt-2 flex justify-between gap-2 text-xs">
                      <span>2PLAY <strong>{datos ? formatoNumero.format(b2) : '—'}</strong></span>
                      <span>3PLAY <strong>{datos ? formatoNumero.format(b3) : '—'}</strong></span>
                    </div>
                    <p className={'' + secundario + ' mt-1 text-[11px]'}>AÑADIR TV se contabiliza por separado</p>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {canal === 'todos' && bafTodosListo && (
          <div className={tarjeta + ' mb-4 rounded-xl border p-4'}>
            <h3 className={'font-bold ' + tituloSeccion}>BAF por origen comercial</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { nombre: 'Call Lucom · cargadas', valor: datos!.totales.cargadas },
                { nombre: 'Puntos de Venta · activadas', valor: datosPdv!.totales.total },
                { nombre: 'Total agencia · BAF', valor: datos!.totales.cargadas + datosPdv!.totales.total },
              ].map(item => (
                <div key={item.nombre} className={'rounded-lg border p-3 ' + borde}>
                  <p className={secundario + ' text-xs'}>{item.nombre}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{formatoNumero.format(item.valor)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {canal === 'pdv' && (
          <div className="space-y-4">
            <div className={tarjeta + ' rounded-xl border p-4'}>
              <h3 className={'font-bold ' + tituloSeccion}>Detalle por Punto de Venta · BAF</h3>
              <p className={secundario + ' mt-1 text-xs'}>Abrí un Punto de Venta para consultar el desglose por vendedor.</p>
              {datosPdv ? (
                <div className="mt-3 space-y-2">
                  <div className={secundario + ' grid grid-cols-[minmax(0,1fr)_repeat(4,minmax(44px,70px))] gap-1 px-2 text-right text-[10px]'}>
                    <span className="text-left">PDV / vendedor</span><span>2PLAY</span><span>3PLAY</span><span>Añadir TV</span><span>TOTAL</span>
                  </div>
                  {[...datosPdv.porPdv].sort((a,b) => b.totales.total - a.totales.total || a.punto_venta.localeCompare(b.punto_venta)).map(pdv => (
                    <details key={pdv.punto_venta_id} className={'rounded-lg border ' + borde}>
                      <summary className={'grid cursor-pointer grid-cols-[minmax(0,1fr)_repeat(4,minmax(44px,70px))] items-center gap-1 px-2 py-3 text-right text-xs font-semibold ' + (oscuro ? 'hover:bg-slate-600' : 'hover:bg-gray-50')}>
                        <span className="truncate text-left" title={pdv.punto_venta}>{pdv.punto_venta}</span>
                        {(['2PLAY', '3PLAY', 'AÑADIR TV', 'total'] as const).map(clave => <span key={clave} className="tabular-nums">{formatoNumero.format(pdv.totales[clave])}</span>)}
                      </summary>
                      <div className={'border-t ' + borde + ' ' + fondoSuave}>
                        {Object.entries(pdv.vendedores).sort((a,b) => b[1].total - a[1].total || a[0].localeCompare(b[0])).map(([nombre, totales]) => (
                          <div key={nombre} className={'grid grid-cols-[minmax(0,1fr)_repeat(4,minmax(44px,70px))] gap-1 border-b px-2 py-2 text-right text-xs last:border-0 ' + borde}>
                            <span className="truncate text-left" title={nombre}>{nombre}</span>
                            {(['2PLAY', '3PLAY', 'AÑADIR TV', 'total'] as const).map(clave => <span key={clave} className="tabular-nums">{formatoNumero.format(totales[clave])}</span>)}
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                  <div className={'grid grid-cols-[minmax(0,1fr)_repeat(4,minmax(44px,70px))] gap-1 border-t px-2 py-2 text-right text-xs font-bold ' + borde}>
                    <span className="text-left">TOTAL</span>
                    {(['2PLAY', '3PLAY', 'AÑADIR TV', 'total'] as const).map(clave => <span key={clave}>{formatoNumero.format(datosPdv.totales[clave])}</span>)}
                  </div>
                  {datosPdv.porPdv.length === 0 && <p className={secundario + ' py-4 text-sm'}>Sin ventas BAF en el período.</p>}
                </div>
              ) : <p className={secundario + ' mt-3 text-sm'}>{cargando ? 'Consultando Puntos de Venta...' : error ? 'No se pudieron cargar los datos.' : 'Sin datos disponibles.'}</p>}
            </div>
            <p className={secundario + ' text-xs'}>PORTA, Línea Nueva, CATER y 1175 de PDV: pendientes de integración.</p>
          </div>
        )}
        {canal === 'call' && (<>
        <div className="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
          <div className={'' + tarjeta + ' rounded-xl border p-4'}>
            <h3 className={'font-bold ' + tituloSeccion}>Evolución diaria · BAF Call Lucom</h3>
            <p className={'' + secundario + ' mt-1 text-xs'}>Cargadas por fecha de gestión; finalizadas y canceladas por fecha de cierre.</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {coloresDiarios.map(serie => (
                <span key={serie.clave} className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: serie.color }} />
                  {serie.nombre}
                </span>
              ))}
            </div>
            {datos && dias.length ? (
              <div className="mt-3 overflow-x-auto pb-2">
                <div className="flex h-48 items-end gap-1 border-b border-gray-300 pb-1" style={{ minWidth: Math.max(340, dias.length * 22) }}>
                  {dias.map(([fecha, valores]) => (
                    <div key={fecha} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={fecha + ' · Cargadas: ' + valores.cargadas + ' · Finalizadas: ' + valores.finalizadas + ' · Canceladas: ' + valores.canceladas}>
                      <div className="flex h-40 items-end justify-center gap-px">
                        {coloresDiarios.map(serie => (
                          <div key={serie.clave} className="min-w-0 flex-1 rounded-t-sm" style={{ height: (valores[serie.clave] / maximoDiario * 100) + '%', backgroundColor: serie.color }} />
                        ))}
                      </div>
                      <div className={'' + secundario + ' mt-1 text-center text-[10px] tabular-nums'}>{fecha.slice(8)}</div>
                    </div>
                  ))}
                </div>
                <p className={'' + secundario + ' mt-1 text-[11px]'}>Eje horizontal: día del mes. Pasá el cursor sobre las barras para ver los valores.</p>
              </div>
            ) : (
              <div className={'' + secundario + ' mt-3 flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-300 text-center text-sm'}>
                {cargando ? 'Consultando evolución diaria...' : datos ? 'Sin movimientos en el período.' : 'Seleccioná Call Lucom y un período.'}
              </div>
            )}
          </div>
          <div className={'' + tarjeta + ' rounded-xl border p-4'}>
            <h3 className={'font-bold ' + tituloSeccion}>Composición comercial BAF</h3>
            <p className={'' + secundario + ' mt-1 text-xs'}>Ventas cargadas · 2PLAY y 3PLAY. El resto se informa por separado.</p>
            {comparacion && datos ? (
              <div className="mt-4 space-y-5">
                {barras.map(barra => (
                  <div key={barra.nombre}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-semibold capitalize">{barra.nombre}</span>
                      <span className="font-bold tabular-nums">{formatoNumero.format(barra.total)}</span>
                    </div>
                    <div className={'h-9 overflow-hidden rounded-md ' + (oscuro ? 'bg-slate-700' : 'bg-gray-200')}>
                      <div className="flex h-full" style={{ width: (barra.total / maximo * 100) + '%' }}>
                        {barra.dos > 0 && <div className="flex h-full items-center justify-center overflow-hidden bg-[#2563eb] text-xs font-bold text-white" style={{ width: (barra.dos / barra.total * 100) + '%' }} title={'2PLAY: ' + barra.dos}>{barra.dos}</div>}
                        {barra.tres > 0 && <div className="flex h-full items-center justify-center overflow-hidden bg-[#0d9488] text-xs font-bold text-white" style={{ width: (barra.tres / barra.total * 100) + '%' }} title={'3PLAY: ' + barra.tres}>{barra.tres}</div>}
                      </div>
                    </div>
                    <div className={'' + secundario + ' mt-1 flex justify-between text-xs'}>
                      <span>2PLAY: {formatoNumero.format(barra.dos)}</span>
                      <span>3PLAY: {formatoNumero.format(barra.tres)}</span>
                    </div>
                  </div>
                ))}
                <div className={'flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs ' + borde}>
                  <span><span className="text-[#2563eb]">■</span> 2PLAY &nbsp; <span className="text-[#0d9488]">■</span> 3PLAY</span>
                  <span className="font-semibold">
                    Variación vs. mes anterior: {variacion === null ? 'Sin base comparable' : (variacion > 0 ? '+' : '') + variacion.toFixed(1) + '%'}
                  </span>
                </div>
              </div>
            ) : (
              <p className={'' + secundario + ' mt-5 text-sm'}>
                {cargando ? 'Consultando ambos períodos...' : periodo === 'hoy' || periodo === 'semana'
                  ? 'La comparación mensual está disponible en Mes en curso y Mes anterior.'
                  : 'Seleccioná un mes completo para comparar con el mes anterior.'}
              </p>
            )}
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
          <div className={'' + tarjeta + ' rounded-xl border p-4'}>
            <h3 className={'font-bold ' + tituloSeccion}>Estado de ventas · BAF Call Lucom</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {indicadores.map(indicador => (
                <div key={indicador.clave} className={'rounded-lg border p-3 text-center ' + borde}>
                  <div className={'' + secundario + ' text-xs'}>{indicador.titulo.replace('BAF ', '')}</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums">{canal === 'call' && datos ? formatoNumero.format(datos.totales[indicador.clave]) : '—'}</div>
                  {indicador.clave === 'canceladas' && canal === 'call' && datos && (
                    <div className="mt-1 text-xs font-semibold text-red-600">
                      {(datos.totales.finalizadas + datos.totales.canceladas) > 0
                        ? (datos.totales.canceladas / (datos.totales.canceladas + datos.totales.finalizadas) * 100).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '% de cancelación'
                        : 'Sin base para calcular'}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className={'' + secundario + ' mt-3 text-xs'}>Cada indicador utiliza su fecha comercial correspondiente.</p>
          </div>
          <div className={'' + tarjeta + ' rounded-xl border p-4'}>
            <h3 className={'font-bold ' + tituloSeccion}>Distribución comercial BAF · Cargadas</h3>
            <p className={'' + secundario + ' mt-1 text-xs'}>Participación de cada canal sobre las BAF cargadas del período.</p>
            {datos ? (
              <div className="mt-3 space-y-2">
                {canalesOrdenados.map(canalDetalle => (
                  <div key={canalDetalle.nombre} className="flex items-center gap-2 text-xs">
                    <span className="w-28 shrink-0 truncate" title={canalDetalle.nombre}>{canalDetalle.nombre}</span>
                    <div className={'h-3 flex-1 overflow-hidden rounded ' + (oscuro ? 'bg-slate-700' : 'bg-gray-100')}>
                      <div className="h-full rounded bg-[#2563eb]" style={{ width: (datos.totales.cargadas ? canalDetalle.totales.cargadas / datos.totales.cargadas * 100 : 0) + '%' }} />
                    </div>
                    <span className="w-10 text-right font-semibold tabular-nums">{formatoNumero.format(canalDetalle.totales.cargadas)}</span>
                  </div>
                ))}
                <p className={'' + secundario + ' pt-1 text-[11px]'}>{concilia ? 'Los canales comerciales y Sin clasificar concilian con el total BAF.' : 'Atención: revisar conciliación de canales.'}</p>
              </div>
            ) : <div className={'' + secundario + ' mt-3 p-5 text-center text-sm'}>Sin datos del período.</div>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <div className={'' + tarjeta + ' rounded-xl border p-4'}>
            <h3 className={'font-bold ' + tituloSeccion}>Detalle por canales comerciales · BAF</h3>
            <p className={'' + secundario + ' mt-1 text-xs'}>Abrí cada canal para consultar sus vendedores. Referidos incluye N1, C1, T1, P1, J1, F1, B1 y el histórico R1.</p>
            {datos && canalesOrdenados.length ? (
              <div className="mt-3 space-y-2">
                <div className={'' + secundario + ' grid grid-cols-[minmax(0,1fr)_repeat(4,minmax(48px,65px))] gap-1 px-2 text-right text-[10px]'}>
                  <span className="text-left">Canal / vendedor</span>
                  <span>Ingresadas</span><span>Cargadas</span><span>Finalizadas</span><span>Canceladas</span>
                </div>
                {canalesOrdenados.map(canalDetalle => (
                  <details key={canalDetalle.nombre} className={'rounded-lg border ' + borde}>
                    <summary className={'grid cursor-pointer grid-cols-[minmax(0,1fr)_repeat(4,minmax(48px,65px))] items-center gap-1 px-2 py-3 text-right text-xs font-semibold ' + (oscuro ? 'hover:bg-slate-600' : 'hover:bg-gray-50')}>
                      <span className="truncate text-left">{canalDetalle.nombre}</span>
                      {indicadores.map(indicador => <span key={indicador.clave} className="tabular-nums">{formatoNumero.format(canalDetalle.totales[indicador.clave])}</span>)}
                    </summary>
                    <div className={'border-t ' + borde + ' ' + fondoSuave}>
                      {Object.entries(canalDetalle.vendedores).sort((a, b) => b[1].cargadas - a[1].cargadas || a[0].localeCompare(b[0])).map(([nombre, totales]) => (
                        <div key={nombre} className={'grid grid-cols-[minmax(0,1fr)_repeat(4,minmax(48px,65px))] items-center gap-1 border-b px-2 py-2 text-right text-xs last:border-0 ' + borde}>
                          <span className="truncate text-left" title={nombre}>{nombre}</span>
                          {indicadores.map(indicador => <span key={indicador.clave} className="tabular-nums">{formatoNumero.format(totales[indicador.clave])}</span>)}
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
                <div className={'grid grid-cols-[minmax(0,1fr)_repeat(4,minmax(48px,65px))] gap-1 border-t px-2 py-2 text-right text-xs font-bold ' + borde}>
                  <span className="text-left">TOTAL</span>
                  {indicadores.map(indicador => <span key={indicador.clave} className="tabular-nums">{formatoNumero.format(totalCanales[indicador.clave])}</span>)}
                </div>
                <p className={'' + secundario + ' text-[11px]'}>{concilia ? 'Conciliado con indicadores generales.' : 'Diferencia detectada: revisar los canales.'}</p>
              </div>
            ) : (
              <div className={'' + secundario + ' mt-3 rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm'}>
                {cargando ? 'Consultando canales...' : datos ? 'Sin ventas en el período.' : 'Seleccioná Call Lucom y un período.'}
              </div>
            )}
          </div>
          <div className={'' + tarjeta + ' rounded-xl border p-4'}>
            <h3 className={'font-bold ' + tituloSeccion}>Detalle Planes Porta - LN</h3>
            <p className={'' + secundario + ' mt-1 text-xs'}>Ventas con Estado BBOO CARGADO STL, por Fecha Carga STL. MASIVO y PYME consolidados. FWA excluido.</p>
            {errorPlanes ? (
              <p className="mt-3 rounded-lg border border-red-200 p-4 text-sm text-red-600">{errorPlanes}</p>
            ) : detallePlanes ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={'border-b text-left text-xs ' + borde}>
                      <th className="py-2 pr-2">Plan</th>
                      <th className="px-2 py-2 text-right">PORTA</th>
                      <th className="px-2 py-2 text-right">LN</th>
                      <th className="py-2 pl-2 text-right">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detallePlanes.planes.map(fila => (
                      <tr key={fila.plan} className={'border-b ' + (oscuro ? 'border-slate-700' : 'border-gray-200/70')}>
                        <td className="py-2 pr-2">{fila.plan}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatoNumero.format(fila.porta)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatoNumero.format(fila.ln)}</td>
                        <td className="py-2 pl-2 text-right font-semibold tabular-nums">{formatoNumero.format(fila.porta + fila.ln)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold">
                      <td className="pt-3 pr-2">TOTAL</td>
                      <td className="px-2 pt-3 text-right tabular-nums">{formatoNumero.format(detallePlanes.totales.porta)}</td>
                      <td className="px-2 pt-3 text-right tabular-nums">{formatoNumero.format(detallePlanes.totales.ln)}</td>
                      <td className="pt-3 pl-2 text-right tabular-nums">{formatoNumero.format(detallePlanes.totales.porta + detallePlanes.totales.ln)}</td>
                    </tr>
                  </tfoot>
                </table>
                {detallePlanes.planes.length === 0 && <p className={'' + secundario + ' py-4 text-center text-xs'}>Sin ventas cargadas en el período.</p>}
              </div>
            ) : (
              <div className={'' + secundario + ' mt-3 rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm'}>
                {canal === 'call' ? 'Consultando detalle de planes...' : 'Seleccioná Call Lucom para consultar el detalle.'}
              </div>
            )}
          </div>
        </div>
        </>)}
        <p className={'' + secundario + ' mt-4 text-xs'}>Dashboard en desarrollo. Los datos visibles corresponden a consultas reales de BAF; los módulos pendientes no muestran cifras simuladas.</p>
      </div>
    </section>
  )
}
