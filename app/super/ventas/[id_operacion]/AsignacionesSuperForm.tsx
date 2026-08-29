'use client'

import { useState } from 'react'

type Opcion = {
  id: string
  nombre: string
}

type Props = {
  action: (formData: FormData) => void | Promise<void>
  idOperacion: string
  tipo: string
  vendedorActualId: string
  vendedorActualNombre: string
  responsableActualId: string
  responsableActualNombre: string
  vendedores: Opcion[]
  responsables: Opcion[]
}

export default function AsignacionesSuperForm({
  action,
  idOperacion,
  tipo,
  vendedorActualId,
  vendedorActualNombre,
  responsableActualId,
  responsableActualNombre,
  vendedores,
  responsables,
}: Props) {
  const [vendedorId, setVendedorId] = useState(vendedorActualId)

  const cambiaVendedor =
    Boolean(vendedorId) && vendedorId !== vendedorActualId

  return (
    <form
      action={action}
      className="rounded-xl border border-amber-200 bg-amber-50 p-4"
    >
      <input type="hidden" name="id_operacion" value={idOperacion} />
      <input type="hidden" name="tipo" value={tipo} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-gray-800">Vendedor</span>
          <select
            name="vendedor_id"
            value={vendedorId}
            onChange={(e) => setVendedorId(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="" disabled>Seleccionar vendedor</option>
            {vendedores.map((vendedor) => (
              <option key={vendedor.id} value={vendedor.id}>
                {vendedor.nombre}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-gray-500">
            Actual: {vendedorActualNombre}
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gray-800">Responsable</span>
          <select
            name="responsable_id"
            defaultValue={responsableActualId}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="">Sin asignar</option>
            {responsables.map((responsable) => (
              <option key={responsable.id} value={responsable.id}>
                {responsable.nombre}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-gray-500">
            Actual: {responsableActualNombre}
          </span>
        </label>
      </div>

      <div className="mt-4">
        <label className="block">
          <span className="text-sm font-semibold text-gray-800">
            Motivo del cambio de vendedor
          </span>
          <textarea
            name="motivo_vendedor"
            rows={3}
            required={cambiaVendedor}
            disabled={!cambiaVendedor}
            placeholder={
              cambiaVendedor
                ? 'Indique el motivo del cambio de vendedor'
                : 'Se habilita únicamente al cambiar el vendedor'
            }
            className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-gray-900 ${
              cambiaVendedor
                ? 'border-amber-400 bg-white'
                : 'border-gray-200 bg-gray-100'
            }`}
          />
          <span
            className={`mt-1 block text-xs ${
              cambiaVendedor
                ? 'font-semibold text-amber-700'
                : 'text-gray-500'
            }`}
          >
            {cambiaVendedor
              ? 'Obligatorio: está cambiando el vendedor de la operación.'
              : 'No es necesario para cambios de Responsable.'}
          </span>
        </label>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
        >
          Guardar asignaciones
        </button>
      </div>
    </form>
  )
}
