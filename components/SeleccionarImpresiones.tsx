'use client'

import { useState } from 'react'

type Registro = {
  id: string
  cliente: string
  domicilio: string
  telefono: string
  vendedor: string
  medio: string
  fecha: string
  chips: { tipo: string; sim: string }[]
}

export default function SeleccionarImpresiones({ registros, action }: {
  registros: Registro[]
  action: (formData: FormData) => void | Promise<void>
}) {
  const [seleccionados, setSeleccionados] = useState<string[]>([])
  const todos = seleccionados.length === registros.length
  const cambiar = (id: string, activo: boolean) => setSeleccionados(actual => activo ? [...actual, id] : actual.filter(valor => valor !== id))
  return (
    <form action={action} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <input type="checkbox" checked={todos} onChange={e => setSeleccionados(e.target.checked ? registros.map(r => r.id) : [])} />
          Seleccionar todas ({registros.length})
        </label>
        <button type="submit" disabled={seleccionados.length === 0} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
          Imprimir hojas de envío ({seleccionados.length})
        </button>
      </div>
      {registros.map(registro => (
        <section key={registro.id} className="rounded-2xl border border-gray-200 bg-white p-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" name="operacion_ids" value={registro.id} checked={seleccionados.includes(registro.id)} onChange={e => cambiar(registro.id, e.target.checked)} className="mt-1" />
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">PARA PREPARAR</span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold">{registro.medio}</span>
                <span className="text-xs text-gray-500">{registro.fecha}</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{registro.cliente}</h2>
              <p className="text-sm text-gray-500">Operación {registro.id}</p>
              <p className="text-sm text-gray-700">{registro.domicilio}</p>
              <p className="text-sm text-gray-600">Contacto: {registro.telefono} · Vendedor: {registro.vendedor}</p>
              <div className="flex flex-wrap gap-2">{registro.chips.map((chip, i) => (
                <span key={i} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">{chip.tipo === 'LINEA_NUEVA' ? 'LÍNEA NUEVA' : 'PORTA'} · SIM {chip.sim}</span>
              ))}</div>
            </div>
          </label>
        </section>
      ))}
    </form>
  )
}
