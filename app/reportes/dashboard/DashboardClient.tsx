'use client'

import { useEffect, useState } from 'react'
import DashboardGestionClient from './DashboardGestionClient'
import DashboardObjetivos from './DashboardObjetivos'

type TotalesPdv = { '2PLAY': number; '3PLAY': number; 'AÑADIR TV': number; total: number }
type RespuestaPdv = {
  desde: string
  hasta: string
  totales: TotalesPdv
  porPdv: { punto_venta_id: string; punto_venta: string; totales: TotalesPdv; vendedores: Record<string, TotalesPdv> }[]
  diarios: Record<string, TotalesPdv>
}
type RespuestaMovilPdv = {
  desde: string
  hasta: string
  totales: { total_movil: number; porta: number; ln: number; fwa: number }
  porPdv: { punto_venta_id: string; punto_venta: string; total_movil: number; porta: number; ln: number; fwa: number }[]
  inconsistencias: { punto_venta_id: string; punto_venta: string; total_movil: number; porta: number; ln: number; fwa: number }[]
}
type RespuestaR3 = {
  desde: string
  hasta: string
  total: number
  porPdv: { punto_venta_id: string; punto_venta: string; total: number }[]
  diarios: Record<string, number>
}
type RespuestaCater = {
  desde: string
  hasta: string
  total: number
  porPdv: { punto_venta_id: string; punto_venta: string; total: number; vendedores: Record<string, number> }[]
  diarios: Record<string, number>
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
  diarios: Record<string, Record<string, { porta: number; ln: number }>>
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
const coloresPlanes: Record<string, string> = {
  '2 GB': '#64748b',
  '4 GB': '#2563eb',
  '7 GB': '#0d9488',
  '10 GB': '#eab308',
  '30 GB': '#9333ea',
  '50 GB': '#e11d48',
}
const coloresAlternativos = ['#ea580c', '#0891b2', '#db2777', '#65a30d', '#7c3aed', '#0f766e', '#ca8a04', '#475569']

function colorPlan(plan: string): string {
  if (coloresPlanes[plan]) return coloresPlanes[plan]
  let codigo = 0
  for (const letra of plan) codigo = (codigo * 31 + letra.charCodeAt(0)) >>> 0
  return coloresAlternativos[codigo % coloresAlternativos.length]
}

function diasEnRango(desde: string, hasta: string): string[] {
  const fechas: string[] = []
  const inicio = new Date(desde + 'T12:00:00Z')
  const fin = new Date(hasta + 'T12:00:00Z')
  if (Number.isNaN(inicio.valueOf()) || Number.isNaN(fin.valueOf())) return fechas
  for (let tiempo = inicio.getTime(); tiempo <= fin.getTime() && fechas.length < 366; tiempo += 86400000) {
    fechas.push(new Date(tiempo).toISOString().slice(0, 10))
  }
  return fechas
}

function ComposicionMovil({ detalle, negocio, fondo }: {
  detalle: DetallePlanes; negocio: 'porta' | 'ln'; fondo: string
}) {
  const total = detalle.totales[negocio]
  const planes = detalle.planes.filter(p => p[negocio] > 0)
  if (!total) return <p className="mt-3 text-[11px] opacity-60">Sin planes para representar</p>
  return (
    <>
      <div className={'mt-3 flex h-3 overflow-hidden rounded ' + fondo} aria-label={'Composición por plan de ' + (negocio === 'porta' ? 'PORTA' : 'Línea Nueva')}>
        {planes.map(p => <div key={p.plan}
          style={{ width: (p[negocio] / total * 100) + '%', backgroundColor: colorPlan(p.plan) }}
          title={p.plan + ': ' + formatoNumero.format(p[negocio]) + ' (' + (p[negocio] / total * 100).toFixed(1) + '%)'}
        />)}
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-2 gap-y-1">
        {planes.map(p => <span key={p.plan} className="inline-flex items-center gap-1 text-[10px]" title={p.plan + ': ' + p[negocio] + ' ventas'}>
          <i className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: colorPlan(p.plan) }} />
          {p.plan} <strong>{formatoNumero.format(p[negocio])}</strong>
        </span>)}
      </div>
    </>
  )
}

function EvolucionMovil({ detalle, negocio, oscuro }: {
  detalle: DetallePlanes; negocio: 'porta' | 'ln'; oscuro: boolean
}) {
  const [ocultos, setOcultos] = useState<string[]>([])
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null)
  const fechas = diasEnRango(detalle.desde, detalle.hasta)
  const planes = detalle.planes.filter(p => p[negocio] > 0)
  const visibles = planes.filter(p => !ocultos.includes(p.plan))
  const maximo = Math.max(1, ...fechas.flatMap(fecha => visibles.map(plan => detalle.diarios?.[fecha]?.[plan.plan]?.[negocio] ?? 0)))
  const alto = 200
  const ancho = 640
  const margenIzq = 40
  const margenDer = 14
  const margenArriba = 12
  const margenAbajo = 30
  const graficoAncho = ancho - margenIzq - margenDer
  const graficoAlto = alto - margenArriba - margenAbajo
  const x = (i: number) => margenIzq + (fechas.length <= 1 ? graficoAncho / 2 : i * graficoAncho / (fechas.length - 1))
  const y = (valor: number) => margenArriba + graficoAlto * (1 - valor / maximo)
  const ticks = [0, 1, 2, 3, 4].map(i => Math.round(maximo * i / 4))
  const seleccionado = diaSeleccionado && fechas.includes(diaSeleccionado) ? diaSeleccionado : null
  return (
    <div className="min-w-0">
      <h3 className={'font-bold ' + (oscuro ? 'text-sky-300' : 'text-[#1b5594]')}>{negocio === 'porta' ? 'PORTA' : 'Línea Nueva'} · Evolución diaria por plan</h3>
      <p className={'mt-1 text-xs ' + (oscuro ? 'text-slate-300' : 'text-gray-500')}>CARGADO STL · Fecha Carga STL · Hacé clic en la leyenda para mostrar u ocultar planes.</p>
      {fechas.length && planes.length ? (
        <>
          <svg viewBox={`0 0 ${ancho} ${alto}`} className="mt-3 w-full" role="img" aria-label={'Gráfico de líneas de ' + (negocio === 'porta' ? 'PORTA' : 'Línea Nueva') + ' por día y plan'}>
            {ticks.map((valor, i) => <g key={i}>
              <line x1={margenIzq} y1={y(valor)} x2={ancho - margenDer} y2={y(valor)} stroke="currentColor" strokeOpacity="0.14" />
              <text x={margenIzq - 8} y={y(valor) + 4} textAnchor="end" fontSize="11" fill="currentColor">{valor}</text>
            </g>)}
            {fechas.map((fecha, i) => (i === 0 || i === fechas.length - 1 || i % Math.max(1, Math.ceil(fechas.length / 7)) === 0) &&
              <text key={fecha} x={x(i)} y={alto - 8} textAnchor="middle" fontSize="10" fill="currentColor">{fecha.slice(8)}</text>)}
            {visibles.map(plan => {
              const puntos = fechas.map((fecha, i) => x(i) + ',' + y(detalle.diarios?.[fecha]?.[plan.plan]?.[negocio] ?? 0)).join(' ')
              return <g key={plan.plan}>
                {fechas.length > 1 && <polyline points={puntos} fill="none" stroke={colorPlan(plan.plan)} strokeWidth="2.8" strokeLinejoin="round" strokeLinecap="round" />}
                {fechas.length === 1 && <circle cx={x(0)} cy={y(detalle.diarios?.[fechas[0]]?.[plan.plan]?.[negocio] ?? 0)} r="4" fill={colorPlan(plan.plan)} />}
              </g>
            })}
            {seleccionado && <line x1={x(fechas.indexOf(seleccionado))} x2={x(fechas.indexOf(seleccionado))} y1={margenArriba} y2={alto-margenAbajo} stroke="currentColor" strokeDasharray="4 4" opacity="0.45" />}
            {fechas.map((fecha, i) => <rect key={fecha} x={x(i) - graficoAncho / Math.max(fechas.length, 2) / 2} y={margenArriba} width={graficoAncho / Math.max(fechas.length, 2)} height={graficoAlto} fill="transparent" onMouseEnter={() => setDiaSeleccionado(fecha)} onClick={() => setDiaSeleccionado(fecha)}><title>{fecha + ': ' + visibles.map(p => p.plan + ' ' + (detalle.diarios?.[fecha]?.[p.plan]?.[negocio] ?? 0)).join(', ')}</title></rect>)}
          </svg>
          {seleccionado && <p className={'mt-1 text-xs ' + (oscuro ? 'text-slate-300' : 'text-gray-600')}>{seleccionado.slice(8, 10)}/{seleccionado.slice(5, 7)}: {visibles.map(p => p.plan + ' ' + (detalle.diarios?.[seleccionado]?.[p.plan]?.[negocio] ?? 0)).join(' · ') || 'Sin planes visibles'}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {planes.map(p => <button key={p.plan} type="button" onClick={() => setOcultos(actual => actual.includes(p.plan) ? actual.filter(n => n !== p.plan) : [...actual, p.plan])}
              aria-pressed={!ocultos.includes(p.plan)}
              className={'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ' + (oscuro ? 'border-slate-600' : 'border-gray-200') + (ocultos.includes(p.plan) ? ' opacity-40' : '')}>
              <span className="inline-block h-1 w-4 rounded" style={{ backgroundColor: colorPlan(p.plan) }} />
              {p.plan} ({formatoNumero.format(p[negocio])})
            </button>)}
          </div>
        </>
      ) : <p className={'mt-4 text-sm ' + (oscuro ? 'text-slate-300' : 'text-gray-500')}>No hay datos para el período.</p>}
    </div>
  )
}


