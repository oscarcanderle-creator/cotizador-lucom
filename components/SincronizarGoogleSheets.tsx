'use client'

import { useState } from 'react'

type ResultadoSync = {
  ok?: boolean
  message?: string
  error?: string
  rangos?: string[]
}

export default function SincronizarGoogleSheets() {
  const [sincronizando, setSincronizando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoSync | null>(null)

  async function sincronizar() {
    const confirmado = window.confirm(
      'Se escribirán los precios y descuentos actuales de la plataforma en el Spreadsheet de PRUEBA, hoja Price. ¿Continuar?'
    )
    if (!confirmado) return

    setSincronizando(true)
    setResultado(null)

    try {
      const response = await fetch('/api/admin/precios/sincronizar-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = (await response.json()) as ResultadoSync

      if (!response.ok) {
        setResultado({ ok: false, error: data.error || 'No se pudo sincronizar Google Sheets.' })
        return
      }

      setResultado(data)
    } catch (error) {
      setResultado({
        ok: false,
        error: error instanceof Error ? error.message : 'Error inesperado al sincronizar.',
      })
    } finally {
      setSincronizando(false)
    }
  }

  return (
    <div className="flex flex-col sm:items-end gap-1">
      <button
        type="button"
        onClick={sincronizar}
        disabled={sincronizando}
        className="inline-flex items-center justify-center rounded-lg bg-green-700 hover:bg-green-800 disabled:bg-green-400 text-white font-semibold px-4 py-2 text-sm"
      >
        {sincronizando ? 'Sincronizando…' : 'Sincronizar Google Sheets'}
      </button>

      {resultado?.ok && (
        <div className="text-xs font-medium text-green-700">
          {resultado.message || 'Sincronización completada.'}
        </div>
      )}

      {!resultado?.ok && resultado?.error && (
        <div className="text-xs font-medium text-red-700 max-w-sm sm:text-right">
          {resultado.error}
        </div>
      )}
    </div>
  )
}
