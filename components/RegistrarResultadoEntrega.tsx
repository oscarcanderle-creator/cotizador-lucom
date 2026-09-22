'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Motivo = {
  id: number
  codigo: string
  nombre: string
  requiere_reingreso: boolean
  permite_reasignacion: boolean
}

type Props = {
  intentoId: number
  codigoGestion: string
  motivos: Motivo[]
}

export default function RegistrarResultadoEntrega({
  intentoId,
  codigoGestion,
  motivos,
}: Props) {
  const router = useRouter()

  const [modo, setModo] = useState<'ENTREGADO' | 'NO_ENTREGADO' | null>(null)
  const [motivoId, setMotivoId] = useState('')
  const [observacion, setObservacion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  function cancelar() {
    if (enviando) return

    setModo(null)
    setMotivoId('')
    setObservacion('')
    setError('')
  }

  async function registrar(resultado: 'ENTREGADO' | 'NO_ENTREGADO') {
    setError('')

    if (resultado === 'NO_ENTREGADO' && !motivoId) {
      setError('Seleccioná el motivo de la no entrega.')
      return
    }

    const mensaje =
      resultado === 'ENTREGADO'
        ? `¿Confirmás que ${codigoGestion} fue entregada correctamente?`
        : `¿Confirmás que ${codigoGestion} NO fue entregada?`

    if (!window.confirm(mensaje)) {
      return
    }

    setEnviando(true)

    try {
      const response = await fetch('/api/cadeteria/resultado', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          intentoId,
          resultado,
          motivoNoEntregaId:
            resultado === 'NO_ENTREGADO' ? Number(motivoId) : null,
          observacion:
            resultado === 'NO_ENTREGADO'
              ? observacion.trim() || null
              : null,

          // Momento real de la acción en el dispositivo.
          fechaResultado: new Date().toISOString(),
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          data?.error || 'No se pudo registrar el resultado de la entrega.'
        )
      }

      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo registrar el resultado de la entrega.'
      )
    } finally {
      setEnviando(false)
    }
  }

  if (modo === null) {
    return (
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setModo('ENTREGADO')}
          className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
        >
          ENTREGADO
        </button>

        <button
          type="button"
          onClick={() => setModo('NO_ENTREGADO')}
          className="rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700"
        >
          NO ENTREGADO
        </button>
      </div>
    )
  }

  if (modo === 'ENTREGADO') {
    return (
      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="font-semibold text-slate-900">
          Confirmar entrega
        </div>

        <p className="mt-1 text-sm text-slate-600">
          Confirmá solamente cuando el chip haya sido entregado físicamente.
        </p>

        {error && (
          <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={enviando}
            onClick={() => registrar('ENTREGADO')}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando ? 'Registrando...' : 'Confirmar ENTREGADO'}
          </button>

          <button
            type="button"
            disabled={enviando}
            onClick={cancelar}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-5 rounded-xl border border-red-200 bg-red-50/40 p-4">
      <div className="font-semibold text-slate-900">
        Registrar no entrega
      </div>

      <div className="mt-4">
        <label
          htmlFor={`motivo_${intentoId}`}
          className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          Motivo
        </label>

        <select
          id={`motivo_${intentoId}`}
          value={motivoId}
          onChange={(event) => setMotivoId(event.target.value)}
          disabled={enviando}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        >
          <option value="">Seleccionar motivo</option>

          {motivos.map((motivo) => (
            <option key={motivo.id} value={motivo.id}>
              {motivo.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <label
          htmlFor={`observacion_${intentoId}`}
          className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          Observación
        </label>

        <textarea
          id={`observacion_${intentoId}`}
          value={observacion}
          onChange={(event) => setObservacion(event.target.value)}
          disabled={enviando}
          rows={3}
          placeholder="Detalle adicional de la visita..."
          className="mt-1 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        />
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-100 p-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={enviando}
          onClick={() => registrar('NO_ENTREGADO')}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? 'Registrando...' : 'Confirmar NO ENTREGADO'}
        </button>

        <button
          type="button"
          disabled={enviando}
          onClick={cancelar}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
