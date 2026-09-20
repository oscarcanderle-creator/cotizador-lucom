'use client'

import { useState } from 'react'

type Props = {
  operacionId: string
  obsActual: string | null
  caminanteActual: string | null
}

type Resultado = {
  ok?: boolean
  resultado?: string
  id_psr?: string | null
  coincidencias?: number
  obs?: string | null
  caminante?: string | null
  error?: string
}

export default function ResolverCaminantePSR({
  operacionId,
  obsActual,
  caminanteActual,
}: Props) {
  const [editandoObs, setEditandoObs] = useState(false)
  const [obs, setObs] = useState(obsActual || '')
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function resolver(obsNueva: string | null) {
    if (procesando) return

    setProcesando(true)
    setMensaje(null)
    setError(null)

    try {
      const response = await fetch('/api/gestion/caminante-psr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operacion_id: operacionId,
          obs: obsNueva,
        }),
      })

      const data = (await response.json().catch(() => null)) as Resultado | null

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'No se pudo resolver el Caminante contra el padrón ITEC.'
        )
      }

      if (data?.resultado === 'RESUELTO') {
        setMensaje(
          `Caminante resuelto: ${data.caminante || '—'}`
        )
        setEditandoObs(false)
      } else if (data?.resultado === 'COINCIDENCIA_AMBIGUA') {
        setError(
          'El identificador coincide con más de un registro válido de ITEC. Se asignó ALERTA! SUPERVISOR.'
        )
      } else if (data?.resultado === 'OBS_INVALIDA') {
        setError(
          'La OBS no contiene un identificador PSR válido. Se asignó ALERTA! SUPERVISOR.'
        )
      } else {
        setError(
          'El identificador no fue encontrado en el padrón ITEC vigente. Se asignó ALERTA! SUPERVISOR.'
        )
      }

      window.setTimeout(() => {
        window.location.reload()
      }, 900)
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo resolver el Caminante.'
      )
    } finally {
      setProcesando(false)
    }
  }

  function reprocesar() {
    void resolver(null)
  }

  function guardarObsYResolver() {
    const valor = obs.trim()

    if (!valor) {
      setError('Ingresá la OBS / ID Mis Referidos.')
      return
    }

    void resolver(valor)
  }

  function cancelarEdicion() {
    setObs(obsActual || '')
    setEditandoObs(false)
    setMensaje(null)
    setError(null)
  }

  const enAlerta =
    String(caminanteActual || '').trim().toUpperCase() ===
    'ALERTA! SUPERVISOR'

  return (
    <div
      className={`rounded-xl border p-4 ${
        enAlerta
          ? 'border-amber-300 bg-amber-50'
          : 'border-gray-200 bg-gray-50'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-900">
            Resolución PSR
          </div>

          <div className="mt-1 text-sm text-gray-600">
            Caminante:{' '}
            <span
              className={
                enAlerta
                  ? 'font-semibold text-amber-800'
                  : 'font-semibold text-gray-900'
              }
            >
              {caminanteActual || '—'}
            </span>
          </div>

          <div className="mt-1 text-xs text-gray-500">
            El Caminante se obtiene exclusivamente del padrón ITEC vigente.
          </div>
        </div>

        {!editandoObs && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={reprocesar}
              disabled={procesando}
              className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {procesando ? 'Resolviendo…' : 'Resolver nuevamente con ITEC'}
            </button>

            <button
              type="button"
              onClick={() => {
                setEditandoObs(true)
                setMensaje(null)
                setError(null)
              }}
              disabled={procesando}
              className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              Corregir OBS
            </button>
          </div>
        )}
      </div>

      {editandoObs && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <label className="block text-sm font-medium text-gray-700">
            OBS / ID Mis Referidos
          </label>

          <input
            type="text"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            disabled={procesando}
            className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-red-500 disabled:opacity-50"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={guardarObsYResolver}
              disabled={procesando}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {procesando
                ? 'Resolviendo…'
                : 'Guardar OBS y resolver con ITEC'}
            </button>

            <button
              type="button"
              onClick={cancelarEdicion}
              disabled={procesando}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {mensaje && (
        <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          {mensaje}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
          {error}
        </div>
      )}
    </div>
  )
}
