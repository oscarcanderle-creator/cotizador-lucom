'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { darBajaEntidadClaro, reactivarEntidadClaro } from './actions'

type Codigo = {
  id: string
  tipo_codigo: string
  codigo: string
  activo: boolean
  vigente_hasta: string | null
}

type Entidad = {
  id: string
  nombre: string
  activo: boolean
  fecha_alta: string | null
  fecha_baja: string | null
  codigos: Codigo[]
}

export default function BajaReactivarEntidad({ entidad }: { entidad: Entidad }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [fecha, setFecha] = useState('')
  const [motivo, setMotivo] = useState('')
  const [seleccionados, setSeleccionados] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  const codigosActivos = entidad.codigos.filter(c => c.activo)
  const codigosInactivos = entidad.codigos.filter(c => !c.activo)
  const fechaHoy = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date())

  useEffect(() => {
    if (!exito) return
    const timeout = window.setTimeout(() => setExito(''), 4000)
    return () => window.clearTimeout(timeout)
  }, [exito])

  function abrir() {
    setFecha(fechaHoy())
    setMotivo('')
    setSeleccionados([])
    setError('')
    setExito('')
    setAbierto(true)
  }

  function alternarCodigo(id: string, checked: boolean) {
    setSeleccionados(actual =>
      checked ? [...actual, id] : actual.filter(codigo => codigo !== id)
    )
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (guardando) return

    if (!entidad.activo && seleccionados.length === 0) {
      setError('Seleccioná al menos un código comercial para reactivar.')
      return
    }

    const datos = new FormData()
    datos.set('entidad_id', entidad.id)
    datos.set('fecha', fecha)
    datos.set('motivo', motivo.trim())
    seleccionados.forEach(id => datos.append('codigos_ids', id))

    setGuardando(true)
    setError('')
    try {
      const resultado = entidad.activo
        ? await darBajaEntidadClaro(datos)
        : await reactivarEntidadClaro(datos)

      if (!resultado.ok) {
        setError(resultado.mensaje)
        return
      }

      setAbierto(false)
      setExito(resultado.mensaje)
      router.refresh()
    } catch {
      setError('No se pudo confirmar la operación. Verificá el maestro antes de reintentar.')
    } finally {
      setGuardando(false)
    }
  }

  const baja = entidad.activo
  const minimo = baja ? entidad.fecha_alta : entidad.fecha_baja

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className={baja
          ? 'whitespace-nowrap rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50'
          : 'whitespace-nowrap rounded-lg border border-green-200 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50'}
      >
        {baja ? 'Dar de baja' : 'Reactivar'}
      </button>

      {exito && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-[60] flex items-center gap-3 rounded-xl border border-green-200 bg-white px-5 py-4 text-sm text-green-800 shadow-lg"
        >
          <span className="text-lg text-green-600">✓</span>
          {exito}
          <button
            type="button"
            onClick={() => setExito('')}
            className="ml-3 text-gray-400 hover:text-gray-700"
            aria-label="Cerrar notificación"
          >
            ×
          </button>
        </div>
      )}

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`titulo-vigencia-${entidad.id}`}
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2
                id={`titulo-vigencia-${entidad.id}`}
                className="text-xl font-semibold text-gray-900"
              >
                {baja ? 'Dar de baja entidad Claro' : 'Reactivar entidad Claro'}
              </h2>
              <button
                type="button"
                aria-label="Cerrar"
                disabled={guardando}
                onClick={() => setAbierto(false)}
                className="text-2xl text-gray-500 hover:text-gray-900"
              >
                ×
              </button>
            </div>

            <form onSubmit={guardar} className="space-y-4 p-6">
              <div>
                <div className="text-xs text-gray-500">Titular</div>
                <div className="font-semibold text-gray-900">{entidad.nombre}</div>
              </div>

              <div>
                <label
                  htmlFor={`fecha-vigencia-${entidad.id}`}
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {baja ? 'Fecha de baja *' : 'Fecha de reactivación *'}
                </label>
                <input
                  id={`fecha-vigencia-${entidad.id}`}
                  type="date"
                  value={fecha}
                  min={minimo || undefined}
                  max={fechaHoy()}
                  onChange={e => setFecha(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
              </div>

              <div>
                <label
                  htmlFor={`motivo-vigencia-${entidad.id}`}
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {baja ? 'Motivo de baja *' : 'Motivo de reactivación *'}
                </label>
                <textarea
                  id={`motivo-vigencia-${entidad.id}`}
                  rows={3}
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
              </div>

              {baja ? (
                <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-800">
                  Se dará de baja al titular y a sus {codigosActivos.length} códigos activos.
                  Se cerrarán sus períodos de vigencia. Los códigos ya inactivos no se modificarán.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-700">
                    Seleccioná los códigos a reactivar *
                  </div>
                  {codigosInactivos.map(c => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3"
                    >
                      <input
                        type="checkbox"
                        checked={seleccionados.includes(c.id)}
                        onChange={e => alternarCodigo(c.id, e.target.checked)}
                        className="mt-1"
                      />
                      <span className="flex flex-col text-sm">
                        <span className="font-mono font-medium text-gray-900">{c.codigo}</span>
                        <span className="text-xs text-gray-500">
                          {c.tipo_codigo}
                          {c.vigente_hasta ? ` · Última baja: ${c.vigente_hasta}` : ''}
                        </span>
                      </span>
                    </label>
                  ))}
                  {codigosInactivos.length === 0 && (
                    <p className="text-sm text-red-700">
                      Este titular no tiene códigos inactivos para seleccionar.
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    Los códigos no seleccionados permanecerán inactivos.
                    Los períodos históricos se conservarán.
                  </p>
                </div>
              )}

              <p className="text-xs text-gray-500">
                Esta operación no modifica el acceso ni los datos del usuario PGL.
                Los cambios quedarán registrados en la auditoría.
              </p>

              {error && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => setAbierto(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando || (!baja && seleccionados.length === 0)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${baja ? 'bg-red-600 hover:bg-red-700' : 'bg-green-700 hover:bg-green-800'}`}
                >
                  {guardando
                    ? 'Procesando...'
                    : baja ? 'Confirmar baja' : 'Confirmar reactivación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
