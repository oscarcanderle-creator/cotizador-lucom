'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type EstadoConsulta = {
  id: number
  nombre: string
  ambito: string | null
  activo: boolean
}

type Consulta = {
  id: number
  cliente: string | null
  dni: string | null
  telefono: string
  tipo_domicilio: string | null
  domicilio: string | null
  entrecalles: string | null
  localidad: string | null
  observaciones: string | null
  estado_consulta_id: number | null
  estado_deuda_id: number | null
  estado_cobertura_id: number | null
}

type Props = {
  consulta: Consulta
  tipoCodigo: string
  estadosConsulta: EstadoConsulta[]
}

const TIPOS_DOMICILIO = [
  ['CASA', 'Casa'],
  ['DEPARTAMENTO', 'Departamento'],
  ['LOCAL', 'Local'],
  ['OFICINA', 'Oficina'],
  ['OTRO', 'Otro'],
] as const

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500'

function Campo({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </span>
      {children}
    </label>
  )
}

export default function GestionConsultaForm({
  consulta,
  tipoCodigo,
  estadosConsulta,
}: Props) {
  const router = useRouter()

  const [edit, setEdit] = useState(consulta)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    setGuardando(true)
    setError('')
    setOk('')

    try {
      const response = await fetch('/api/gestion/consulta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          consulta_id: edit.id,
          cliente: edit.cliente,
          dni: edit.dni,
          telefono: edit.telefono,
          tipo_domicilio: edit.tipo_domicilio,
          domicilio: edit.domicilio,
          entrecalles: edit.entrecalles,
          localidad: edit.localidad,
          observaciones: edit.observaciones,
          estado_consulta_id: edit.estado_consulta_id,
          estado_deuda_id: edit.estado_deuda_id,
          estado_cobertura_id: edit.estado_cobertura_id,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            'No se pudo guardar la gestión.'
        )
      }

      setOk('Gestión guardada correctamente.')
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar la gestión.'
      )
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Campo label="Cliente">
          <input
            value={edit.cliente || ''}
            onChange={(e) =>
              setEdit({ ...edit, cliente: e.target.value })
            }
            className={inputClass}
          />
        </Campo>

        <Campo label="DNI">
          <input
            value={edit.dni || ''}
            onChange={(e) =>
              setEdit({
                ...edit,
                dni: e.target.value.replace(/\D/g, ''),
              })
            }
            inputMode="numeric"
            className={inputClass}
          />
        </Campo>

        <Campo label="Teléfono *">
          <input
            required
            inputMode="numeric"
            maxLength={10}
            value={edit.telefono}
            onChange={(e) =>
              setEdit({
                ...edit,
                telefono: e.target.value
                  .replace(/\D/g, '')
                  .slice(0, 10),
              })
            }
            className={inputClass}
          />
        </Campo>

        <Campo label="Tipo de domicilio">
          <select
            value={edit.tipo_domicilio || ''}
            onChange={(e) =>
              setEdit({
                ...edit,
                tipo_domicilio: e.target.value || null,
              })
            }
            className={inputClass}
          >
            <option value="">Seleccionar...</option>

            {TIPOS_DOMICILIO.map(([valor, nombre]) => (
              <option key={valor} value={valor}>
                {nombre}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Domicilio">
          <input
            value={edit.domicilio || ''}
            onChange={(e) =>
              setEdit({ ...edit, domicilio: e.target.value })
            }
            className={inputClass}
          />
        </Campo>

        <Campo label="Entre calles">
          <input
            value={edit.entrecalles || ''}
            onChange={(e) =>
              setEdit({ ...edit, entrecalles: e.target.value })
            }
            className={inputClass}
          />
        </Campo>

        <Campo label="Localidad">
          <input
            value={edit.localidad || ''}
            onChange={(e) =>
              setEdit({ ...edit, localidad: e.target.value })
            }
            className={inputClass}
          />
        </Campo>
      </div>

      <Campo label="Observaciones">
        <textarea
          rows={4}
          value={edit.observaciones || ''}
          onChange={(e) =>
            setEdit({ ...edit, observaciones: e.target.value })
          }
          className={inputClass}
        />
      </Campo>

      <div className="border-t border-gray-100 pt-5">
        <div className="grid gap-4 md:grid-cols-2">
          {tipoCodigo === 'RELLAMADO_VENTA_GESTION' && (
            <Campo label="Estado Rellamado">
              <select
                value={edit.estado_consulta_id ?? ''}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    estado_consulta_id: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                className={inputClass}
              >
                <option value="">Sin calificar</option>

                {estadosConsulta
                  .filter(
                    (estado) =>
                      estado.ambito !== 'DEUDA' &&
                      estado.ambito !== 'COBERTURA' &&
                      (estado.activo ||
                        estado.id === edit.estado_consulta_id)
                  )
                  .map((estado) => (
                    <option key={estado.id} value={estado.id}>
                      {estado.nombre}
                      {!estado.activo ? ' (inactivo)' : ''}
                    </option>
                  ))}
              </select>
            </Campo>
          )}

          {['DEUDA_CLIENTE', 'DOMICILIO_DEUDA'].includes(
            tipoCodigo
          ) && (
            <Campo label="Estado Deuda">
              <select
                value={edit.estado_deuda_id ?? ''}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    estado_deuda_id: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                className={inputClass}
              >
                <option value="">Sin calificar</option>

                {estadosConsulta
                  .filter(
                    (estado) =>
                      estado.ambito === 'DEUDA' &&
                      (estado.activo ||
                        estado.id === edit.estado_deuda_id)
                  )
                  .map((estado) => (
                    <option key={estado.id} value={estado.id}>
                      {estado.nombre}
                      {!estado.activo ? ' (inactivo)' : ''}
                    </option>
                  ))}
              </select>
            </Campo>
          )}

          {[
            'DOMICILIO_COBERTURA',
            'DOMICILIO_DEUDA',
          ].includes(tipoCodigo) && (
            <Campo label="Estado Cobertura">
              <select
                value={edit.estado_cobertura_id ?? ''}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    estado_cobertura_id: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                className={inputClass}
              >
                <option value="">Sin calificar</option>

                {estadosConsulta
                  .filter(
                    (estado) =>
                      estado.ambito === 'COBERTURA' &&
                      (estado.activo ||
                        estado.id === edit.estado_cobertura_id)
                  )
                  .map((estado) => (
                    <option key={estado.id} value={estado.id}>
                      {estado.nombre}
                      {!estado.activo ? ' (inactivo)' : ''}
                    </option>
                  ))}
              </select>
            </Campo>
          )}
        </div>

        {tipoCodigo === 'DOMICILIO_DEUDA' && (
          <p className="mt-2 text-xs text-gray-500">
            Deuda y Cobertura se califican de forma independiente.
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {ok && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {ok}
        </div>
      )}

      <button
        type="submit"
        disabled={guardando}
        className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
      >
        {guardando ? 'Guardando gestión...' : 'Guardar gestión'}
      </button>
    </form>
  )
}
