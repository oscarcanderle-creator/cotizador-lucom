'use client'

import { useState } from 'react'

type Props = {
  id: string
  nombre: string
  eliminar: (formData: FormData) => Promise<void>
}

export default function EliminarPuntoVenta({
  id,
  nombre,
  eliminar,
}: Props) {
  const [abierto, setAbierto] = useState(false)
  const [confirmacion, setConfirmacion] = useState('')

  const confirmado = confirmacion.trim() === nombre

  return (
    <div className="mt-3 border-t border-gray-200 pt-3">
      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="rounded-lg border border-red-600 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
        >
          Eliminar PDV
        </button>
      ) : (
        <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">
            Confirmar eliminación definitiva
          </p>

          <p className="text-sm text-gray-700">
            Para eliminar este establecimiento, escribí exactamente:
            <strong className="ml-1">{nombre}</strong>
          </p>

          <form action={eliminar} className="space-y-3">
            <input type="hidden" name="id" value={id} />

            <input
              name="confirmacion"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              placeholder="Nombre exacto del PDV"
              autoComplete="off"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={!confirmado}
                className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                Confirmar eliminación
              </button>

              <button
                type="button"
                onClick={() => {
                  setAbierto(false)
                  setConfirmacion('')
                }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
