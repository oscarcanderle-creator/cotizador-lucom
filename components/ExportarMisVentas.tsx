'use client'

import { useState } from 'react'

function hoyArgentina() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function primerDiaMes(fecha: string) {
  return `${fecha.slice(0, 7)}-01`
}

function nombreArchivoDesdeHeader(header: string | null) {
  if (!header) return 'mis_ventas.xlsx'
  const match = header.match(/filename="?([^"]+)"?/i)
  return match?.[1] || 'mis_ventas.xlsx'
}

export default function ExportarMisVentas() {
  const hoy = hoyArgentina()
  const [desde, setDesde] = useState(primerDiaMes(hoy))
  const [hasta, setHasta] = useState(hoy)
  const [exportando, setExportando] = useState(false)
  const [error, setError] = useState('')

  async function exportar() {
    setError('')

    if (!desde || !hasta || desde > hasta) {
      setError('Revisá el rango de fechas.')
      return
    }

    setExportando(true)

    try {
      const response = await fetch('/api/mis-ventas/exportar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ desde, hasta }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'No se pudo generar el Excel.')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')

      a.href = url
      a.download = nombreArchivoDesdeHeader(
        response.headers.get('Content-Disposition')
      )

      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e?.message || 'No se pudo generar el Excel.')
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-gray-900">
          Exportar Mis Ventas
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          El archivo incluye únicamente tus ventas ingresadas en el período.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_180px_auto]">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Fecha Desde
          </label>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Fecha Hasta
          </label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
          />
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={exportar}
            disabled={exportando}
            className="w-full rounded-lg bg-green-700 px-5 py-2 font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {exportando ? 'Generando...' : 'Exportar Excel'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 text-sm font-medium text-red-600">{error}</div>
      )}
    </div>
  )
}
