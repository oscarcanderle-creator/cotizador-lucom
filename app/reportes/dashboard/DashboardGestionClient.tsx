'use client'

import { useEffect, useState } from 'react'

type TemaVisual = 'clasico' | 'ejecutivo' | 'instrumental'
type Negocio = 'baf' | 'porta' | 'ln' | 'fwa' | 'total_movil'

type Respuesta = {
  desde: string
  hasta: string
  totales: Record<Negocio, number>
  composicion: Record<
    Exclude<Negocio, 'total_movil'>,
    Record<string, number>
  >
  grupos: {
    nombre: string
    vendedores: string[]
  }[]
}

const formato = new Intl.NumberFormat('es-AR')

const negocios: {
  clave: Negocio
  nombre: string
  color: string
}[] = [
  { clave: 'baf', nombre: 'BAF', color: '#07559b' },
  { clave: 'porta', nombre: 'PORTA', color: '#d51529' },
  { clave: 'ln', nombre: 'LÍNEA NUEVA', color: '#7540d8' },
  { clave: 'fwa', nombre: 'FWA', color: '#d97706' },
  { clave: 'total_movil', nombre: 'TOTAL MÓVIL', color: '#475569' },
]

const colores: Record<string, string> = {
  '2PLAY': '#2563eb',
  '3PLAY': '#0d9488',
  '2 GB': '#64748b',
  '4 GB': '#2563eb',
  '7 GB': '#0d9488',
  '10 GB': '#eab308',
  '30 GB': '#9333ea',
  '50 GB': '#e11d48',
  'FWA 5G 400G': '#d97706',
  'PORTA': '#d51529',
  'LN': '#7540d8',
  'SIN CLASIFICAR': '#94a3b8',
  'SIN PLAN': '#94a3b8',
}

function hoyArgentina() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function rangoFechas(
  periodo: string,
  inicio: string,
  final: string
) {
  const hoy = hoyArgentina()

  if (periodo === 'personalizado') {
    return { desde: inicio, hasta: final }
  }

  if (periodo === 'hoy') {
    return { desde: hoy, hasta: hoy }
  }

  const fecha = new Date(hoy + 'T12:00:00Z')

  if (periodo === 'semana') {
    const dia = (fecha.getUTCDay() + 6) % 7
    fecha.setUTCDate(fecha.getUTCDate() - dia)

    return {
      desde: fecha.toISOString().slice(0, 10),
      hasta: hoy,
    }
  }

  if (periodo === 'anterior') {
    fecha.setUTCDate(1)
    fecha.setUTCDate(0)

    const hasta = fecha.toISOString().slice(0, 10)

    return {
      desde: hasta.slice(0, 7) + '-01',
      hasta,
    }
  }

  return {
    desde: hoy.slice(0, 7) + '-01',
    hasta: hoy,
  }
}

function Composicion({
  valores,
  oscuro,
}: {
  valores: Record<string, number>
  oscuro: boolean
}) {
  const items = Object.entries(valores)
    .filter(([, cantidad]) => cantidad > 0)
    .sort(([a], [b]) =>
      a.localeCompare(b, 'es', { numeric: true })
    )

  const total = items.reduce(
    (suma, [, cantidad]) => suma + cantidad, 0
  )

  if (!total) {
    return (
      <p className="mt-3 text-center text-[11px] opacity-50">
        Sin ventas
      </p>
    )
  }

  return (
    <>
      <div className={
        'mt-3 flex h-3 overflow-hidden rounded ' +
        (oscuro ? 'bg-slate-700' : 'bg-gray-200')
      }>
        {items.map(([nombre, cantidad]) => (
          <div
            key={nombre}
            title={`${nombre}: ${formato.format(cantidad)}`}
            style={{
              width: `${cantidad / total * 100}%`,
              backgroundColor: colores[nombre] || '#64748b',
            }}
          />
        ))}
      </div>

      <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
        {items.map(([nombre, cantidad]) => (
          <span
            key={nombre}
            className="inline-flex items-center gap-1 text-[10px]"
          >
            <i
              className="h-2 w-2 rounded-sm"
              style={{
                backgroundColor: colores[nombre] || '#64748b',
              }}
            />
            {nombre}
            <strong>{formato.format(cantidad)}</strong>
          </span>
        ))}
      </div>
    </>
  )
}


function rangoAnterior(
  periodo: string,
  desde: string,
  hasta: string
) {
  const inicio = new Date(desde + 'T12:00:00Z')
  const fin = new Date(hasta + 'T12:00:00Z')

  if (periodo === 'mes' || periodo === 'anterior') {
    const primerDia = new Date(Date.UTC(
      inicio.getUTCFullYear(),
      inicio.getUTCMonth() - 1, 1, 12
    ))

    const ultimoDia = new Date(Date.UTC(
      inicio.getUTCFullYear(),
      inicio.getUTCMonth(), 0, 12
    ))

    if (periodo === 'mes') {
      ultimoDia.setUTCDate(
        Math.min(fin.getUTCDate(), ultimoDia.getUTCDate())
      )
    }

    return {
      desde: primerDia.toISOString().slice(0, 10),
      hasta: ultimoDia.toISOString().slice(0, 10),
    }
  }

  const dias = Math.round(
    (fin.getTime() - inicio.getTime()) / 86400000
  ) + 1

  const desplazamiento = periodo === 'semana' ? 7 : dias

  inicio.setUTCDate(inicio.getUTCDate() - desplazamiento)
  fin.setUTCDate(fin.getUTCDate() - desplazamiento)

  return {
    desde: inicio.toISOString().slice(0, 10),
    hasta: fin.toISOString().slice(0, 10),
  }
}

