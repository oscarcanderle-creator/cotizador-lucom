'use client'

import { useMemo, useState } from 'react'

type GestionLista = {
  id: number
  codigo_gestion: string
  medio_despacho_chip_id: number
  medio_nombre: string
  cliente: string
  domicilio: string
}

type Props = {
  gestiones: GestionLista[]
  action: (formData: FormData) => void | Promise<void>
}

export default function CrearLoteDespacho({
  gestiones,
  action,
}: Props) {
  const [seleccionadas, setSeleccionadas] = useState<number[]>([])

  const primeraSeleccionada = gestiones.find(
    (gestion) => gestion.id === seleccionadas[0]
  )

  const medioSeleccionado =
    primeraSeleccionada?.medio_despacho_chip_id ?? null

  const gruposPorMedio = useMemo(() => {
    const grupos = new Map<
      number,
      {
        medioId: number
        medioNombre: string
        gestiones: GestionLista[]
      }
    >()

    for (const gestion of gestiones) {
      const existente = grupos.get(gestion.medio_despacho_chip_id)

      if (existente) {
        existente.gestiones.push(gestion)
        continue
      }

      grupos.set(gestion.medio_despacho_chip_id, {
        medioId: gestion.medio_despacho_chip_id,
        medioNombre: gestion.medio_nombre,
        gestiones: [gestion],
      })
    }

    return Array.from(grupos.values())
  }, [gestiones])

  function alternar(gestion: GestionLista) {
    setSeleccionadas((actuales) => {
      if (actuales.includes(gestion.id)) {
        return actuales.filter((id) => id !== gestion.id)
      }

      const primeraActual = gestiones.find(
        (item) => item.id === actuales[0]
      )

      const medioActual =
        primeraActual?.medio_despacho_chip_id ?? null

      if (
        actuales.length > 0 &&
        medioActual !== gestion.medio_despacho_chip_id
      ) {
        return actuales
      }

      return [...actuales, gestion.id]
    })
  }

  function alternarTodasMedio(medioId: number) {
    const idsMedio = gestiones
      .filter(
        (gestion) =>
          gestion.medio_despacho_chip_id === medioId
      )
      .map((gestion) => gestion.id)

    const todasSeleccionadas =
      idsMedio.length > 0 &&
      idsMedio.every((id) => seleccionadas.includes(id))

    if (todasSeleccionadas) {
      setSeleccionadas([])
      return
    }

    setSeleccionadas(idsMedio)
  }

  if (gestiones.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-500">
        No hay Gestiones de Entrega disponibles para incorporar a un nuevo lote.
      </div>
    )
  }

  return (
    <form action={action} className="space-y-4">
      {seleccionadas.map((id) => (
        <input
          key={id}
          type="hidden"
          name="gestion_entrega_ids"
          value={id}
        />
      ))}

      <div className="flex flex-wrap items-center gap-2">
        {gruposPorMedio.map((grupo) => {
          const todasSeleccionadas =
            grupo.gestiones.length > 0 &&
            grupo.gestiones.every((gestion) =>
              seleccionadas.includes(gestion.id)
            )

          const bloqueado =
            seleccionadas.length > 0 &&
            medioSeleccionado !== grupo.medioId

          return (
            <button
              key={grupo.medioId}
              type="button"
              disabled={bloqueado}
              onClick={() => alternarTodasMedio(grupo.medioId)}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                todasSeleccionadas
                  ? 'border-gray-300 bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              {todasSeleccionadas
                ? `Quitar selección · ${grupo.medioNombre} (${grupo.gestiones.length})`
                : `Marcar todas · ${grupo.medioNombre} (${grupo.gestiones.length})`}
            </button>
          )
        })}
      </div>

      <div className="space-y-2">
        {gestiones.map((gestion) => {
          const seleccionada = seleccionadas.includes(gestion.id)

          const otroMedio =
            seleccionadas.length > 0 &&
            medioSeleccionado !== gestion.medio_despacho_chip_id

          return (
            <label
              key={gestion.id}
              className={`flex items-start gap-3 rounded-xl border p-4 transition ${
                seleccionada
                  ? 'border-red-300 bg-red-50'
                  : otroMedio
                    ? 'border-gray-200 bg-gray-50 opacity-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={seleccionada}
                disabled={otroMedio}
                onChange={() => alternar(gestion)}
                className="mt-1 h-4 w-4"
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-900">
                    {gestion.codigo_gestion}
                  </span>

                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                    {gestion.medio_nombre}
                  </span>
                </div>

                <div className="mt-1 text-sm font-medium text-gray-800">
                  {gestion.cliente}
                </div>

                <div className="mt-1 text-xs text-gray-500">
                  {gestion.domicilio}
                </div>
              </div>
            </label>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
        <div className="text-sm text-gray-500">
          {seleccionadas.length === 0
            ? 'Seleccioná una o más entregas.'
            : `${seleccionadas.length} ${
                seleccionadas.length === 1
                  ? 'entrega seleccionada'
                  : 'entregas seleccionadas'
              }`}
        </div>

        <button
          type="submit"
          disabled={seleccionadas.length === 0}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Crear Lote de Despacho
        </button>
      </div>
    </form>
  )
}
