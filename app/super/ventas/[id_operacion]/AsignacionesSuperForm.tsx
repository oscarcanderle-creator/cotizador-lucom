'use client'

import { useState } from 'react'

type Opcion = {
  id: string
  nombre: string
}

type Props = {
  formId: string
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
  formId,
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
  const vendedorCambia = vendedorId !== vendedorActualId

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
      <input form={formId} type="hidden" name="id_operacion_asignacion" value={idOperacion} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Vendedor
          </label>
          <select
            form={formId}
            name="vendedor_id"
            value={vendedorId}
            onChange={(event) => setVendedorId(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            {vendedorActualId && !vendedores.some((item) => item.id === vendedorActualId) && (
              <option value={vendedorActualId}>{vendedorActualNombre} (actual)</option>
            )}
            {vendedores.map((vendedor) => (
              <option key={vendedor.id} value={vendedor.id}>
                {vendedor.nombre}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">Actual: {vendedorActualNombre}</p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Responsable
          </label>
          <select
            form={formId}
            name="responsable_id"
            defaultValue={responsableActualId}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="">Sin responsable asignado</option>
            {responsableActualId && !responsables.some((item) => item.id === responsableActualId) && (
              <option value={responsableActualId}>{responsableActualNombre} (actual)</option>
            )}
            {responsables.map((responsable) => (
              <option key={responsable.id} value={responsable.id}>
                {responsable.nombre}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">Actual: {responsableActualNombre}</p>
        </div>
      </div>

      {vendedorCambia && (
        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Motivo del cambio de Vendedor
          </label>
          <textarea
            form={formId}
            name="motivo_vendedor"
            required
            rows={3}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            placeholder="Indique el motivo de la reasignación"
          />
          <p className="mt-1 text-xs text-gray-500">El motivo es obligatorio cuando cambia el Vendedor.</p>
        </div>
      )}

      {tipo === 'PORTA' && (
        <p className="mt-3 text-xs text-gray-500">
          En operaciones móviles agrupadas, Vendedor y Responsable se aplican a todas las líneas relacionadas al confirmar Guardar.
        </p>
      )}
    </div>
  )
}