function MedidorInstrumental({
  actual,
  objetivo,
  color,
  oscuro,
  estadoObjetivo,
}: {
  actual: number | null
  objetivo: number | null
  color: string
  oscuro: boolean
  estadoObjetivo: string
}) {
  const porcentaje =
    objetivo !== null && objetivo > 0 && actual !== null
      ? actual / objetivo * 100
      : null

  const avance = Math.min(100, Math.max(0, porcentaje ?? 0))
  const angulo = Math.PI * avance / 100
  const secundario = oscuro ? '#94a3b8' : '#64748b'

  return (
    <svg
      viewBox="0 0 180 122"
      className="mx-auto w-full max-w-[200px]"
      role="img"
      aria-label={
        'Ventas: ' + (actual ?? 'No disponible') +
        '. Objetivo: ' + (objetivo ?? estadoObjetivo)
      }
    >
      <path
        d="M20 82 A70 70 0 0 1 160 82"
        fill="none"
        stroke={oscuro ? '#334155' : '#e5e7eb'}
        strokeWidth="10"
        strokeLinecap="round"
      />

      {porcentaje !== null && avance > 0 && (
        <path
          d="M20 82 A70 70 0 0 1 160 82"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={avance + ' 100'}
        />
      )}

      {objetivo !== null && objetivo > 0 &&
        [0, 0.25, 0.5, 0.75, 1].map(t => (
          <line
            key={t}
            x1={90 - 61 * Math.cos(Math.PI * t)}
            y1={82 - 61 * Math.sin(Math.PI * t)}
            x2={90 - 56 * Math.cos(Math.PI * t)}
            y2={82 - 56 * Math.sin(Math.PI * t)}
            stroke={secundario}
            strokeWidth="1"
          />
        ))
      }

      {porcentaje !== null && (
        <g transform={
          'translate(' +
          (90 - 70 * Math.cos(angulo)) + ' ' +
          (82 - 70 * Math.sin(angulo)) +
          ') rotate(' +
          (angulo * 180 / Math.PI - 90) + ')'
        }>
          <path
            d="M-7 -8 L9 0 L-7 8 Z"
            fill={color}
            stroke={oscuro ? '#e2e8f0' : '#ffffff'}
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </g>
      )}

      <text
        x="90"
        y="61"
        textAnchor="middle"
        fontSize="34"
        fontWeight="700"
        fill="currentColor"
      >
        {actual === null ? '—' : formato.format(actual)}
      </text>

      <text
        x="90"
        y="78"
        textAnchor="middle"
        fontSize="11"
        fill={secundario}
      >
        {objetivo !== null
          ? 'Obj. ' + formato.format(objetivo)
          : estadoObjetivo}
      </text>

      {objetivo !== null && objetivo > 0 && (
        <>
          <text
            x="20"
            y="100"
            textAnchor="middle"
            fontSize="10"
            fill={secundario}
          >
            0
          </text>

          <text
            x="160"
            y="100"
            textAnchor="middle"
            fontSize="10"
            fill={secundario}
          >
            {formato.format(objetivo)}
          </text>
        </>
      )}

      <text
        x="90"
        y="108"
        textAnchor="middle"
        fontSize="17"
        fontWeight="700"
        fill={
          porcentaje === null
            ? secundario
            : porcentaje >= 100
              ? '#16a34a'
              : color
        }
      >
        {porcentaje === null
          ? objetivo === 0 ? 'Sin escala' : '—'
          : porcentaje.toLocaleString('es-AR', {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }) + '%'}
      </text>
    </svg>
  )
}

