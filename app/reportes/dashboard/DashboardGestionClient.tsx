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
        {actual === null ? '—' : formato.format(actual)}
      </text>
      <text
        x="80" y="82"
        textAnchor="middle"
        fontSize="11"
        fill={oscuro ? '#94a3b8' : '#64748b'}
      >
        {anterior !== null
          ? 'Ant. ' + formato.format(anterior)
          : 'Sin comparación'}
      </text>
    </svg>
  )
}

export default function DashboardGestionClient({
  oscuro,
}: {
  oscuro: boolean
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
                    anterior={anterior?.totales[n.clave] ?? null}
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

      <p className="mt-4 text-xs opacity-60">
        Fuente: operaciones y productos registrados en PGL.
        FWA se contabiliza independientemente de Línea Nueva.
      </p>
    </div>
  )
}
