'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Motivo = { id: number; codigo: string; nombre: string; requiere_reingreso: boolean; permite_reasignacion: boolean }
type Props = { intentoId: number; codigoGestion: string; motivos: Motivo[] }
type Resultado = 'ENTREGADO' | 'NO_ENTREGADO'
type Modalidad = 'TITULAR' | 'TERCERO' | 'BUZON' | 'BAJO_PUERTA' | 'CASILLA_GAS' | 'COMERCIO'
type Posicion = { latitud: number; longitud: number; precision: number; capturadaEn: string }
const MODALIDADES: { value: Modalidad; label: string }[] = [
  { value: 'TITULAR', label: 'En mano al titular' },
  { value: 'TERCERO', label: 'En mano a otra persona' },
  { value: 'BUZON', label: 'Depositado en buzón' },
  { value: 'BAJO_PUERTA', label: 'Depositado bajo puerta' },
  { value: 'CASILLA_GAS', label: 'Depositado en casilla de gas' },
  { value: 'COMERCIO', label: 'Entregado en comercio autorizado' },
]

function obtenerPosicion(): Promise<Posicion> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('El navegador no permite obtener la ubicación.'))
    navigator.geolocation.getCurrentPosition(
      ({ coords, timestamp }) => resolve({ latitud: coords.latitude, longitud: coords.longitude, precision: coords.accuracy, capturadaEn: new Date(timestamp).toISOString() }),
      error => reject(new Error(error.code === 1 ? 'Debés autorizar el acceso a la ubicación.' : 'No se pudo obtener el GPS. Verificá los permisos y la señal.')),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    )
  })
}

export default function RegistrarResultadoEntrega({ intentoId, codigoGestion, motivos }: Props) {
  const router = useRouter()
  const [modo, setModo] = useState<Resultado | null>(null)
  const [modalidad, setModalidad] = useState<Modalidad>('TITULAR')
  const [motivoId, setMotivoId] = useState('')
  const [observacion, setObservacion] = useState('')
  const [referencia, setReferencia] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [paso, setPaso] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function cancelar() {
    if (enviando) return
    setModo(null); setMotivoId(''); setObservacion(''); setReferencia(''); setFoto(null); setError(''); setPaso('')
    if (fileRef.current) fileRef.current.value = ''
  }

  async function registrar(resultado: Resultado) {
    setError('')
    if (resultado === 'NO_ENTREGADO' && !motivoId) return setError('Seleccioná el motivo de la no entrega.')
    if (resultado === 'ENTREGADO' && !foto) return setError('La fotografía del comprobante es obligatoria.')
    if (resultado === 'ENTREGADO' && (modalidad === 'TERCERO' || modalidad === 'COMERCIO') && !referencia.trim()) {
      return setError('Identificá a quien recibió el chip o el comercio autorizado.')
    }
    if (modalidad === 'COMERCIO' && resultado === 'ENTREGADO' && !observacion.trim()) {
      return setError('Indicá en observaciones la autorización previa del cliente que consta en la venta.')
    }
    if (!window.confirm(`¿Confirmás ${resultado === 'ENTREGADO' ? 'la entrega' : 'el intento sin entrega'} de ${codigoGestion}?`)) return
    setEnviando(true)
    try {
      setPaso('Obteniendo ubicación GPS...')
      const posicion = await obtenerPosicion()
      setPaso('Registrando evidencia...')
      const form = new FormData()
      form.set('intentoId', String(intentoId))
      form.set('resultado', resultado)
      form.set('fechaResultado', new Date().toISOString())
      form.set('latitud', String(posicion.latitud))
      form.set('longitud', String(posicion.longitud))
      form.set('precision', String(posicion.precision))
      form.set('fechaGps', posicion.capturadaEn)
      if (resultado === 'ENTREGADO') {
        form.set('modalidad', modalidad)
        form.set('foto', foto!)
        form.set('referencia', referencia.trim())
        form.set('observacion', observacion.trim())
      } else {
        form.set('motivoNoEntregaId', motivoId)
        form.set('observacion', observacion.trim())
        if (foto) form.set('foto', foto)
      }
      const response = await fetch('/api/cadeteria/resultado', { method: 'POST', body: form })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'No se pudo registrar el resultado.')
      cancelar()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar el resultado.')
    } finally { setEnviando(false); setPaso('') }
  }

  if (modo === null) return <div className="mt-5 grid gap-3 sm:grid-cols-2">
    <button type="button" onClick={() => setModo('ENTREGADO')} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">ENTREGADO</button>
    <button type="button" onClick={() => setModo('NO_ENTREGADO')} className="rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white">NO ENTREGADO</button>
  </div>

  return <div className="mt-5 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <h3 className="font-semibold text-slate-900">{modo === 'ENTREGADO' ? 'Confirmar entrega' : 'Registrar intento sin entrega'}</h3>
    <p className="text-sm text-slate-600">Se registrará una nueva ubicación GPS al confirmar. El GPS es evidencia de presencia, no una prueba absoluta de entrega.</p>
    {modo === 'ENTREGADO' ? <>
      <label className="block text-sm font-semibold text-slate-700">Modalidad de entrega
        <select value={modalidad} onChange={e => setModalidad(e.target.value as Modalidad)} disabled={enviando} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900">
          {MODALIDADES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </label>
      {(modalidad === 'TERCERO' || modalidad === 'COMERCIO') && <label className="block text-sm font-semibold text-slate-700">{modalidad === 'TERCERO' ? 'Nombre de quien recibe' : 'Nombre y dirección del comercio'}
        <input value={referencia} onChange={e => setReferencia(e.target.value)} disabled={enviando} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" />
      </label>}
      {modalidad === 'COMERCIO' && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Solo está permitido cuando el cliente lo autorizó y quedó asentado en las observaciones de la venta. Esa autorización deberá verificarse desde Logística.</p>}
    </> : <label className="block text-sm font-semibold text-slate-700">Motivo de no entrega
      <select value={motivoId} onChange={e => setMotivoId(e.target.value)} disabled={enviando} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900">
        <option value="">Seleccionar motivo</option>
        {motivos.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
      </select>
    </label>}
    <label className="block text-sm font-semibold text-slate-700">Fotografía {modo === 'ENTREGADO' ? '(obligatoria)' : '(opcional)'}
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" disabled={enviando} onChange={e => setFoto(e.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm text-slate-700" />
      <span className="mt-1 block text-xs font-normal text-slate-500">Fotografiá el chip o sobre en el lugar donde quedó depositado, o el comprobante de recepción. Máximo 8 MB.</span>
    </label>
    <label className="block text-sm font-semibold text-slate-700">Observaciones {modalidad === 'COMERCIO' && modo === 'ENTREGADO' ? '(obligatorias)' : '(opcionales)'}
      <textarea value={observacion} onChange={e => setObservacion(e.target.value)} disabled={enviando} rows={3} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" placeholder="Detalle de la visita, indicaciones o autorización del cliente..." />
    </label>
    {error && <div role="alert" className="rounded-lg bg-red-100 p-3 text-sm font-medium text-red-700">{error}</div>}
    {paso && <p className="text-sm text-slate-600" aria-live="polite">{paso}</p>}
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={enviando} onClick={() => registrar(modo)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{enviando ? 'Registrando...' : `Confirmar ${modo.replace('_', ' ')}`}</button>
      <button type="button" disabled={enviando} onClick={cancelar} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Cancelar</button>
    </div>
  </div>
}
