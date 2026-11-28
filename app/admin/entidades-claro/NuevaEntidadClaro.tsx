'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { crearEntidadClaro, editarEntidadClaro } from './actions'

export type UsuarioDisponible = {
  id: string
  nombre: string
  vendedor: string
  dni: string
  rol: string
}

export type TitularEditable = {
  id: string
  nombre: string
  tipo: string
  dni: string | null
  profile_id: string | null
  fecha_alta: string | null
  observaciones: string | null
}

export default function NuevaEntidadClaro({
  usuarios,
  entidad,
}: {
  usuarios: UsuarioDisponible[]
  entidad?: TitularEditable
}) {
  const editando = Boolean(entidad)
  const router = useRouter()

  const [abierto, setAbierto] = useState(false)
  const [tipo, setTipo] = useState('CALL')
  const [profileId, setProfileId] = useState('')
  const [nombre, setNombre] = useState('')
  const [dni, setDni] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  useEffect(() => {
    if (!exito) return

    const timer = window.setTimeout(() => {
      setExito('')
    }, 4000)

    return () => window.clearTimeout(timer)
  }, [exito])

  const requiereUsuario = tipo === 'CALL' || tipo === 'TERRENO'

  const usuariosFiltrados = usuarios.filter(u => {
    const vendedor = u.vendedor.trim().toUpperCase()

    if (tipo === 'CALL') return vendedor.startsWith('L1 ')
    if (tipo === 'TERRENO') return vendedor.startsWith('LT ')
    if (tipo === 'BBOO') return u.rol === 'BBOO'

    return true
  })

  const fechaActual = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  const campo =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white'

  const etiqueta =
    'block text-sm font-medium text-gray-700 mb-1'

  function cambiarTipo(valor: string) {
    setTipo(valor)
    setProfileId('')
    setNombre('')
    setDni('')
    setError('')
  }

  function seleccionarUsuario(id: string) {
    setProfileId(id)

    const usuario = usuarios.find(u => u.id === id)

    setNombre(usuario?.nombre || '')
    setDni(usuario?.dni || '')
    setError('')
  }

  function abrir() {
    setTipo(entidad?.tipo || 'CALL')
    setProfileId(entidad?.profile_id || '')
    setNombre(entidad?.nombre || '')
    setDni(entidad?.dni || '')
    setError('')
    setExito('')
    setAbierto(true)
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (guardando) return

    const datos = new FormData(event.currentTarget)

    setGuardando(true)
    setError('')

    try {
      const resultado = editando
        ? await editarEntidadClaro(datos)
        : await crearEntidadClaro(datos)

      if (!resultado.ok) {
        setError(resultado.mensaje)
        return
      }

      setAbierto(false)
      setExito(resultado.mensaje)
      router.refresh()
    } catch {
      setError('No se pudo confirmar el guardado. Verificá el maestro antes de reintentar.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={abrir}
          className={editando
            ? 'border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-lg px-3 py-1.5 text-xs font-medium'
            : 'bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2.5 text-sm font-medium'}
        >
          {editando ? 'Editar' : '+ Nueva entidad'}
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
      </div>

      {abierto && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-nueva-entidad"
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2
                id="titulo-nueva-entidad"
                className="text-xl font-semibold text-gray-900"
              >
                {editando ? 'Editar titular Claro' : 'Nueva entidad Claro'}
              </h2>

              <button
                type="button"
                disabled={guardando}
                onClick={() => setAbierto(false)}
                className="text-gray-500 hover:text-gray-900 text-2xl"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <form onSubmit={guardar} className="p-6 space-y-4">
              {entidad && (
                <input type="hidden" name="entidad_id" value={entidad.id} />
              )}
              <div>
                <label className={etiqueta}>Tipo de entidad</label>
                <select
                  name="tipo"
                  className={campo}
                  value={tipo}
                  onChange={e => cambiarTipo(e.target.value)}
                >
                  {['CALL', 'TERRENO', 'BBOO', 'AGENCIA'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={etiqueta}>
                  Usuario PGL {requiereUsuario ? '*' : '(opcional)'}
                </label>
                <select
                  name="profile_id"
                  className={campo}
                  value={profileId}
                  required={requiereUsuario}
                  onChange={e => seleccionarUsuario(e.target.value)}
                >
                  <option value="">Seleccionar usuario PGL</option>

                  {usuariosFiltrados.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.vendedor || u.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={etiqueta}>Nombre del titular *</label>
                <input
                  name="nombre"
                  className={campo}
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={etiqueta}>DNI</label>
                  <input
                    name="dni"
                    className={campo}
                    value={dni}
                    onChange={e => setDni(e.target.value)}
                    inputMode="numeric"
                    pattern="[0-9]{7,8}"
                    maxLength={8}
                  />
                </div>

                {!editando && (
                <div>
                  <label className={etiqueta}>Entidad Claro *</label>
                  <input
                    name="codigo"
                    className={`${campo} uppercase`}
                    placeholder="AGE / AGET / AGEP"
                    onChange={e => {
                      e.target.value = e.target.value.toUpperCase()
                    }}
                    pattern="(AGE|AGET|AGEP)[0-9]+"
                    required
                  />
                </div>

                )}

                {!editando && (
                <div>
                  <label className={etiqueta}>POS</label>
                  <input
                    name="pos"
                    className={campo}
                    placeholder="Opcional"
                  />
                </div>

                )}

                <div>
                  <label className={etiqueta}>Fecha de alta *</label>
                  <input
                    type="date"
                    name="fecha_alta"
                    className={campo}
                    defaultValue={entidad ? entidad.fecha_alta || '' : fechaActual}
                    required
                  />
                </div>
              </div>

              <div>
                <label className={etiqueta}>Observaciones</label>
                <textarea
                  name="observaciones"
                  defaultValue={entidad?.observaciones || ''}
                  className={campo}
                  rows={3}
                />
              </div>

              {error && (
                <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => setAbierto(false)}
                  className="border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-700"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={guardando}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg px-5 py-2 text-sm font-medium"
                >
                  {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Guardar entidad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