export default function DashboardGestionClient({
  oscuro,
  versionObjetivos = 0,
}: {
  oscuro: boolean
  versionObjetivos?: number
}) {
  const [periodo, setPeriodo] = useState('mes')
  const [inicio, setInicio] = useState(
    () => hoyArgentina().slice(0, 7) + '-01'
  )
  const [final, setFinal] = useState(hoyArgentina)
  const [grupo, setGrupo] = useState('')
  const [vendedor, setVendedor] = useState('')
  const [tema, setTema] = useState<TemaVisual>('clasico')

  const [datos, setDatos] = useState<Respuesta | null>(null)
  const [anterior, setAnterior] =
    useState<Respuesta | null>(null)

  const [grupos, setGrupos] = useState<Respuesta['grupos']>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [objetivosMensuales, setObjetivosMensuales] = useState<{
    mes: string
    objetivos: Record<string, number | null>
  } | null>(null)

  const [errorObjetivos, setErrorObjetivos] = useState(false)
  const [cargandoObjetivos, setCargandoObjetivos] = useState(false)

  const rangoObjetivos = rangoFechas(periodo, inicio, final)

  const mesObjetivos =
    rangoObjetivos.desde &&
    rangoObjetivos.hasta &&
    rangoObjetivos.desde <= rangoObjetivos.hasta &&
    rangoObjetivos.desde.slice(0, 7) ===
      rangoObjetivos.hasta.slice(0, 7)
      ? rangoObjetivos.desde.slice(0, 7)
      : ''

  useEffect(() => {
    setObjetivosMensuales(null)
    setErrorObjetivos(false)
    setCargandoObjetivos(false)

    if (!mesObjetivos || grupo || vendedor) return

    const controller = new AbortController()

    setCargandoObjetivos(true)

    fetch(
      '/api/dashboard/objetivos?mes=' +
        encodeURIComponent(mesObjetivos),
      {
        signal: controller.signal,
        cache: 'no-store',
      }
    )
      .then(async respuesta => {
        if (!respuesta.ok) {
          throw new Error('Error al consultar objetivos.')
        }

        return respuesta.json()
      })
      .then(datos => {
        if (!controller.signal.aborted) {
          setObjetivosMensuales(datos)
        }
      })
      .catch(error => {
        if (!controller.signal.aborted) {
          setErrorObjetivos(true)
          console.error('Objetivos Dashboard', error)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCargandoObjetivos(false)
        }
      })

    return () => controller.abort()
  }, [mesObjetivos, versionObjetivos, grupo, vendedor])

  function objetivoNegocio(clave: string): number | null {
    if (grupo || vendedor) return null

    if (
      !mesObjetivos ||
      objetivosMensuales?.mes !== mesObjetivos
    ) return null

    const indicadores: Record<string, string> = {
      baf: 'BAF_INGRESADAS',
      porta: 'PORTA_INGRESADAS',
      ln: 'LN_INGRESADAS',
      fwa: 'FWA_INGRESADAS',
      total_movil: 'TOTAL_MOVIL_INGRESADAS',
    }

    return objetivosMensuales.objetivos[indicadores[clave]] ?? null
  }


  useEffect(() => {
    const guardado = localStorage.getItem(
      'pgl-dashboard-gestion-tema'
    )

    if (
      guardado === 'clasico' ||
      guardado === 'ejecutivo' ||
      guardado === 'instrumental'
    ) {
      setTema(guardado)
    }
  }, [])

  const { desde, hasta } = rangoFechas(
    periodo, inicio, final
  )

  useEffect(() => {
    const controlador = new AbortController()

    setCargando(true)
    setError('')
    setDatos(null)

    const parametros = new URLSearchParams({
      desde, hasta, grupo, vendedor,
    })

    fetch('/api/dashboard/gestion?' + parametros, {
      signal: controlador.signal,
      cache: 'no-store',
    })
      .then(async respuesta => {
        const json = await respuesta.json()

        if (!respuesta.ok) {
          throw new Error(json.error || 'Error de consulta.')
        }

        if (controlador.signal.aborted) return

        setDatos(json)
        setGrupos(json.grupos)
      })
      .catch(e => {
        if (!controlador.signal.aborted) {
          setError(e.message)
        }
      })
      .finally(() => {
        if (!controlador.signal.aborted) {
          setCargando(false)
        }
      })

    return () => controlador.abort()
  }, [desde, hasta, grupo, vendedor])


  useEffect(() => {
    setAnterior(null)

    if (!desde || !hasta || desde > hasta) return

    const controlador = new AbortController()
    const rango = rangoAnterior(periodo, desde, hasta)

    const parametros = new URLSearchParams({
      ...rango, grupo, vendedor,
    })

    fetch('/api/dashboard/gestion?' + parametros, {
      signal: controlador.signal,
      cache: 'no-store',
    })
      .then(async respuesta => {
        if (!respuesta.ok) {
          throw new Error('Comparación no disponible')
        }

        const json = await respuesta.json()

        if (!controlador.signal.aborted) {
          setAnterior(json)
        }
      })
      .catch(() => {
        if (!controlador.signal.aborted) {
          setAnterior(null)
        }
      })

    return () => controlador.abort()
  }, [periodo, desde, hasta, grupo, vendedor])

  const [vistaRanking,setVistaRanking]=useState<'comparativo'|'ranking'|'consolidado'>('comparativo')
  const [negocioRanking,setNegocioRanking]=useState<'baf'|'bafFinalizadas'|'porta'|'ln'>('baf')
  const [ordenRanking,setOrdenRanking]=useState<'vendedor'|'baf'|'bafFinalizadas'|'porta'|'ln'>('vendedor')
  useEffect(()=>{
    const guardada=localStorage.getItem('pgl-dashboard-ranking-vista')
    if(guardada==='comparativo'||guardada==='ranking'||guardada==='consolidado') setVistaRanking(guardada)
  },[])
  const [ranking, setRanking] = useState<{ vendedor:string; porta:number; ln:number; baf:number; bafFinalizadas:number }[] | null>(null)
  const [errorRanking, setErrorRanking] = useState('')
  useEffect(() => {
    setRanking(null)
    setErrorRanking('')
    if (!desde || !hasta || desde > hasta) return
    const controller = new AbortController()
    const params = new URLSearchParams({desde,hasta,grupo,vendedor})
    fetch('/api/dashboard/ranking-propias?' + params, {signal:controller.signal,cache:'no-store'})
      .then(async r => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error || 'Error al consultar ranking.')
        if (!controller.signal.aborted) setRanking(json.filas)
      })
      .catch(e => { if (!controller.signal.aborted) setErrorRanking(e.message) })
    return () => controller.abort()
  }, [desde,hasta,grupo,vendedor])

  const [referidas, setReferidas] = useState<{ vendedor:string; porta:number; ln:number; baf:number; bafFinalizadas:number }[] | null>(null)
  const [errorReferidas, setErrorReferidas] = useState('')
  useEffect(() => {
    setReferidas(null)
    setErrorReferidas('')
    if (!desde || !hasta || desde > hasta) return
    const controller = new AbortController()
    const params = new URLSearchParams({desde,hasta,grupo,vendedor,modalidad:'referidas'})
    fetch('/api/dashboard/ranking-propias?' + params, {signal:controller.signal,cache:'no-store'})
      .then(async r => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error || 'Error al consultar ranking.')
        if (!controller.signal.aborted) setReferidas(json.filas)
      })
      .catch(e => { if (!controller.signal.aborted) setErrorReferidas(e.message) })
    return () => controller.abort()
  }, [desde,hasta,grupo,vendedor])

  const vendedores = [...new Set(
    grupos
      .filter(g => !grupo || g.nombre === grupo)
      .flatMap(g => g.vendedores)
  )].sort((a, b) => a.localeCompare(b, 'es'))

  const tarjeta = oscuro
    ? 'border-slate-700 bg-slate-800 text-white'
    : 'border-gray-200 bg-white text-gray-900'

  const control = oscuro
    ? 'border-slate-600 bg-slate-900 text-white'
    : 'border-gray-300 bg-white text-gray-900'

  const claseControl =
    control + ' min-w-0 rounded-lg border px-3 py-2 font-normal'

  return (
    <div className={
      'p-4 sm:p-5 ' +
      (oscuro ? 'text-white' : 'text-gray-900')
    }>

      <div className={
        tarjeta +
        ' mb-4 grid grid-cols-1 gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3'
      }>

        <label className="flex flex-col gap-1 text-sm font-semibold">
          Rango de fechas
          <select
            value={periodo}
            onChange={e => {
              setPeriodo(e.target.value)
              setGrupo('')
              setVendedor('')
            }}
            className={claseControl}
          >
            <option value="hoy">Hoy</option>
            <option value="semana">Esta semana</option>
            <option value="mes">Mes en curso</option>
            <option value="anterior">Mes anterior</option>
            <option value="personalizado">Rango personalizado</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold">
          Canal principal
          <input
            value="Call Lucom"
            readOnly
            className={claseControl}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold">
          Tema visual
          <select
            value={tema}
            onChange={e => {
              const nuevo = e.target.value as TemaVisual
              setTema(nuevo)
              localStorage.setItem(
                'pgl-dashboard-gestion-tema', nuevo
              )
            }}
            className={claseControl}
          >
            <option value="clasico">Clásico</option>
            <option value="ejecutivo">Ejecutivo</option>
            <option value="instrumental">Instrumental</option>
          </select>
        </label>

        {periodo === 'personalizado' && (
          <>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Desde
              <input
                type="date"
                value={inicio}
                max={final}
                onChange={e => {
                  setInicio(e.target.value)
                  setGrupo('')
                  setVendedor('')
                }}
                className={claseControl}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold">
              Hasta
              <input
                type="date"
                value={final}
                min={inicio}
                max={hoyArgentina()}
                onChange={e => {
                  setFinal(e.target.value)
                  setGrupo('')
                  setVendedor('')
                }}
                className={claseControl}
              />
            </label>
          </>
        )}

        <label className="flex flex-col gap-1 text-sm font-semibold">
          Grupo de ventas
          <select
            value={grupo}
            onChange={e => {
              setGrupo(e.target.value)
              setVendedor('')
            }}
            className={claseControl}
          >
            <option value="">Todos los grupos</option>
            {grupos.map(g => (
              <option key={g.nombre} value={g.nombre}>
                {g.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold lg:col-span-2">
          Vendedor
          <select
            value={vendedor}
            onChange={e => setVendedor(e.target.value)}
            className={claseControl}
          >
            <option value="">Todos los vendedores</option>
            {vendedores.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>

      <section className="mb-5">
        <h3 className="mb-3 text-lg font-bold">Resultados comerciales</h3>
        <p className="mb-2 text-xs opacity-70">{desde} – {hasta}</p>
        {errorRanking || errorReferidas ? <p role="alert" className="text-sm text-red-500">{errorRanking || errorReferidas}</p> : !ranking || !referidas ? <p className="text-sm opacity-70">Consultando resultados comerciales…</p> : <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {([{clave:'baf',nombre:'BAF CARGADAS',color:'#095995'}, {clave:'bafFinalizadas',nombre:'BAF FINALIZADAS',color:'#095995'}, {clave:'porta',nombre:'PORTA PORTADAS',color:'#e7192c'}, {clave:'ln',nombre:'LN ACTIVAS',color:'#7342d7'}] as const).map(n => {
              const propias=ranking.reduce((s,f)=>s+f[n.clave],0)
              const refs=referidas.reduce((s,f)=>s+f[n.clave],0)
              const sinResponsable=referidas.filter(f=>f.vendedor==='SIN RESPONSABLE L1').reduce((s,f)=>s+f[n.clave],0)
              const total=propias+refs
              const porcentaje=(v:number)=>total ? (100*v/total).toLocaleString('es-AR',{maximumFractionDigits:1})+'%' : '—'
              return <div key={n.clave} className={tarjeta+' overflow-hidden rounded-xl border'}>
                <div className="px-3 py-2 text-center text-xs font-bold" style={tema==='clasico'?{backgroundColor:n.color,color:'#fff'}:{borderBottom:'3px solid '+n.color}}>{n.nombre}</div>
                <div className="space-y-3 p-3">
                  <div className="text-4xl font-bold tabular-nums">{formato.format(total)}</div>
                  <div className="flex h-3 overflow-hidden rounded-full bg-gray-200">
                    <div style={{width:(total?100*propias/total:0)+'%',backgroundColor:n.color}}/>
                    <div style={{width:(total?100*refs/total:0)+'%',backgroundColor:'#94a3b8'}}/>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="opacity-70">Propias</span><div className="text-lg font-bold">{formato.format(propias)}</div><span>{porcentaje(propias)}</span></div>
                    <div><span className="opacity-70">Referidas</span><div className="text-lg font-bold">{formato.format(refs)}</div><span>{porcentaje(refs)}</span></div>
                  </div>
                  {sinResponsable>0 && <p className="text-xs opacity-70">Referidas sin responsable L1: {formato.format(sinResponsable)}</p>}
                </div>
              </div>
            })}
          </div>
          <div className={tarjeta+' mt-3 rounded-xl border p-4'}>
            <h4 className="mb-3 text-sm font-bold">BAF · Finalización de instalaciones</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {([{nombre:'Total',filas:[...ranking,...referidas]}, {nombre:'Propias',filas:ranking}, {nombre:'Referidas',filas:referidas}]).map(n=>{
                const cargadas=n.filas.reduce((s,f)=>s+f.baf,0)
                const finalizadas=n.filas.reduce((s,f)=>s+f.bafFinalizadas,0)
                const ratio=cargadas?100*finalizadas/cargadas:null
                return <div key={n.nombre}>
                  <div className="flex items-center justify-between text-sm"><span>{n.nombre}</span><strong>{ratio===null?'—':ratio.toLocaleString('es-AR',{maximumFractionDigits:1})+'%'}</strong></div>
                  <div className="relative my-2 h-3 rounded-full bg-slate-300">
                    <div className="h-full rounded-full" style={{width:(ratio??0)+'%',backgroundColor:'#095995'}}/>
                    <div className="absolute inset-y-0 w-0.5 bg-amber-600" style={{left:'85%'}}/>
                  </div>
                  <p className="text-xs opacity-70">{finalizadas} de {cargadas} · No finalizadas: {cargadas-finalizadas}</p>
                </div>
              })}
            </div>
            <p className="mt-3 text-xs opacity-70">Referencia habitual: 85% de finalización. Las no finalizadas pueden incluir instalaciones pendientes. Cohorte por fecha de gestión.</p>
          </div>
          <p className="mt-2 text-xs opacity-70">FWA pendiente de definición comercial; excluido de LN.</p>
        </>}
      </section>

      <section className="mt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold">Producción por vendedor</h3>
          <div className="flex flex-wrap gap-1">
            {(['comparativo','ranking','consolidado'] as const).map(v=><button key={v} type="button" aria-pressed={vistaRanking===v} onClick={()=>{setVistaRanking(v);localStorage.setItem('pgl-dashboard-ranking-vista',v)}} className={'rounded-lg border px-3 py-1.5 text-xs font-semibold '+(vistaRanking===v?'border-blue-600 bg-blue-600 text-white':control)}>{v.toUpperCase()}</button>)}
          </div>
        </div>
        {vistaRanking!=='ranking' && (errorRanking||errorReferidas ? <p role="alert" className="text-sm text-red-500">{errorRanking||errorReferidas}</p> : !ranking||!referidas ? <p className="text-sm opacity-70">Consultando rankings…</p> : (()=>{
          const columnas=[{clave:'baf',nombre:'BAF CARGADAS',color:'#095995'},{clave:'bafFinalizadas',nombre:'BAF FINALIZADAS',color:'#095995'},{clave:'porta',nombre:'PORTABILIDAD',color:'#e7192c'},{clave:'ln',nombre:'LÍNEA NUEVA',color:'#7342d7'}] as const
          const nombre=(v:string)=>v.replace(/<[^>]*>/g,'').trim().toUpperCase()
          const asignadas=referidas.filter(f=>f.vendedor!=='SIN RESPONSABLE L1')
          const sinAsignar=referidas.filter(f=>f.vendedor==='SIN RESPONSABLE L1')
          if(vistaRanking==='comparativo') return <div className="space-y-3">
            {[{titulo:'Ventas propias',filas:ranking,pendientes:[] as typeof ranking},{titulo:'Ventas referidas',filas:asignadas,pendientes:sinAsignar}].map(m=>{
              const filas=[...m.filas].sort((a,b)=>ordenRanking==='vendedor'?nombre(a.vendedor).localeCompare(nombre(b.vendedor),'es'):b[ordenRanking]-a[ordenRanking]||nombre(a.vendedor).localeCompare(nombre(b.vendedor),'es'))
              return <div key={m.titulo} className={tarjeta+' overflow-hidden rounded-xl border'}>
                <h4 className="px-3 py-2 text-sm font-bold">{m.titulo}</h4>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] table-fixed text-xs">
                    <thead><tr>
                      <th className="w-1/4 px-3 py-2 text-left"><button type="button" onClick={()=>setOrdenRanking('vendedor')}>Vendedor {ordenRanking==='vendedor'?'↑':''}</button></th>
                      {columnas.map(n=><th key={n.clave} style={{backgroundColor:n.color,color:'#fff'}} className="px-2 py-2"><button type="button" className="w-full" onClick={()=>setOrdenRanking(n.clave)}>{n.nombre} {ordenRanking===n.clave?'↓':''}</button></th>)}
                    </tr></thead>
                    <tbody>
                      {filas.map(f=><tr key={f.vendedor} className={'border-t '+(oscuro?'border-slate-700':'border-gray-100')}>
                        <td className="px-3 py-1.5 font-medium">{nombre(f.vendedor)}</td>
                        {columnas.map(n=><td key={n.clave} className="px-3 py-1.5"><div className="flex items-center gap-2"><div className={'h-2 flex-1 rounded-full '+(oscuro?'bg-slate-700':'bg-gray-100')}><div className="h-full rounded-full" style={{backgroundColor:n.color,width:(100*f[n.clave]/Math.max(1,...filas.map(x=>x[n.clave])))+'%'}}/></div><span className="w-8 text-right font-semibold tabular-nums">{f[n.clave]||'–'}</span></div></td>)}
                      </tr>)}
                      {!filas.length&&<tr><td colSpan={5} className="p-3 opacity-70">Sin ventas en el período.</td></tr>}
                    </tbody>
                    <tfoot className={'border-t font-bold '+(oscuro?'border-slate-600 bg-slate-900':'border-gray-200 bg-gray-50')}>
                      <tr><td className="px-3 py-2">TOTAL RANKING</td>{columnas.map(n=><td key={n.clave} className="px-3 py-2 text-right tabular-nums">{formato.format(filas.reduce((s,f)=>s+f[n.clave],0))}</td>)}</tr>
                      {m.pendientes.length>0&&<tr className="font-normal opacity-70"><td className="px-3 py-2">Sin responsable L1</td>{columnas.map(n=><td key={n.clave} className="px-3 py-2 text-right">{formato.format(m.pendientes.reduce((s,f)=>s+f[n.clave],0))}</td>)}</tr>}
                    </tfoot>
                  </table>
                </div>
              </div>
            })}
          </div>
          const personas=new Map<string,{nombre:string;propias:number;referidas:number}>()
          for(const [modalidad,filas] of [['propias',ranking],['referidas',asignadas]] as const) for(const f of filas){
            const clave=nombre(f.vendedor)
            const persona=personas.get(clave)??{nombre:clave,propias:0,referidas:0}
            persona[modalidad]+=f[negocioRanking]
            personas.set(clave,persona)
          }
          const filas=[...personas.values()].filter(f=>f.propias+f.referidas>0).sort((a,b)=>(b.propias+b.referidas)-(a.propias+a.referidas)||a.nombre.localeCompare(b.nombre,'es'))
          const max=Math.max(1,...filas.map(f=>f.propias+f.referidas))
          const color=columnas.find(n=>n.clave===negocioRanking)?.color??'#095995'
          return <div className={tarjeta+' rounded-xl border p-3'}>
            <div className="mb-3 flex flex-wrap gap-1">{columnas.map(n=><button key={n.clave} type="button" aria-pressed={negocioRanking===n.clave} onClick={()=>setNegocioRanking(n.clave)} className={'rounded-md border px-3 py-1.5 text-xs font-bold '+(negocioRanking===n.clave?'text-white':control)} style={negocioRanking===n.clave?{backgroundColor:n.color,borderColor:n.color}:undefined}>{n.nombre}</button>)}</div>
            <div className="mb-3 flex gap-4 text-xs"><span><i className="mr-1 inline-block h-2 w-3 rounded" style={{backgroundColor:color}}/>Propias</span><span><i className="mr-1 inline-block h-2 w-3 rounded bg-slate-400"/>Referidas</span></div>
            <div className="space-y-1.5">{filas.map(f=><div key={f.nombre} className="grid grid-cols-[minmax(90px,1fr)_3fr_70px] items-center gap-2 text-xs">
              <span className="font-medium">{f.nombre}</span>
              <div className="flex h-5 overflow-hidden rounded" style={{width:(100*(f.propias+f.referidas)/max)+'%'}}>
                {f.propias>0&&<div title={'Propias: '+f.propias} className="flex items-center justify-center text-white" style={{width:(100*f.propias/(f.propias+f.referidas))+'%',backgroundColor:color}}>{f.propias}</div>}
                {f.referidas>0&&<div title={'Referidas: '+f.referidas} className="flex flex-1 items-center justify-center bg-slate-400 text-slate-950">{f.referidas}</div>}
              </div><span className="text-right font-bold tabular-nums">{f.propias+f.referidas}</span>
            </div>)}</div>
            {!filas.length&&<p className="text-xs opacity-70">Sin ventas en el período.</p>}
            <div className="mt-3 flex flex-wrap justify-between gap-2 border-t pt-2 text-xs font-bold"><span>Propias: {filas.reduce((s,f)=>s+f.propias,0)}</span><span>Referidas: {filas.reduce((s,f)=>s+f.referidas,0)}</span><span>Total ranking: {filas.reduce((s,f)=>s+f.propias+f.referidas,0)}</span></div>
            {sinAsignar.length>0&&<p className="mt-2 text-xs opacity-70">Sin responsable L1 (fuera del ranking): {sinAsignar.reduce((s,f)=>s+f[negocioRanking],0)}</p>}
          </div>
        })())}
      </section>
      {vistaRanking==='ranking'&&<>
      <section className="mt-5">
        <h3 className="text-lg font-bold">Ranking de ventas propias</h3>
        <p className="mb-3 text-xs opacity-70">Vendedores L1 · Ventas concretadas · Período seleccionado</p>
        {grupo && grupo !== 'L1' ? <p className="text-sm opacity-70">Este ranking corresponde exclusivamente al grupo L1.</p> : errorRanking ? <p className="text-sm text-red-500">{errorRanking}</p> : !ranking ? <p className="text-sm opacity-70">Consultando ranking…</p> : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {([{clave:'baf',nombre:'BAF CARGADAS',color:'#095995',fecha:'Fecha gestión'}, {clave:'bafFinalizadas',nombre:'BAF FINALIZADAS',color:'#095995',fecha:'Fecha gestión'}, {clave:'porta',nombre:'PORTABILIDAD',color:'#e7192c',fecha:'Fecha de portación'}, {clave:'ln',nombre:'LÍNEA NUEVA',color:'#7342d7',fecha:'Fecha carga STL'}] as const).map(n => {
              const filas = ranking.filter(f => f[n.clave] > 0).sort((a,b) => b[n.clave]-a[n.clave] || a.vendedor.localeCompare(b.vendedor,'es'))
              const max = Math.max(1,...filas.map(f => f[n.clave]))
              return <div key={n.clave} className={tarjeta + ' overflow-hidden rounded-xl border'}>
                <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm font-bold" style={{backgroundColor:n.color,color:'#fff'}}>
                  <span>{n.nombre}</span><span>{filas.reduce((s,f)=>s+f[n.clave],0)}</span>
                </div>
                <div className="space-y-3 p-3">
                  {!filas.length && <p className="text-sm opacity-70">Sin ventas en el período.</p>}
                  {filas.map((f,i) => <div key={f.vendedor}>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-6 shrink-0 opacity-60">{i+1}.</span>
                      <span className="min-w-0 flex-1 break-words">{f.vendedor.replace(/<[^>]*>/g,'').trim().toUpperCase()}</span>
                      <span className="font-bold tabular-nums">{f[n.clave]}</span>
                    </div>
                    <div className={'ml-8 mt-1 h-2 rounded-full ' + (oscuro?'bg-slate-700':'bg-gray-100')}>
                      <div className="h-full rounded-full" style={{width:(100*f[n.clave]/max)+'%',backgroundColor:n.color}}/>
                    </div>
                  </div>)}
                  <p className="text-[10px] opacity-60">{n.fecha}{n.clave === 'baf' ? ' · Estado CARGADO · SDS informada' : n.clave === 'bafFinalizadas' ? ' · CARGADO · Claro FINALIZADA · SDS informada' : ' · FWA excluido'}</p>
                </div>
              </div>
            })}
          </div>
        )}
      </section>

      <section className="mt-5">
        <h3 className="text-lg font-bold">Ranking de ventas referidas</h3>
        <p className="mb-3 text-xs opacity-70">Responsables de gestión L1 · Vendedor externo a L1 · Período seleccionado</p>
        {errorReferidas ? <p className="text-sm text-red-500">{errorReferidas}</p> : !referidas ? <p className="text-sm opacity-70">Consultando ranking…</p> : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {([{clave:'baf',nombre:'BAF CARGADAS',color:'#095995',fecha:'Fecha gestión'}, {clave:'bafFinalizadas',nombre:'BAF FINALIZADAS',color:'#095995',fecha:'Fecha gestión'}, {clave:'porta',nombre:'PORTABILIDAD',color:'#e7192c',fecha:'Fecha de portación'}, {clave:'ln',nombre:'LÍNEA NUEVA',color:'#7342d7',fecha:'Fecha carga STL'}] as const).map(n => {
              const filas = referidas.filter(f => f[n.clave] > 0 && f.vendedor !== 'SIN RESPONSABLE L1').sort((a,b) => b[n.clave]-a[n.clave] || a.vendedor.localeCompare(b.vendedor,'es'))
              const max = Math.max(1,...filas.map(f => f[n.clave]))
              return <div key={n.clave} className={tarjeta + ' overflow-hidden rounded-xl border'}>
                <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm font-bold" style={{backgroundColor:n.color,color:'#fff'}}>
                  <span>{n.nombre}</span><span>{filas.reduce((s,f)=>s+f[n.clave],0)}</span>
                </div>
                <div className="space-y-3 p-3">
                  {!filas.length && <p className="text-sm opacity-70">Sin ventas en el período.</p>}
                  {filas.map((f,i) => <div key={f.vendedor}>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-6 shrink-0 opacity-60">{i+1}.</span>
                      <span className="min-w-0 flex-1 break-words">{f.vendedor.replace(/<[^>]*>/g,'').trim().toUpperCase()}</span>
                      <span className="font-bold tabular-nums">{f[n.clave]}</span>
                    </div>
                    <div className={'ml-8 mt-1 h-2 rounded-full ' + (oscuro?'bg-slate-700':'bg-gray-100')}>
                      <div className="h-full rounded-full" style={{width:(100*f[n.clave]/max)+'%',backgroundColor:n.color}}/>
                    </div>
                  </div>)}
                  <p className="text-xs opacity-70">Sin responsable L1: {referidas.filter(f=>f.vendedor==='SIN RESPONSABLE L1').reduce((s,f)=>s+f[n.clave],0)}</p>
                  <p className="text-[10px] opacity-60">{n.fecha}{n.clave === 'baf' ? ' · Estado CARGADO · SDS informada' : n.clave === 'bafFinalizadas' ? ' · CARGADO · Claro FINALIZADA · SDS informada' : ' · FWA excluido'}</p>
                </div>
              </div>
            })}
          </div>
        )}
      </section>

      </>}
      <details className="mt-5">
        <summary className="cursor-pointer text-sm font-semibold">Ventas ingresadas · Información complementaria</summary>
        <div className="mt-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold">
          Ventas ingresadas
        </h3>

        <span className="text-xs opacity-70">
          {desde.split('-').reverse().join('/')}
          {' – '}
          {hasta.split('-').reverse().join('/')}
        </span>
      </div>

      {cargando && (
        <p className="mb-3 text-sm opacity-70">
          Consultando ventas ingresadas...
        </p>
      )}

      {error && (
        <p role="alert" className="mb-3 rounded-lg border border-red-400 p-3 text-sm text-red-500">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">

        {negocios.map(n => {
          const cantidad = datos?.totales[n.clave]

          const valores = datos
            ? n.clave === 'total_movil'
              ? {
                  PORTA: datos.totales.porta,
                  LN: datos.totales.ln,
                }
              : datos.composicion[n.clave]
            : null

          return (
            <div
              key={n.clave}
              className={
                tarjeta +
                ' overflow-hidden rounded-xl border'
              }
            >

              <div
                className="px-3 py-2 text-center text-xs font-bold"
                style={
                  tema === 'clasico'
                    ? {
                        backgroundColor: n.color,
                        color: '#ffffff',
                      }
                    : {
                        borderBottom: `3px solid ${n.color}`,
                      }
                }
              >
                {n.nombre}
              </div>

              <div className="p-3">

                {tema === 'instrumental' ? (
                  <MedidorInstrumental
                    actual={cantidad ?? null}
                    objetivo={objetivoNegocio(n.clave)}
                    estadoObjetivo={
                      grupo || vendedor
                        ? 'Sin objetivo'
                        : !mesObjetivos
                          ? 'Período multimensual'
                          : cargandoObjetivos
                            ? 'Consultando...'
                            : errorObjetivos
                              ? 'Error de consulta'
                              : 'Sin objetivo'
                    }
                    color={n.color}
                    oscuro={oscuro}
                  />
                ) : (
                  <div className="text-4xl font-bold tabular-nums">
                    {cantidad === undefined
                      ? '—'
                      : formato.format(cantidad)}
                  </div>
                )}


                {tema === 'instrumental' &&
                  cantidad !== undefined &&
                  anterior !== null && (() => {
                    const previo = anterior.totales[n.clave]
                    const diferencia = cantidad - previo
                    const variacion = previo > 0
                      ? diferencia / previo * 100
                      : null

                    return (
                      <div className={
                        'mt-1 text-center text-xs font-semibold ' +
                        (diferencia > 0
                          ? 'text-green-600'
                          : diferencia < 0
                            ? 'text-red-500'
                            : 'opacity-60')
                      }>
                        {diferencia > 0 ? '↑ ' :
                          diferencia < 0 ? '↓ ' : ''}
                        {variacion !== null
                          ? (variacion > 0 ? '+' : '') +
                            variacion.toLocaleString('es-AR', {
                              maximumFractionDigits: 1,
                            }) + '%'
                          : previo === 0 && cantidad === 0
                            ? 'Sin variación'
                            : 'Sin base anterior'}
                      </div>
                    )
                  })()}

                {valores && (
                  <Composicion
                    valores={valores}
                    oscuro={oscuro}
                  />
                )}

                <p className="mt-2 text-[10px] opacity-60">
                  Fecha de ingreso
                </p>

              </div>
            </div>
          )
        })}
      </div>

        </div>
      </details>

      <p className="mt-4 text-xs opacity-60">
        Fuente: operaciones y productos registrados en PGL.
        FWA se contabiliza independientemente de Línea Nueva.
      </p>
    </div>
  )
}
