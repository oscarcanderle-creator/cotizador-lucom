'use client'

import { useEffect, useState } from 'react'

type Tema = 'ejecutivo' | 'oscuro' | 'compacto'
type Indicador = 'ingresadas' | 'cargadas' | 'finalizadas' | 'canceladas'
type Categoria = '2PLAY' | '3PLAY' | 'AÑADIR TV' | 'SIN CLASIFICAR'
type Respuesta = {
  desde: string
  hasta: string
  totales: Record<Indicador, number>
  categorias: Record<Indicador, Record<Categoria, number>>
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

export default function DashboardClient() {
  const [tema, setTema] = useState<Tema>('ejecutivo')
  const [periodo, setPeriodo] = useState('mes')
  const [canal, setCanal] = useState('call')
  const [datos, setDatos] = useState<Respuesta | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (canal !== 'call') {
      setDatos(null)
      setError('')
      setCargando(false)
      return
    }
    const controlador = new AbortController()
    const { desde, hasta } = rangoPeriodo(periodo)
    setCargando(true)
    setError('')
    setDatos(null)
    fetch(`/api/dashboard/baf?desde=${desde}&hasta=${hasta}`, {
      signal: controlador.signal,
      cache: 'no-store',
    })
      .then(async respuesta => {
        const json = await respuesta.json()
        if (!respuesta.ok) throw new Error(json.error || 'No se pudieron recuperar los indicadores.')
        return json as Respuesta
      })
      .then(setDatos)
      .catch((err: unknown) => {
        if (!controlador.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Error al consultar los indicadores.')
        }
      })
      .finally(() => { if (!controlador.signal.aborted) setCargando(false) })
    return () => controlador.abort()
  }, [periodo, canal])

  const oscuro = tema === 'oscuro'
  const compacto = tema === 'compacto'
  const fondo = oscuro ? 'bg-[#101827] text-white' : 'bg-gray-50 text-gray-900'
  const tarjeta = oscuro
    ? 'border-slate-700 bg-[#1b2638] text-white'
    : 'border-gray-200 bg-white text-gray-900'
  const secundario = oscuro ? 'text-slate-300' : 'text-gray-500'
  const control = oscuro
    ? 'border-slate-600 bg-slate-800 text-white'
    : 'border-gray-300 bg-white text-gray-900'

  const canales = [
    { valor: 'call', etiqueta: 'CALL Lucom' },
    { valor: 'todos', etiqueta: 'Todos los canales (pendiente)' },
    { valor: 'pdv', etiqueta: 'Puntos de Venta (pendiente)' },
  ]

  return (
    <section className={`${fondo} rounded-2xl p-4 sm:p-6`}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Panel de resultados</h2>
          <p className={`mt-1 text-sm ${secundario}`}>
            Indicadores comerciales y evolución de ventas.
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs ${tarjeta}`}>
          Módulo CALL · BAF
        </span>
      </div>

      <div className={`mb-6 grid grid-cols-1 gap-3 rounded-xl border p-4 sm:grid-cols-2 xl:grid-cols-4 ${tarjeta}`}>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Período
          <select value={periodo} onChange={e => setPeriodo(e.target.value)} className={`rounded-lg border px-3 py-2 ${control}`}>
            <option value="hoy">Hoy</option>
            <option value="semana">Esta semana</option>
            <option value="mes">Este mes</option>
            <option value="anterior">Mes anterior</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Canal
          <select value={canal} onChange={e => setCanal(e.target.value)} className={`rounded-lg border px-3 py-2 ${control}`}>
            {canales.map(item => <option key={item.valor} value={item.valor}>{item.etiqueta}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Grupo / Punto de venta
          <select disabled className={`rounded-lg border px-3 py-2 opacity-60 ${control}`}>
            <option>Disponible en la próxima etapa</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Tema visual
          <select value={tema} onChange={e => setTema(e.target.value as Tema)} className={`rounded-lg border px-3 py-2 ${control}`}>
            <option value="ejecutivo">Ejecutivo</option>
            <option value="oscuro">Oscuro</option>
            <option value="compacto">Compacto</option>
          </select>
        </label>
      </div>

      {canal !== 'call' && (
        <div className={`mb-4 rounded-xl border p-4 text-sm ${tarjeta}`}>
          La consolidación de CALL y Puntos de Venta se incorporará cuando estén conectados los reportes ACTIVACIONES, CATER y 1175.
        </div>
      )}
      {error && <p role="alert" className="mb-4 text-sm font-medium text-red-600">{error}</p>}
      {cargando && <p className={`mb-4 text-sm ${secundario}`}>Consultando resultados BAF...</p>}

      {canal === 'call' && (
        <>
          <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 ${compacto ? 'mb-4' : 'mb-6'}`}>
            {indicadores.map(indicador => (
              <div key={indicador.clave} className={`rounded-xl border ${compacto ? 'p-3' : 'p-5'} ${tarjeta}`}>
                <div className={`text-sm font-semibold ${secundario}`}>{indicador.titulo}</div>
                <div className={`font-bold ${compacto ? 'my-2 text-3xl' : 'my-4 text-4xl'}`}>
                  {datos ? formatoNumero.format(datos.totales[indicador.clave]) : '—'}
                </div>
                <p className={`text-xs ${secundario}`}>{indicador.descripcion}</p>
              </div>
            ))}
          </div>
          <div className={`mb-6 rounded-xl border p-5 ${tarjeta}`}>
            <h3 className="font-bold">Composición BAF</h3>
            <p className={`mt-1 text-xs ${secundario}`}>Desglose por indicador. Cada resultado corresponde a su propia fecha comercial.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className={`border-b ${oscuro ? 'border-slate-600' : 'border-gray-200'}`}>
                  <th className="py-2 pr-4">Indicador</th>
                  {categorias.map(cat => <th className="px-3 py-2 text-right" key={cat}>{cat}</th>)}
                </tr></thead>
                <tbody>
                  {indicadores.map(indicador => (
                    <tr key={indicador.clave} className={`border-b ${oscuro ? 'border-slate-700' : 'border-gray-100'}`}>
                      <td className="py-3 pr-4 font-medium">{indicador.titulo}</td>
                      {categorias.map(cat => <td className="px-3 py-3 text-right tabular-nums" key={cat}>
                        {datos ? formatoNumero.format(datos.categorias[indicador.clave][cat]) : '—'}
                      </td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className={`grid grid-cols-1 gap-4 lg:grid-cols-3 ${compacto ? 'mb-4' : 'mb-6'}`}>
        <div className={`rounded-xl border p-5 lg:col-span-2 ${tarjeta}`}>
          <h3 className="font-bold">Evolución de ventas</h3>
          <div className={`mt-4 flex ${compacto ? 'h-40' : 'h-64'} items-center justify-center rounded-lg border border-dashed ${oscuro ? 'border-slate-600' : 'border-gray-200'}`}>
            <span className={`text-sm ${secundario}`}>Gráfico pendiente de conexión</span>
          </div>
        </div>
        <div className={`rounded-xl border p-5 ${tarjeta}`}>
          <h3 className="font-bold">Distribución por canal</h3>
          <div className={`mt-4 flex ${compacto ? 'h-40' : 'h-64'} items-center justify-center rounded-lg border border-dashed ${oscuro ? 'border-slate-600' : 'border-gray-200'}`}>
            <span className={`text-center text-sm ${secundario}`}>Pendiente de integración con reportes PDV</span>
          </div>
        </div>
      </div>
      <div className={`rounded-xl border p-5 ${tarjeta}`}>
        <h3 className="font-bold">Análisis detallado</h3>
        <p className={`mt-2 text-sm ${secundario}`}>La navegación por grupo y vendedor se incorporará respetando los permisos comerciales del usuario.</p>
        <div className={`mt-4 rounded-lg border border-dashed p-5 text-center text-sm ${oscuro ? 'border-slate-600' : 'border-gray-200'} ${secundario}`}>
          Información pendiente de conexión
        </div>
      </div>
      <p className={`mt-4 text-xs ${secundario}`}>
        Datos de prueba. Los indicadores CARGADAS sin fecha de gestión no se asignan a un período.
      </p>
    </section>
  )
}