function hoyArgentina(): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).formatToParts(new Date())
  const tomar = (tipo: string) => partes.find(p => p.type === tipo)?.value ?? ''
  return `${tomar('year')}-${tomar('month')}-${tomar('day')}`
}
function MedidorInstrumental({ actual, anterior, color, oscuro }: {
  actual: number | null
  anterior: number | null
  color: string
  oscuro: boolean
}) {
  const comparable = actual !== null && anterior !== null
    && anterior >= 0 && actual >= 0

  const maximo = Math.max(actual ?? 0, anterior ?? 0, 1)

  const proporcion = comparable
    ? anterior / maximo * 100
    : 0

  const anguloAnterior = Math.PI * (anterior ?? 0) / maximo

  return (
    <svg
      viewBox="0 0 160 94"
      className="mx-auto w-full max-w-[180px]"
      role="img"
      aria-label={'Valor actual: ' + (actual ?? 'No disponible')
        + '. Anterior: ' + (anterior ?? 'No disponible')}
    >
      <path
        d="M16 80 A64 64 0 0 1 144 80"
        fill="none"
        stroke={oscuro ? '#334155' : '#e5e7eb'}
        strokeWidth="10"
        strokeLinecap="round"
      />
      {comparable && proporcion > 0 && (
        <path
          d="M16 80 A64 64 0 0 1 144 80"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={proporcion + ' 100'}
        />
      )}
      {comparable && anterior > 0 && (
        <g transform={
          'translate('
          + (80 - 64 * Math.cos(anguloAnterior)) + ' '
          + (80 - 64 * Math.sin(anguloAnterior)) + ') rotate('
          + (anguloAnterior * 180 / Math.PI - 90) + ')'
        }>
          <path
            d="M-8 -10 L10 0 L-8 10 Z"
            fill={color}
            strokeLinejoin="round"
          />
        </g>
      )}
      <text
        x="80" y="64"
        textAnchor="middle"
        fontSize="34"
        fontWeight="700"
        fill="currentColor"
      >
        {actual === null ? '—' : formatoNumero.format(actual)}
      </text>
      <text
        x="80" y="82"
        textAnchor="middle"
        fontSize="11"
        fill={oscuro ? '#94a3b8' : '#64748b'}
      >
        {anterior !== null
          ? 'Ant. ' + formatoNumero.format(anterior)
          : 'Sin comparación'}
      </text>
    </svg>
  )
}

function IconoNegocio({ nombre }: { nombre: string }) {
  const trazos: Record<string, string> = {
    'BAF': 'M2 8a16 16 0 0 1 20 0 M5 12a11 11 0 0 1 14 0 M8 16a6 6 0 0 1 8 0 M12 20h.01',
    'PORTA': 'M3 3h5l2 5-3 2a15 15 0 0 0 7 7l2-3 5 2v5C11 22 2 13 3 3 M15 3h6v6 M21 3l-7 7',
    'LÍNEA NUEVA': 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2 M10 18h4 M12 7v6 M9 10h6',
    'FWA': 'M12 10v12 M8 22h8 M9 13l3-3 3 3 M8 5a6 6 0 0 0 0 8 M16 5a6 6 0 0 1 0 8 M4 2a10 10 0 0 0 0 14 M20 2a10 10 0 0 1 0 14',
    'CATER / EQUIPOS': 'M3 3h13v18H3z M7 17h5 M19 7h3v14h-3 M19 18h3',
    '1175': 'M8 5h13 M8 12h13 M8 19h13 M2 5l1 1 2-3 M2 12l1 1 2-3 M2 19l1 1 2-3',
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6 shrink-0"
      aria-hidden="true"
    >
      <path d={trazos[nombre] ?? ''} />
    </svg>
  )
}

