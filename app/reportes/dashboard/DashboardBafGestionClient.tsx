'use client'

import { useEffect, useState } from 'react'

type Tema = 'clasico' | 'ejecutivo' | 'instrumental'
type Historico = { periodo: string; preventas_ok: number; finalizadas: number }
type Respuesta = {
  periodo: string
  provisional: boolean
  fija: {
    preventas_ok: number
    finalizadas: number
    canceladas: number
    backlog: number
    porcentaje_canceladas: number | null
  }
  historico: Historico[]
  motivos: { motivo: string; cantidad: number }[]
  control: {
    registros: number
    sin_estado: number
    cierres_sin_fecha: number
    excluidas: { clasificacion: string; cantidad: number }[]
  }
}
const nf = new Intl.NumberFormat('es-AR')
const mesActual = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit',
}).format(new Date()).slice(0, 7)
function etiquetaMes(periodo: string) {
  const fecha = new Date(periodo + (periodo.length === 7 ? '-01' : '') + 'T12:00:00Z')
  return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(fecha)
}
function clasificacion(p: number | null) {
  if (p === null) return { texto: 'Sin datos', color: '#64748b' }
  if (p < 7) return { texto: 'Verde · menor a 7%', color: '#16a34a' }
  if (p < 10) return { texto: 'Amarillo · 7 a 9,99%', color: '#eab308' }
  if (p < 13) return { texto: 'Naranja · 10 a 12,99%', color: '#f97316' }
  return { texto: 'Rojo · 13% o más', color: '#dc2626' }
}
function MedidorCancelaciones({ valor }: { valor: number | null }) {
  const t = Math.max(0, Math.min(30, 30 - (valor ?? 30))) / 30
  const angulo = Math.PI * t
  const tramos = [
    { inicio: 0, fin: 17, color: '#dc2626' },
    { inicio: 17, fin: 20, color: '#f97316' },
    { inicio: 20, fin: 23, color: '#eab308' },
    { inicio: 23, fin: 30, color: '#16a34a' },
  ]
  const punto = (n: number, r: number) => {
    const a = Math.PI * n / 30
    return [120 - r * Math.cos(a), 108 - r * Math.sin(a)]
  }
  return (
    <svg viewBox="0 0 240 154" className="mx-auto w-full max-w-[330px]" role="img"
      aria-label={valor === null ? 'Sin porcentaje de cancelaciones' : 'Cancelaciones: ' + valor.toFixed(2) + '%'}>
      {tramos.map(tramo => {
        const [x1, y1] = punto(tramo.inicio, 87)
        const [x2, y2] = punto(tramo.fin, 87)
        return <path key={tramo.inicio} d={`M ${x1} ${y1} A 87 87 0 0 1 ${x2} ${y2}`}
          stroke={tramo.color} strokeWidth="16" fill="none" />
      })}
      {valor !== null && <>
        <line x1="120" y1="108" x2={120 - 76 * Math.cos(angulo)}
          y2={108 - 76 * Math.sin(angulo)}
          stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <circle cx="120" cy="108" r="6" fill="currentColor" />
      </>}
      <text x="20" y="130" fill="currentColor" fontSize="12">30%</text>
      <text x="220" y="130" textAnchor="end" fill="currentColor" fontSize="12">0%</text>
      <text x="120" y="150" textAnchor="middle" fontSize="26" fontWeight="bold"
        fill={clasificacion(valor).color}>{valor === null ? '—' : valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'}</text>
    </svg>
  )
}
export default function DashboardBafGestionClient({ oscuro }: { oscuro: boolean }) {
  const [periodo, setPeriodo] = useState(mesActual)
  const [tema, setTema] = useState<Tema>('clasico')
  const [datos, setDatos] = useState<Respuesta | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [verControl, setVerControl] = useState(false)
  useEffect(() => {
    const controlador = new AbortController()
    setCargando(true)
    setError('')
    fetch('/api/dashboard/gestion-baf?periodo=' + encodeURIComponent(periodo), {
      signal: controlador.signal, cache: 'no-store',
    })
      .then(async res => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Error consultando Gestión BAF.')
        return json as Respuesta
      })
      .then(setDatos)
      .catch(err => { if (err.name !== 'AbortError') { setDatos(null); setError(err.message) } })
      .finally(() => { if (!controlador.signal.aborted) setCargando(false) })
    return () => controlador.abort()
  }, [periodo])

  const panel = oscuro ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
  const tenue = oscuro ? 'text-slate-400' : 'text-slate-500'
  const accent = tema === 'instrumental' ? '#7c3aed' : tema === 'ejecutivo' ? '#0d9488' : '#2563eb'
  const f = datos?.fija
  const historico = datos?.historico ?? []
  const maxGrafico = Math.max(1, ...historico.flatMap(m => [m.preventas_ok, m.finalizadas]))
  const estado = clasificacion(f?.porcentaje_canceladas ?? null)
  const excluidas = datos?.control.excluidas.reduce((s, x) => s + x.cantidad, 0) ?? 0
  const tarjeta = (nombre: string, valor: number | undefined, nota: string, color?: string) => (
    <div className={'rounded-xl border p-4 ' + panel}>
      <div className={'text-xs font-bold uppercase tracking-wide ' + tenue}>{nombre}</div>
      <div className="mt-2 text-3xl font-bold tabular-nums" style={{ color: color ?? accent }}>
        {valor === undefined ? '—' : nf.format(valor)}
      </div>
      <div className={'mt-2 text-xs ' + tenue}>{nota}</div>
    </div>
  )
  return (
    <section className={'space-y-5 p-4 sm:p-6 ' + (oscuro ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800')}>
      <div className={'flex flex-wrap items-end justify-between gap-3 rounded-xl border p-4 ' + panel}>
        <div>
          <h3 className="text-xl font-bold">Gestión BAF · Agencia</h3>
          <p className={'mt-1 text-xs ' + tenue}>2PLAY y 3PLAY · CALL + PDV · AÑADIR TV excluido</p>
          <p className={'mt-1 text-xs ' + tenue}>Origen: Reporte FIJA importado en PGL</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Mes de análisis
            <input type="month" min="2026-01" value={periodo}
              onChange={e => setPeriodo(e.target.value)}
              className={'rounded-lg border px-3 py-2 text-sm ' + (oscuro ? 'border-slate-600 bg-slate-800 text-white' : 'border-slate-300 bg-white')} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Tema
            <select value={tema} onChange={e => setTema(e.target.value as Tema)}
              className={'rounded-lg border px-3 py-2 text-sm ' + (oscuro ? 'border-slate-600 bg-slate-800 text-white' : 'border-slate-300 bg-white')}>
              <option value="clasico">Clásico</option>
              <option value="ejecutivo">Ejecutivo</option>
              <option value="instrumental">Instrumental</option>
            </select>
          </label>
        </div>
      </div>
      <p className={'rounded-lg border px-4 py-3 text-sm ' + (oscuro ? 'border-amber-700 bg-amber-950/40 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-900')}>
        Información operativa provisional. No constituye cierre oficial para comisiones; el cierre mensual auditado aún no está implementado.
      </p>
      {cargando && <p role="status" className="text-sm">Consultando Reporte FIJA…</p>}
      {error && <p role="alert" className="rounded-lg border border-red-300 p-3 text-sm text-red-600">{error}</p>}
      {datos && <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className={'rounded-xl border p-4 lg:col-span-2 ' + panel}>
            <div className={'text-xs font-bold uppercase tracking-wide ' + tenue}>Indicador de cancelaciones · {etiquetaMes(periodo)}</div>
            <MedidorCancelaciones valor={f?.porcentaje_canceladas ?? null} />
            <div className="text-center text-sm font-bold" style={{ color: estado.color }}>{estado.texto}</div>
            <p className={'mt-1 text-center text-xs ' + tenue}>Canceladas / (Finalizadas + Canceladas) · fecha de instalación</p>
          </div>
          {tarjeta('Backlog · asignadas', f?.backlog, 'Total pendiente actual, sin filtro por fecha', '#d97706')}
          {tarjeta('Preventas OK', f?.preventas_ok, 'Fecha de carga del mes seleccionado')}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {tarjeta('Finalizadas', f?.finalizadas, 'Fecha de instalación del mes', '#16a34a')}
          {tarjeta('Canceladas', f?.canceladas, 'Fecha de instalación del mes', '#dc2626')}
          {tarjeta('Cierres totales', f ? f.finalizadas + f.canceladas : undefined, 'Finalizadas + Canceladas')}
        </div>
        <div className={'rounded-xl border p-4 ' + panel}>
          <h4 className="font-bold">Evolución histórica BAF · 2026</h4>
          <p className={'mt-1 text-xs ' + tenue}>Histórico aportado por la agencia: Preventas OK y Finalizadas. No se reconstruyen cancelaciones históricas.</p>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {historico.map(m => {
              const mes = m.periodo.slice(0, 7)
              return <button key={m.periodo} type="button" onClick={() => setPeriodo(mes)}
                title={`${etiquetaMes(mes)} · Preventas ${m.preventas_ok} · Finalizadas ${m.finalizadas}`}
                className={'min-w-[58px] flex-1 rounded-lg border px-1 pb-2 pt-3 transition hover:ring-2 ' +
                  (mes === periodo ? 'border-blue-500 ring-1 ring-blue-500' : (oscuro ? 'border-slate-700' : 'border-slate-200'))}>
                <div className="flex h-28 items-end justify-center gap-1">
                  <span className="w-4 rounded-t" style={{ height: (m.preventas_ok / maxGrafico * 100) + '%', backgroundColor: accent }} />
                  <span className="w-4 rounded-t bg-green-600" style={{ height: (m.finalizadas / maxGrafico * 100) + '%' }} />
                </div>
                <div className="mt-2 text-center text-[11px] font-semibold">{mes.slice(5)}</div>
              </button>
            })}
          </div>
          <div className={'mt-1 flex flex-wrap gap-4 text-xs ' + tenue}>
            <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: accent }} />Preventas OK</span>
            <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-green-600" />Finalizadas</span>
            <span>Seleccioná un mes para consultar el detalle FIJA.</span>
          </div>
          {(() => {
            const h = historico.find(x => x.periodo.slice(0, 7) === periodo)
            if (!h) return null
            return <div className={'mt-3 rounded-lg border p-3 text-sm ' + (oscuro ? 'border-slate-700' : 'border-slate-200')}>
              {etiquetaMes(periodo)} · Histórico: <strong>{nf.format(h.preventas_ok)}</strong> preventas y <strong>{nf.format(h.finalizadas)}</strong> finalizadas.
              {f && h.finalizadas !== f.finalizadas && <p className={'mt-1 text-xs ' + tenue}>El valor histórico no coincide con el estado actual del reporte FIJA. Se mantienen ambos sin reemplazar ninguno.</p>}
            </div>
          })()}
        </div>
        <div className={'rounded-xl border p-4 ' + panel}>
          <h4 className="font-bold">Motivos de cancelación · {etiquetaMes(periodo)}</h4>
          <p className={'mb-4 mt-1 text-xs ' + tenue}>Clasificación de responsabilidades pendiente de validación.</p>
          {!datos.motivos.length && <p className={'text-sm ' + tenue}>Sin cancelaciones registradas para este período.</p>}
          <div className="space-y-3">
            {datos.motivos.map(item => (
              <div key={item.motivo}>
                <div className="flex justify-between gap-3 text-xs"><span>{item.motivo}</span><strong>{nf.format(item.cantidad)}</strong></div>
                <div className={'mt-1 h-2 overflow-hidden rounded ' + (oscuro ? 'bg-slate-700' : 'bg-slate-100')}>
                  <div className="h-full rounded bg-red-500" style={{ width: (item.cantidad / Math.max(1, f?.canceladas ?? 0) * 100) + '%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={'rounded-xl border p-4 ' + panel}>
          <button type="button" aria-expanded={verControl} onClick={() => setVerControl(v => !v)}
            className="text-sm font-semibold underline underline-offset-4">
            {verControl ? 'Ocultar' : 'Mostrar'} controles de integridad de FIJA
          </button>
          {verControl && <div className="mt-3 space-y-2 text-sm">
            <p>Registros BAF admitidos: {nf.format(datos.control.registros)}</p>
            <p>Sin estado: {nf.format(datos.control.sin_estado)}</p>
            <p>Cierres sin fecha de instalación: {nf.format(datos.control.cierres_sin_fecha)}</p>
            <p>Registros con promoción/SDS fuera del universo aprobado: {nf.format(excluidas)}</p>
            {datos.control.excluidas.map(x => <p key={x.clasificacion} className={'pl-3 text-xs ' + tenue}>{x.clasificacion}: {nf.format(x.cantidad)}</p>)}
          </div>}
        </div>
      </div>}
      <p className={'text-xs ' + tenue}>Pendientes de integración: Ingresadas, Cargadas, Desvío, rankings, responsabilidades y cierre mensual auditado.</p>
    </section>
  )
}
