'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type FiltroAvanzado = {
  campo: string
  condicion: string
  valor: string
  valor2: string
  conector: 'AND' | 'OR'
}

type FiltrosGuardados = {
  tipo?: string
  vendedor?: string
  responsable?: string
  estado?: string
  avanzados?: FiltroAvanzado[]
}

type Bandeja = {
  id: string
  nombre: string
  filtros: FiltrosGuardados
}

type Props = {
  bandejas: Bandeja[]
  filtrosActuales: FiltrosGuardados
  puedeGuardar: boolean
  bandejaActiva?: string
}

function hrefBandeja(bandeja: Bandeja) {
  const params = new URLSearchParams()
  const filtros = bandeja.filtros ?? {}

  if (filtros.tipo) params.set('tipo', filtros.tipo)
  if (filtros.vendedor) params.set('vendedor', filtros.vendedor)
  if (filtros.responsable) params.set('responsable', filtros.responsable)
  if (filtros.estado) params.set('estado', filtros.estado)

  const avanzados = Array.isArray(filtros.avanzados)
    ? filtros.avanzados.slice(0, 4)
    : []

  avanzados.forEach((filtro, indice) => {
    const numero = indice + 1
    if (numero > 1) params.set(`f${numero}_join`, filtro.conector || 'AND')
    params.set(`f${numero}_field`, filtro.campo || '')
    params.set(`f${numero}_op`, filtro.condicion || '')
    if (filtro.valor) params.set(`f${numero}_value`, filtro.valor)
    if (filtro.valor2) params.set(`f${numero}_value2`, filtro.valor2)
  })

  params.set('bandeja', bandeja.id)
  return `/gestion-ventas?${params.toString()}`
}

export default function BandejasGestionVentas({
  bandejas,
  filtrosActuales,
  puedeGuardar,
  bandejaActiva = '',
}: Props) {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState<string | null>(null)
  const [error, setError] = useState('')

  const nombreLimpio = nombre.trim()
  const puedeEnviar = puedeGuardar && nombreLimpio.length > 0 && !guardando

  const ordenadas = useMemo(
    () => [...bandejas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [bandejas]
  )

  const guardar = async () => {
    if (!puedeEnviar) return

    setGuardando(true)
    setError('')

    try {
      const respuesta = await fetch('/api/gestion/bandejas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombreLimpio,
          filtros: filtrosActuales,
        }),
      })

      const datos = await respuesta.json().catch(() => ({}))

      if (!respuesta.ok) {
        throw new Error(datos?.error || 'No se pudo guardar la bandeja.')
      }

      setNombre('')
      router.refresh()
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar la bandeja.')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (bandeja: Bandeja) => {
    const confirmar = window.confirm(`¿Eliminar la bandeja “${bandeja.nombre}”?`)
    if (!confirmar) return

    setEliminando(bandeja.id)
    setError('')

    try {
      const respuesta = await fetch('/api/gestion/bandejas', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bandeja.id }),
      })

      const datos = await respuesta.json().catch(() => ({}))

      if (!respuesta.ok) {
        throw new Error(datos?.error || 'No se pudo eliminar la bandeja.')
      }

      if (bandejaActiva === bandeja.id) {
        router.push('/gestion-ventas')
      } else {
        router.refresh()
      }
    } catch (e: any) {
      setError(e?.message || 'No se pudo eliminar la bandeja.')
    } finally {
      setEliminando(null)
    }
  }

  return (
    <section className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Bandejas de trabajo</h2>
          <p className="mt-1 text-xs text-gray-500">
            Guardá una combinación de filtros y recuperala con un solo clic. La búsqueda amplia no se guarda.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
          <input
            type="text"
            value={nombre}
            maxLength={60}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                guardar()
              }
            }}
            placeholder="Nombre de la bandeja..."
            className="h-10 min-w-0 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 sm:w-64"
          />
          <button
            type="button"
            disabled={!puedeEnviar}
            onClick={guardar}
            className="h-10 rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
            title={puedeGuardar ? 'Guardar filtros actuales' : 'Aplicá al menos un filtro antes de guardar'}
          >
            {guardando ? 'Guardando...' : 'Guardar como bandeja'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {ordenadas.map((bandeja) => {
          const activa = bandejaActiva === bandeja.id

          return (
            <div
              key={bandeja.id}
              className={
                activa
                  ? 'flex items-center overflow-hidden rounded-lg border border-red-300 bg-red-50'
                  : 'flex items-center overflow-hidden rounded-lg border border-gray-300 bg-white'
              }
            >
              <a
                href={hrefBandeja(bandeja)}
                className={
                  activa
                    ? 'px-3 py-2 text-sm font-semibold text-red-700'
                    : 'px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
                }
              >
                {bandeja.nombre}
              </a>
              <button
                type="button"
                disabled={eliminando === bandeja.id}
                onClick={() => eliminar(bandeja)}
                className="border-l border-inherit px-2.5 py-2 text-sm text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                title="Eliminar bandeja"
                aria-label={`Eliminar bandeja ${bandeja.nombre}`}
              >
                ×
              </button>
            </div>
          )
        })}

        {ordenadas.length === 0 && (
          <div className="text-sm text-gray-400">
            Todavía no hay bandejas guardadas.
          </div>
        )}
      </div>
    </section>
  )
}