function mesAnterior(desde: string, dia?: number) {
  const [anio, mes] = desde.split('-').map(Number)
  const inicio = new Date(Date.UTC(anio, mes - 2, 1))
  const ultimoDia = new Date(Date.UTC(anio, mes - 1, 0)).getUTCDate()
  const fin = new Date(Date.UTC(
    anio, mes - 2,
    dia === undefined ? ultimoDia : Math.min(dia, ultimoDia)
  ))
  return {
    desde: inicio.toISOString().slice(0, 10),
    hasta: fin.toISOString().slice(0, 10)
  }
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

export default function DashboardClient({ puedeVerTodos, puedeVerGestion }: {
  puedeVerTodos: boolean
  puedeVerGestion: boolean
}) {
  const [vistaDashboard, setVistaDashboard] = useState<'agencia' | 'call'>('agencia')
  const [mostrarObjetivos, setMostrarObjetivos] = useState(false)
  const [versionObjetivos, setVersionObjetivos] = useState(0)
  const [tema, setTema] = useState<Tema>('ejecutivo')
  const [temaVisual, setTemaVisual] = useState<'clasico' | 'ejecutivo' | 'instrumental'>('clasico')

  useEffect(() => {
    const guardado = localStorage.getItem('pgl-dashboard-tema-visual')
    if (guardado === 'clasico' || guardado === 'ejecutivo' || guardado === 'instrumental') {
      setTemaVisual(guardado)
    }
  }, [])
  const [periodo, setPeriodo] = useState('mes')
  const [fechaInicio, setFechaInicio] = useState(() => hoyArgentina().slice(0, 7) + '-01')
  const [fechaFinal, setFechaFinal] = useState(() => hoyArgentina())
  const [canal, setCanal] = useState('call')
  const [vistaPdv, setVistaPdv] = useState<'comparativo' | 'ranking'>('comparativo')
  const [r3, setR3] = useState<RespuestaR3 | null>(null)
  const [errorR3, setErrorR3] = useState('')
  const [cater, setCater] = useState<RespuestaCater | null>(null)
  const [errorCater, setErrorCater] = useState('')
  const [datosPdv, setDatosPdv] = useState<RespuestaPdv | null>(null)
  const [movilPdv, setMovilPdv] = useState<RespuestaMovilPdv | null>(null)
  const [datos, setDatos] = useState<Respuesta | null>(null)
  const [comparacion, setComparacion] = useState<Respuesta | null>(null)
  const [comparacionComercial, setComparacionComercial] = useState<{
    baf: number | null
    porta: number | null
    ln: number | null
    desde: string
    hasta: string
  } | null>(null)
  const [errorComparacion, setErrorComparacion] = useState('')
  const [detallePlanes, setDetallePlanes] = useState<DetallePlanes | null>(null)
  const [errorPlanes, setErrorPlanes] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setCater(null)
    setErrorCater('')
    if (!puedeVerTodos || (canal !== 'pdv' && canal !== 'todos')) return
    const { desde, hasta } = periodo === 'personalizado'
      ? { desde: fechaInicio, hasta: fechaFinal }
      : rangoPeriodo(periodo)
    if (!desde || !hasta || desde > hasta) return
    const controlador = new AbortController()
    fetch(`/api/dashboard/cater-pdv?desde=${desde}&hasta=${hasta}`, {
      signal: controlador.signal, cache: 'no-store',
    }).then(async respuesta => {
      const json = await respuesta.json()
      if (!respuesta.ok) throw new Error(json.error || 'Error al consultar CATER.')
      if (!controlador.signal.aborted) setCater(json as RespuestaCater)
    }).catch((err: unknown) => {
      if (!controlador.signal.aborted) setErrorCater(err instanceof Error ? err.message : 'Error al consultar CATER.')
    })
    return () => controlador.abort()
  }, [periodo, fechaInicio, fechaFinal, canal, puedeVerTodos])

  useEffect(() => {
    setR3(null)
    setErrorR3('')
    if (!puedeVerTodos || (canal !== 'pdv' && canal !== 'todos')) return
    const { desde, hasta } = periodo === 'personalizado'
      ? { desde: fechaInicio, hasta: fechaFinal }
      : rangoPeriodo(periodo)
    if (!desde || !hasta || desde > hasta) return
    const controlador = new AbortController()
    fetch(`/api/dashboard/1175-pdv?desde=${desde}&hasta=${hasta}`, {
      signal: controlador.signal, cache: 'no-store',
    }).then(async respuesta => {
      const json = await respuesta.json()
      if (!respuesta.ok) throw new Error(json.error || 'Error al consultar 1175.')
      if (!controlador.signal.aborted) setR3(json as RespuestaR3)
    }).catch((err: unknown) => {
      if (!controlador.signal.aborted) setErrorR3(err instanceof Error ? err.message : 'Error al consultar 1175.')
    })
    return () => controlador.abort()
  }, [periodo, fechaInicio, fechaFinal, canal, puedeVerTodos])

  useEffect(() => {
    if (canal === 'todos' && !puedeVerTodos) {
      setError('No tenés permisos para consultar todos los canales.')
      setDatosPdv(null)
      setMovilPdv(null)
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
    setMovilPdv(null)
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
        const consultaMovil = fetch(`/api/dashboard/movil-pdv?desde=${desde}&hasta=${hasta}`, {
          signal: controlador.signal, cache: 'no-store',
        }).then(async respuesta => {
          const json = await respuesta.json()
          if (!respuesta.ok) throw new Error(json.error || 'No se pudieron recuperar los móviles de PDV.')
          return json as RespuestaMovilPdv
        })
        Promise.allSettled([consultaPdv, consultaMovil])
          .then(([baf, movil]) => {
            if (controlador.signal.aborted) return
            if (baf.status === 'fulfilled') setDatosPdv(baf.value)
            if (movil.status === 'fulfilled') setMovilPdv(movil.value)
            const errores = [baf, movil]
              .filter((resultado): resultado is PromiseRejectedResult => resultado.status === 'rejected')
              .map(resultado => resultado.reason instanceof Error ? resultado.reason.message : 'Error al consultar PDV.')
            if (errores.length) setError(errores.join(' · '))
          })
          .finally(() => { if (!controlador.signal.aborted) setCargando(false) })
        return () => controlador.abort()
      }
      const consultaMovilPdv = fetch(`/api/dashboard/movil-pdv?desde=${desde}&hasta=${hasta}`, {signal: controlador.signal, cache: 'no-store'}).then(async respuesta => {
        const json = await respuesta.json()
        if (!respuesta.ok) throw new Error(json.error || 'Error al consultar móviles PDV.')
        return json as RespuestaMovilPdv
      })
      const consultaMovilCall = fetch(`/api/dashboard/planes-movil?desde=${desde}&hasta=${hasta}`, {signal: controlador.signal, cache: 'no-store'}).then(async respuesta => {
        const json = await respuesta.json()
        if (!respuesta.ok) throw new Error(json.error || 'Error al consultar móviles Call.')
        return json as DetallePlanes
      })
      Promise.all([consultaMovilPdv, consultaMovilCall])
        .then(([pdv, call]) => {
          if (!controlador.signal.aborted) {
            setMovilPdv(pdv)
            setDetallePlanes(call)
          }
        })
        .catch((err: unknown) => {
          if (!controlador.signal.aborted) setErrorPlanes(err instanceof Error ? err.message : 'Error al consolidar móviles.')
        })
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
    consultar(desde, hasta)
      .then(actual => {
        if (!controlador.signal.aborted) {
          setDatos(actual)
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

  useEffect(() => {
    setComparacion(null)
    setComparacionComercial(null)
    setErrorComparacion('')

    if (periodo !== 'mes' && periodo !== 'anterior') return
    if (canal !== 'call' && !puedeVerTodos) return

    const { desde, hasta } = rangoPeriodo(periodo)
    const anterior = mesAnterior(
      desde,
      periodo === 'mes' ? Number(hasta.slice(-2)) : undefined
    )
    const controlador = new AbortController()

    async function consultar<T>(ruta: string): Promise<T> {
      const respuesta = await fetch(
        `/api/dashboard/${ruta}?desde=${anterior.desde}&hasta=${anterior.hasta}`,
        { signal: controlador.signal, cache: 'no-store' }
      )
      if (!respuesta.ok) throw new Error('Error al consultar ' + ruta)
      return respuesta.json() as Promise<T>
    }

    Promise.allSettled([
      canal !== 'pdv' ? consultar<Respuesta>('baf') : Promise.resolve(null),
      canal !== 'call' ? consultar<RespuestaPdv>('baf-pdv') : Promise.resolve(null),
      canal !== 'pdv' ? consultar<DetallePlanes>('planes-movil') : Promise.resolve(null),
      canal !== 'call' ? consultar<RespuestaMovilPdv>('movil-pdv') : Promise.resolve(null),
    ]).then(([bc, bp, mc, mp]) => {
      if (controlador.signal.aborted) return

      const bafCall = bc.status === 'fulfilled' ? bc.value : null
      const bafPdv = bp.status === 'fulfilled' ? bp.value : null
      const movilCall = mc.status === 'fulfilled' ? mc.value : null
      const movilPdv = mp.status === 'fulfilled' ? mp.value : null

      const bafListo =
        (canal === 'pdv' || !!bafCall) &&
        (canal === 'call' || !!bafPdv)

      const movilListo =
        (canal === 'pdv' || !!movilCall) &&
        (canal === 'call' || !!movilPdv)

      setComparacion(bafCall)

      setComparacionComercial({
        baf: bafListo
          ? (bafCall?.totales.cargadas ?? 0) + (bafPdv?.totales.total ?? 0)
          : null,
        porta: movilListo
          ? (movilCall?.totales.porta ?? 0) + (movilPdv?.totales.porta ?? 0)
          : null,
        ln: movilListo
          ? (movilCall?.totales.ln ?? 0) + (movilPdv?.totales.ln ?? 0)
          : null,
        desde: anterior.desde,
        hasta: anterior.hasta,
      })

      if (!bafListo || !movilListo) {
        setErrorComparacion('Comparacion historica parcialmente no disponible.')
      }
    })

    return () => controlador.abort()
  }, [periodo, canal, puedeVerTodos])

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
    { nombre: 'CATER / EQUIPOS', icono: '▣', color: 'bg-[#008c84]', activo: true },
    { nombre: '1175', icono: '▤', color: 'bg-[#657b24]', activo: true },
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
  function valorComercialActual(nombre: string): number | null {
    if (nombre === 'BAF') {
      if (canal === 'todos') {
        return datos && datosPdv
          ? datos.totales.cargadas + datosPdv.totales.total
          : null
      }
      return canal === 'pdv'
        ? datosPdv?.totales.total ?? null
        : datos?.totales.cargadas ?? null
    }

    const clave = nombre === 'PORTA' ? 'porta'
      : nombre === 'LÍNEA NUEVA' ? 'ln' : null

    if (!clave) return null

    if (canal === 'todos') {
      return detallePlanes && movilPdv
        ? detallePlanes.totales[clave] + movilPdv.totales[clave]
        : null
    }

    return canal === 'pdv'
      ? movilPdv?.totales[clave] ?? null
      : detallePlanes?.totales[clave] ?? null
  }

  function valorComercialAnterior(nombre: string): number | null {
    if (!comparacionComercial) return null
    if (nombre === 'BAF') return comparacionComercial.baf
    if (nombre === 'PORTA') return comparacionComercial.porta
    if (nombre === 'LÍNEA NUEVA') return comparacionComercial.ln
    return null
  }

  const barras = [
    { nombre: comparacion ? etiquetaMes(comparacion.desde) : 'Mes anterior', dos: previo2, tres: previo3, total: totalPrevio },
    { nombre: datos ? etiquetaMes(datos.desde) : 'Mes seleccionado', dos: b2, tres: b3, total: sumaPlay },
  ]

  return (
    <section className={'' + fondo + (oscuro ? ' border-slate-700' : ' border-gray-200') + ' overflow-hidden rounded-2xl border'}>
      <header className="flex flex-wrap items-center justify-between gap-4 bg-[#17457e] px-5 py-5 text-white sm:px-7">
        <div className="flex items-center gap-5">
          <div className="border-r border-blue-300/50 pr-5 text-2xl font-black italic tracking-tight">Lucom</div>
          <div>
            <h2 className="text-2xl font-bold leading-tight">
              {vistaDashboard === 'agencia' ? 'Ventas y Activaciones' : 'Gestión de Ventas'}
            </h2>
            <p className="text-sm text-blue-100">
              {vistaDashboard === 'agencia' ? 'Call Lucom + Puntos de Venta' : 'Call Lucom'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {vistaDashboard === 'call' && puedeVerGestion && (
              <button
                type="button"
                onClick={() => setMostrarObjetivos(true)}
                className="rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                ◎ Objetivos
              </button>
            )}

            <button
            type="button"
            onClick={() => setTema(actual => actual === 'oscuro' ? 'ejecutivo' : 'oscuro')}
            aria-label={oscuro ? 'Activar modo claro' : 'Activar modo oscuro'}
            aria-pressed={oscuro}
            className="rounded-lg border border-blue-200/50 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            {oscuro ? '☀ Modo claro' : '☾ Modo oscuro'}
          </button>
          {puedeVerGestion && (
            <select
              aria-label="Seleccionar Dashboard"
              value={vistaDashboard}
              onChange={e => setVistaDashboard(e.target.value === 'call' ? 'call' : 'agencia')}
              className="rounded-lg border border-blue-200/50 bg-[#17457e] px-3 py-2 text-sm font-semibold text-white outline-none"
            >
              <option value="agencia">Agencia</option>
              <option value="call">Call Lucom</option>
            </select>
          )}
          <div className="text-right text-xs text-blue-100">
          <div>Origen de información</div>
          <div className="mt-1 font-semibold text-white">PGL · datos en consulta</div>
          {vistaDashboard === 'agencia' && (
            <div className="text-blue-200">Claro · reportes importados</div>
          )}
          </div>
        </div>
      </header>

      {mostrarObjetivos && puedeVerGestion && (
        <DashboardObjetivos
          oscuro={oscuro}
          onCerrar={() => setMostrarObjetivos(false)}
          onGuardado={() => setVersionObjetivos(v => v + 1)}
        />
      )}


      {vistaDashboard === 'call' && puedeVerGestion && (
        <DashboardGestionClient
          oscuro={oscuro}
          versionObjetivos={versionObjetivos}
        />
      )}

      <div className={vistaDashboard === 'call' ? 'hidden' : 'p-4 sm:p-5'}>
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
            Tema visual
            <select
              value={temaVisual}
              onChange={e => {
                const nuevo = e.target.value as 'clasico' | 'ejecutivo' | 'instrumental'
                setTemaVisual(nuevo)
                localStorage.setItem('pgl-dashboard-tema-visual', nuevo)
              }}
              className={control + ' rounded-lg border px-3 py-2 font-normal'}
            >
              <option value="clasico">Clásico</option>
              <option value="ejecutivo">Ejecutivo</option>
              <option value="instrumental">Instrumental</option>
            </select>
          </label>
        </div>

        {canal === 'todos' && <p className={'' + tarjeta + ' mb-4 rounded-xl border p-4 text-sm'}>BAF, PORTA, Línea Nueva y FWA consolidados: Call Lucom (cargadas) + Puntos de Venta (activaciones). CATER y 1175: exclusivamente PDV.</p>}
        {canal === 'todos' && errorPlanes && <p role="alert" className="mb-4 text-sm font-semibold text-red-600">{errorPlanes}</p>}
        {error && <p role="alert" className="mb-4 text-sm font-semibold text-red-600">{error}</p>}
        {cargando && <p className={'' + secundario + ' mb-4 text-sm'}>Consultando indicadores BAF...</p>}

        {/* Tarjetas comunes Call y PDV */}
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {productos.map(producto => (
            <div key={producto.nombre}
              className={tarjeta + ' relative overflow-hidden rounded-xl border shadow-sm ' +
                (temaVisual === 'ejecutivo' ? 'pb-1' : '')}>
              {temaVisual === 'ejecutivo' && (
                <div className={producto.color + ' absolute inset-x-0 bottom-0 h-1'} />
              )}
              <div className={'flex items-center justify-between gap-2 px-3 py-2 font-bold ' +
                (temaVisual === 'clasico' ? producto.color + ' text-white' : '')}>
                {temaVisual === 'clasico' ? (
                  <IconoNegocio nombre={producto.nombre} />
                ) : (
                  <span className={producto.color + ' inline-flex rounded-lg p-1.5 text-white'}>
                    <IconoNegocio nombre={producto.nombre} />
                  </span>
                )}
                <span className="text-sm">{producto.nombre}</span>
              </div>
              <div className="px-3 py-2 text-center">
                {['BAF', 'PORTA', 'LÍNEA NUEVA'].includes(producto.nombre)
                  && (periodo === 'mes' || periodo === 'anterior') ? (() => {
                    const actual = valorComercialActual(producto.nombre)
                    const anterior = valorComercialAnterior(producto.nombre)
                    const variacion = actual !== null && anterior !== null && anterior > 0
                      ? (actual - anterior) / anterior * 100
                      : null

                    return (
                      <div>
                        {temaVisual === 'instrumental' ? (
                          <>
                            <MedidorInstrumental
                              actual={actual}
                              anterior={anterior}
                              color={producto.color.slice(4, -1)}
                              oscuro={oscuro}
                            />
                            <div className={'text-xs font-semibold ' + (
                              variacion === null || variacion === 0 ? secundario
                              : variacion > 0 ? 'text-emerald-500' : 'text-red-500'
                            )}>
                              {variacion === null
                                ? 'Sin base comparable'
                                : (variacion > 0 ? '▲ +' : variacion < 0 ? '▼ ' : '— ')
                                  + variacion.toLocaleString('es-AR', {
                                    minimumFractionDigits: 1,
                                    maximumFractionDigits: 1
                                  }) + '%'}
                            </div>
                          </>
                        ) : (
                        <div className="flex items-center justify-between gap-2 px-1">
                          <div className="text-4xl font-bold tracking-tight tabular-nums">
                            {actual === null ? '—' : formatoNumero.format(actual)}
                          </div>
                          <div className="text-right">
                            <div className={secundario + ' text-xs tabular-nums'}>
                              Ant. {anterior === null ? '—' : formatoNumero.format(anterior)}
                            </div>
                            <div className={'mt-0.5 text-[11px] font-semibold tabular-nums ' + (
                              variacion === null || variacion === 0 ? secundario
                              : variacion > 0 ? 'text-emerald-500' : 'text-red-500'
                            )}>
                              {variacion === null
                                ? anterior === 0 ? 'Sin base'
                                  : errorComparacion ? 'No disponible' : '—'
                                : (variacion > 0 ? '▲ +' : variacion < 0 ? '▼ ' : '— ')
                                  + variacion.toLocaleString('es-AR', {
                                    minimumFractionDigits: 1,
                                    maximumFractionDigits: 1
                                  }) + '%'}
                            </div>
                          </div>
                        </div>
                        )}
                      </div>
                    )
                  })() : (
                temaVisual === 'instrumental' ? (
                  <MedidorInstrumental
                    actual={(() => {
                      const valor = producto.nombre === '1175' ? (canal === 'call' ? '—' : r3 ? formatoNumero.format(r3.total) : '—') : producto.nombre === 'CATER / EQUIPOS' ? (canal === 'call' ? '—' : cater ? formatoNumero.format(cater.total) : '—') : bafTodosListo && producto.nombre === 'BAF' ? formatoNumero.format(datos!.totales.cargadas + datosPdv!.totales.total) : canal === 'pdv' && producto.nombre === 'BAF' && datosPdv ? formatoNumero.format(datosPdv.totales.total) : canal === 'todos' && movilPdv && detallePlanes && producto.nombre === 'PORTA' ? formatoNumero.format(movilPdv.totales.porta + detallePlanes.totales.porta) : canal === 'todos' && movilPdv && detallePlanes && producto.nombre === 'LÍNEA NUEVA' ? formatoNumero.format(movilPdv.totales.ln + detallePlanes.totales.ln) : canal === 'pdv' && producto.nombre === 'PORTA' && movilPdv ? formatoNumero.format(movilPdv.totales.porta) : canal === 'pdv' && producto.nombre === 'LÍNEA NUEVA' && movilPdv ? formatoNumero.format(movilPdv.totales.ln) : canal === 'call' && producto.nombre === 'BAF' && datos ? formatoNumero.format(datos.totales.cargadas) : canal === 'call' && detallePlanes && producto.nombre === 'PORTA' ? formatoNumero.format(detallePlanes.totales.porta) : canal === 'call' && detallePlanes && producto.nombre === 'LÍNEA NUEVA' ? formatoNumero.format(detallePlanes.totales.ln) : canal === 'todos' && movilPdv && detallePlanes && producto.nombre === 'FWA' && Number.isFinite(movilPdv.totales.fwa) && Number.isFinite(detallePlanes.fwa) ? formatoNumero.format(movilPdv.totales.fwa + detallePlanes.fwa) : canal === 'pdv' && movilPdv && producto.nombre === 'FWA' && Number.isFinite(movilPdv.totales.fwa) ? formatoNumero.format(movilPdv.totales.fwa) : canal === 'call' && detallePlanes && producto.nombre === 'FWA' ? formatoNumero.format(Number.isFinite(detallePlanes.fwa) ? detallePlanes.fwa : 0) : '—'
                      return valor === '—'
                        ? null
                        : Number(valor.replace(/\./g, ''))
                    })()}
                    anterior={null}
                    color={producto.color.slice(4, -1)}
                    oscuro={oscuro}
                  />
                ) : (
                  <div className="px-1 text-left text-4xl font-bold tracking-tight tabular-nums">{producto.nombre === '1175' ? (canal === 'call' ? '—' : r3 ? formatoNumero.format(r3.total) : '—') : producto.nombre === 'CATER / EQUIPOS' ? (canal === 'call' ? '—' : cater ? formatoNumero.format(cater.total) : '—') : bafTodosListo && producto.nombre === 'BAF' ? formatoNumero.format(datos!.totales.cargadas + datosPdv!.totales.total) : canal === 'pdv' && producto.nombre === 'BAF' && datosPdv ? formatoNumero.format(datosPdv.totales.total) : canal === 'todos' && movilPdv && detallePlanes && producto.nombre === 'PORTA' ? formatoNumero.format(movilPdv.totales.porta + detallePlanes.totales.porta) : canal === 'todos' && movilPdv && detallePlanes && producto.nombre === 'LÍNEA NUEVA' ? formatoNumero.format(movilPdv.totales.ln + detallePlanes.totales.ln) : canal === 'pdv' && producto.nombre === 'PORTA' && movilPdv ? formatoNumero.format(movilPdv.totales.porta) : canal === 'pdv' && producto.nombre === 'LÍNEA NUEVA' && movilPdv ? formatoNumero.format(movilPdv.totales.ln) : canal === 'call' && producto.nombre === 'BAF' && datos ? formatoNumero.format(datos.totales.cargadas) : canal === 'call' && detallePlanes && producto.nombre === 'PORTA' ? formatoNumero.format(detallePlanes.totales.porta) : canal === 'call' && detallePlanes && producto.nombre === 'LÍNEA NUEVA' ? formatoNumero.format(detallePlanes.totales.ln) : canal === 'todos' && movilPdv && detallePlanes && producto.nombre === 'FWA' && Number.isFinite(movilPdv.totales.fwa) && Number.isFinite(detallePlanes.fwa) ? formatoNumero.format(movilPdv.totales.fwa + detallePlanes.fwa) : canal === 'pdv' && movilPdv && producto.nombre === 'FWA' && Number.isFinite(movilPdv.totales.fwa) ? formatoNumero.format(movilPdv.totales.fwa) : canal === 'call' && detallePlanes && producto.nombre === 'FWA' ? formatoNumero.format(Number.isFinite(detallePlanes.fwa) ? detallePlanes.fwa : 0) : '—'}</div>
                )
                )}
                <div className={'' + secundario + ' mt-1 text-[10px] leading-3'}>{producto.nombre === '1175' ? (canal === 'call' ? 'No aplica' : errorR3 ? 'No disponible' : 'R3 · Fecha primera carga · PDV') : producto.nombre === 'CATER / EQUIPOS' ? (canal === 'call' ? 'No aplica' : errorCater ? 'No disponible' : 'DIST · Fecha migración · PDV') : producto.nombre === 'BAF' ? (canal === 'todos' ? 'Call cargadas + PDV activadas' : canal === 'pdv' ? 'Activaciones · Fecha activación' : 'BAF cargadas · SDS validada') : canal === 'pdv' && producto.nombre === 'PORTA' ? 'Claro Trámites · Dia ID · Activado' : canal === 'pdv' && producto.nombre === 'LÍNEA NUEVA' ? 'Activaciones móviles − PORTA · mismo período' : canal === 'todos' && ['PORTA', 'LÍNEA NUEVA'].includes(producto.nombre) ? 'Call cargadas + PDV activadas' : canal === 'todos' && producto.nombre === 'FWA' ? 'Call cargadas + PDV activadas' : canal === 'pdv' && producto.nombre === 'FWA' ? 'Activaciones · Fecha activación' : ['PORTA', 'LÍNEA NUEVA', 'FWA'].includes(producto.nombre) ? 'CARGADO STL · Fecha Carga STL' : 'Pendiente de integración'}</div>
                {canal === 'call' && detallePlanes && (producto.nombre === 'PORTA' || producto.nombre === 'LÍNEA NUEVA') && (
                  <ComposicionMovil
                    detalle={detallePlanes}
                    negocio={producto.nombre === 'PORTA' ? 'porta' : 'ln'}
                    fondo={oscuro ? 'bg-slate-700' : 'bg-gray-200'}
                  />
                )}
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

        {(canal === 'pdv' || canal === 'todos') && (() => {
          const series = [
            { nombre: 'BAF', color: '#095995', filas: datosPdv?.porPdv.map(p => ({ ...p, valor: p.totales.total })) },
            { nombre: 'PORTA', color: '#e7192c', filas: movilPdv?.porPdv.map(p => ({ ...p, valor: p.porta })) },
            { nombre: 'LÍNEA NUEVA', color: '#7342d7', filas: movilPdv?.porPdv.map(p => ({ ...p, valor: p.ln })) },
            { nombre: 'FWA', color: '#ff9800', filas: movilPdv?.porPdv.map(p => ({ ...p, valor: p.fwa })) },
            { nombre: 'CATER / EQUIPOS', color: '#008c84', filas: cater?.porPdv.map(p => ({ ...p, valor: p.total })) },
            { nombre: '1175', color: '#657b24', filas: r3?.porPdv.map(p => ({ ...p, valor: p.total })) },
          ]
          const puntos = new Map<string, string>()
          for (const s of series) for (const p of s.filas ?? []) puntos.set(p.punto_venta_id, p.punto_venta)
          const filas = [...puntos.entries()].sort((a,b) => a[1].localeCompare(b[1]))
          const valor = (s: typeof series[number], id: string) => s.filas ? (s.filas.find(p => p.punto_venta_id === id)?.valor ?? 0) : null
          const comerciales = series.filter(s => s.nombre !== '1175')
          const totalOp = (id: string) => comerciales.every(s => s.filas) ? comerciales.reduce((n,s) => n + (valor(s,id) ?? 0),0) : null
          const maxTotal = Math.max(1,...filas.map(([id]) => totalOp(id) ?? 0))
          const celda = (n: number | null, max: number, color: string) => (
            <div className="flex items-center gap-1.5">
              <div className={'h-3 flex-1 overflow-hidden rounded-sm ' + (oscuro ? 'bg-slate-700' : 'bg-gray-100')}>
                <div className="h-full rounded-sm" style={{backgroundColor:color,width:Math.max(0,n ?? 0)/max*100+'%'}}/>
              </div>
              <span className={'w-8 shrink-0 text-right text-xs font-semibold tabular-nums ' + (n !== null && n < 0 ? 'text-red-600' : '')}>{n === null ? '—' : formatoNumero.format(n)}</span>
            </div>
          )
          return (
            <section className={tarjeta + ' mb-4 rounded-xl border p-4'}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className={'font-bold ' + tituloSeccion}>Resultados por Punto de Venta y producto</h3>
                <div className={'inline-flex rounded-lg border p-1 ' + borde} role="group" aria-label="Vista de resultados PDV">
                  {(['ranking','comparativo'] as const).map(vista => (
                    <button key={vista} type="button" aria-pressed={vistaPdv === vista} onClick={() => setVistaPdv(vista)} className={'rounded-md px-3 py-1.5 text-xs font-bold ' + (vistaPdv === vista ? 'bg-[#194579] text-white' : secundario)}>{vista.toUpperCase()}</button>
                  ))}
                </div>
              </div>
              {vistaPdv === 'comparativo' ? (
                <>
              <p className={secundario + ' mt-1 text-xs'}>Exclusivamente PDV · Barras a escala por producto · TOTAL OP excluye 1175</p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[900px] table-fixed border-collapse text-xs">
                  <thead><tr>
                    <th className="w-[24%] rounded-tl-md bg-[#194579] px-2 py-3 text-left text-white">PUNTO DE VENTA</th>
                    {series.map(s => <th key={s.nombre} className="px-1 py-3 text-center text-white" style={{backgroundColor:s.color}}>{s.nombre}</th>)}
                    <th className="rounded-tr-md bg-[#194579] px-1 py-3 text-center text-white">TOTAL OP</th>
                  </tr></thead>
                  <tbody>
                    {filas.map(([id,nombre],i) => (
                      <tr key={id} className={'border-b ' + borde + (i%2 ? ' ' + fondoSuave : '')}>
                        <th scope="row" className="px-2 py-3 text-left font-semibold">{nombre.replace(/^PDV\s+/i,'')}</th>
                        {series.map(s => <td key={s.nombre} className="px-2 py-3">{celda(valor(s,id),Math.max(1,...(s.filas ?? []).map(p => p.valor)),s.color)}</td>)}
                        <td className="px-2 py-3">{celda(totalOp(id),maxTotal,'#194579')}</td>
                      </tr>
                    ))}
                    {!filas.length && <tr><td colSpan={8} className="p-4 text-center">Sin datos de PDV disponibles.</td></tr>}
                  </tbody>
                  <tfoot><tr className="bg-[#194579] font-bold text-white">
                    <th className="px-2 py-3 text-left">TOTAL POR NEGOCIO</th>
                    {series.map(s => <td key={s.nombre} className="px-2 py-3 text-right tabular-nums">{s.filas ? formatoNumero.format(s.filas.reduce((n,p) => n+p.valor,0)) : '—'}</td>)}
                    <td className="px-2 py-3 text-right tabular-nums">{comerciales.every(s => s.filas) ? formatoNumero.format(filas.reduce((n,[id]) => n+(totalOp(id) ?? 0),0)) : '—'}</td>
                  </tr></tfoot>
                </table>
              </div>
                </>
              ) : (
                <>
                  <p className={secundario + ' mt-1 text-xs'}>Exclusivamente PDV · Orden descendente por producto · Período seleccionado</p>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {series.map(s => {
                      const ordenadas = [...(s.filas ?? [])].sort((a,b) => b.valor-a.valor || a.punto_venta.localeCompare(b.punto_venta))
                      const max = Math.max(1,...ordenadas.map(p => p.valor))
                      return (
                        <div key={s.nombre} className={'overflow-hidden rounded-lg border ' + borde}>
                          <h4 className="px-3 py-2 text-sm font-bold text-white" style={{backgroundColor:s.color}}>{s.nombre}</h4>
                          <div className="space-y-2 p-3">
                            {!s.filas ? <p className={secundario + ' text-xs'}>Datos no disponibles</p> : !ordenadas.length || ordenadas.every(p => p.valor === 0) ? <p className={secundario + ' text-xs'}>Sin operaciones en el período</p> : ordenadas.map((p,i) => (
                              <div key={p.punto_venta_id}>
                                <div className="flex items-baseline gap-2 text-xs">
                                  <span className={secundario + ' w-5 shrink-0 tabular-nums'}>{i+1}.</span>
                                  <span className="min-w-0 flex-1">{p.punto_venta.replace(/^PDV\s+/i,'')}</span>
                                </div>
                                <div className="ml-7 mt-1">{celda(p.valor,max,s.color)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </section>
          )
        })()}

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
        {canal === 'todos' && movilPdv && detallePlanes && (
          <div className={tarjeta + ' mb-4 rounded-xl border p-4'}>
            <h3 className={'font-bold ' + tituloSeccion}>PORTA y Línea Nueva por origen comercial</h3>
            <p className={secundario + ' mt-1 text-xs'}>Call: CARGADO STL por Fecha Carga STL. PDV: activaciones y trámites portados del mismo período.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className={'border-b text-left ' + borde}><th className="py-2">Origen</th><th className="text-right">PORTA</th><th className="text-right">LN</th><th className="text-right">TOTAL</th></tr></thead>
                <tbody>{[
                  {nombre:'Call Lucom', ...detallePlanes.totales},
                  {nombre:'Puntos de Venta', ...movilPdv.totales},
                  {nombre:'Total agencia', porta:detallePlanes.totales.porta+movilPdv.totales.porta, ln:detallePlanes.totales.ln+movilPdv.totales.ln}
                ].map(fila => <tr key={fila.nombre} className={'border-b ' + borde + (fila.nombre === 'Total agencia' ? ' font-bold' : '')}><td className="py-2">{fila.nombre}</td><td className="text-right tabular-nums">{formatoNumero.format(fila.porta)}</td><td className="text-right tabular-nums">{formatoNumero.format(fila.ln)}</td><td className="text-right tabular-nums">{formatoNumero.format(fila.porta+fila.ln)}</td></tr>)}</tbody>
              </table>
            </div>
            {movilPdv.inconsistencias.length > 0 && <p role="alert" className="mt-3 text-sm text-red-600">Atención: existen PDV con LN negativa. Revisar diferencias entre reportes.</p>}
          </div>
        )}
        {canal === 'pdv' && (
          <div className="space-y-4">
            <details className={tarjeta + ' group rounded-xl border p-4'}>
              <summary className={'flex cursor-pointer list-none items-center justify-between gap-2 font-bold [&::-webkit-details-marker]:hidden ' + tituloSeccion}><span>Detalle por Punto de Venta · BAF</span><span aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-90">▸</span></summary>
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
            </details>
            <details className={tarjeta + ' group rounded-xl border p-4'}>
              <summary className={'flex cursor-pointer list-none items-center justify-between gap-2 font-bold [&::-webkit-details-marker]:hidden ' + tituloSeccion}><span>Detalle por Punto de Venta · PORTA y Línea Nueva</span><span aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-90">▸</span></summary>
              <p className={secundario + ' mt-1 text-xs'}>Total móvil: Activaciones (3055, 3065, 4001, 4095, 5301). PORTA: trámites activados por Dia ID. Línea Nueva: diferencia de ambos reportes para el mismo período y PDV.</p>
              {movilPdv ? (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className={'border-b text-left text-xs ' + borde}>
                      <th className="py-2 pr-2">Punto de Venta</th>
                      <th className="px-2 py-2 text-right">Total móvil</th>
                      <th className="px-2 py-2 text-right">PORTA</th>
                      <th className="py-2 pl-2 text-right">LN</th>
                    </tr></thead>
                    <tbody>
                      {[...movilPdv.porPdv].sort((a,b) => b.total_movil - a.total_movil || a.punto_venta.localeCompare(b.punto_venta)).map(pdv => (
                        <tr key={pdv.punto_venta_id} className={'border-b ' + borde}>
                          <td className="py-2 pr-2">{pdv.punto_venta}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{formatoNumero.format(pdv.total_movil)}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{formatoNumero.format(pdv.porta)}</td>
                          <td className={'py-2 pl-2 text-right tabular-nums ' + (pdv.ln < 0 ? 'font-bold text-red-600' : '')}>{formatoNumero.format(pdv.ln)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="font-bold">
                      <td className="pt-3 pr-2">TOTAL</td>
                      <td className="px-2 pt-3 text-right tabular-nums">{formatoNumero.format(movilPdv.totales.total_movil)}</td>
                      <td className="px-2 pt-3 text-right tabular-nums">{formatoNumero.format(movilPdv.totales.porta)}</td>
                      <td className="pt-3 pl-2 text-right tabular-nums">{formatoNumero.format(movilPdv.totales.ln)}</td>
                    </tr></tfoot>
                  </table>
                  {movilPdv.inconsistencias.length > 0 && <p role="alert" className="mt-3 text-sm font-semibold text-red-600">Atención: {movilPdv.inconsistencias.length} PDV con LN negativa. Revisar diferencias entre reportes.</p>}
                </div>
              ) : <p className={secundario + ' mt-3 text-sm'}>{cargando ? 'Consultando móviles de PDV...' : 'Indicadores móviles no disponibles.'}</p>}
            </details>
          </div>
        )}
        {(canal === 'pdv' || canal === 'todos') && (
          <details className={tarjeta + ' mb-4 group rounded-xl border p-4'}>
            <summary className={'flex cursor-pointer list-none items-center justify-between gap-2 font-bold [&::-webkit-details-marker]:hidden ' + tituloSeccion}><span>Detalle CATER / EQUIPOS por Punto de Venta</span><span aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-90">▸</span></summary>
            <p className={secundario + ' mt-1 text-xs'}>TipoVenta DIST · Fecha migración · SDS único. Abrí cada PDV para consultar sus vendedores.</p>
            {errorCater ? <p role="alert" className="mt-3 text-sm text-red-600">{errorCater}</p> : cater ? (
              <div className="mt-3 space-y-2">
                {[...cater.porPdv].filter(p => p.total > 0).sort((a,b) => b.total - a.total || a.punto_venta.localeCompare(b.punto_venta)).map(pdv => (
                  <details key={pdv.punto_venta_id} className={'rounded-lg border ' + borde}>
                    <summary className="flex cursor-pointer justify-between gap-2 px-3 py-2 text-sm font-semibold">
                      <span>{pdv.punto_venta}</span><span className="tabular-nums">{formatoNumero.format(pdv.total)}</span>
                    </summary>
                    <div className={'border-t ' + borde + ' ' + fondoSuave}>
                      {Object.entries(pdv.vendedores).sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([nombre,total]) => (
                        <div key={nombre} className={'flex justify-between gap-2 border-b px-3 py-2 text-xs last:border-0 ' + borde}>
                          <span>{nombre}</span><span className="tabular-nums">{formatoNumero.format(total)}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
                <div className={'flex justify-between border-t px-3 py-2 text-sm font-bold ' + borde}><span>TOTAL</span><span>{formatoNumero.format(cater.total)}</span></div>
              </div>
            ) : <p className={secundario + ' mt-3 text-sm'}>Consultando CATER...</p>}
          </details>
        )}
        {(canal === 'pdv' || canal === 'todos') && (
          <details className={tarjeta + ' group mb-4 rounded-xl border p-4'}>
            <summary className={'flex cursor-pointer list-none items-center justify-between gap-2 font-bold [&::-webkit-details-marker]:hidden ' + tituloSeccion}><span>Detalle 1175 por Punto de Venta</span><span aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-90">▸</span></summary>
            <p className={secundario + ' mt-1 text-xs'}>R3 · Local Claro Exclusivo · Fecha primera carga</p>
            {errorR3 ? <p role="alert" className="mt-3 text-sm text-red-600">{errorR3}</p> : r3 ? (
              <div className="mt-3 space-y-2">
                {[...r3.porPdv].sort((a,b) => b.total - a.total || a.punto_venta.localeCompare(b.punto_venta)).map(pdv => (
                  <div key={pdv.punto_venta_id} className={'flex justify-between gap-2 rounded-lg border px-3 py-2 text-sm ' + borde}>
                    <span>{pdv.punto_venta}</span><span className="font-semibold tabular-nums">{formatoNumero.format(pdv.total)}</span>
                  </div>
                ))}
                <div className={'flex justify-between border-t px-3 py-2 text-sm font-bold ' + borde}><span>TOTAL</span><span>{formatoNumero.format(r3.total)}</span></div>
              </div>
            ) : <p className={secundario + ' mt-3 text-sm'}>Consultando 1175...</p>}
          </details>
        )}
        {canal === 'call' && (<>
        <div className="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {(['porta', 'ln'] as const).map(negocio => (
            <div key={negocio} className={tarjeta + ' min-w-0 rounded-xl border p-4'}>
              {errorPlanes ? <p role="alert" className="text-sm text-red-600">{errorPlanes}</p>
                : detallePlanes ? <EvolucionMovil detalle={detallePlanes} negocio={negocio} oscuro={oscuro} />
                : <p className={secundario + ' text-sm'}>Consultando evolución de planes...</p>}
            </div>
          ))}
        </div>
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
            <h3 className={'font-bold ' + tituloSeccion}>Evolutivo BAF</h3>
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
          <details className={'' + tarjeta + ' group rounded-xl border p-4'}>
            <summary className={'flex cursor-pointer list-none items-center justify-between gap-2 font-bold [&::-webkit-details-marker]:hidden ' + tituloSeccion}><span>Detalle por canales comerciales · BAF</span><span aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-90">▸</span></summary>
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
          </details>
          <details className={'' + tarjeta + ' group rounded-xl border p-4'}>
            <summary className={'flex cursor-pointer list-none items-center justify-between gap-2 font-bold [&::-webkit-details-marker]:hidden ' + tituloSeccion}><span>Detalle Planes Porta - LN</span><span aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-90">▸</span></summary>
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
          </details>
        </div>
        </>)}
        <p className={'' + secundario + ' mt-4 text-xs'}>Dashboard en desarrollo. Los indicadores disponibles se consultan en PGL y reportes Claro; los pendientes no muestran cifras simuladas.</p>
      </div>
    </section>
  )
}
