import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { createClient } from '../../../utils/supabase/server'
import { createAdminClient } from '../../../utils/supabase/admin'
import AppHeader from '../../../components/AppHeader'

async function validarAdmin() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, rol, activo')
    .eq('id', user.id)
    .single()

  if (
    !profile ||
    !profile.activo ||
    profile.rol !== 'ADMIN'
  ) {
    redirect('/ventas')
  }

  return {
    admin: createAdminClient(),
    user,
    profile,
  }
}

export default async function Page() {
  const { admin, user, profile } = await validarAdmin()

  const { data: estados, error } = await admin
    .from('estados_porta')
    .select('id, codigo, nombre, activo, orden')
    .order('orden')
    .order('nombre')

  if (error) {
    throw new Error(error.message)
  }

  async function crearEstado(formData: FormData) {
    'use server'

    const { admin } = await validarAdmin()

    const codigo = String(formData.get('codigo') ?? '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')

    const nombre = String(formData.get('nombre') ?? '').trim()
    const orden = Number(formData.get('orden') ?? 0)

    if (!codigo || !nombre) {
      throw new Error('Código y nombre son obligatorios.')
    }

    const { error } = await admin
      .from('estados_porta')
      .insert({
        codigo,
        nombre,
        orden: Number.isFinite(orden) ? orden : 0,
        activo: true,
      })

    if (error) {
      throw new Error(error.message)
    }

    revalidatePath('/admin/estados-porta')
    redirect('/admin/estados-porta')
  }

  async function actualizarEstado(formData: FormData) {
    'use server'

    const { admin } = await validarAdmin()

    const id = Number(formData.get('id'))
    const nombre = String(formData.get('nombre') ?? '').trim()
    const orden = Number(formData.get('orden') ?? 0)
    const activo = formData.get('activo') === 'on'

    if (!Number.isFinite(id) || !nombre) {
      throw new Error('Datos de estado porta inválidos.')
    }

    const { error } = await admin
      .from('estados_porta')
      .update({
        nombre,
        orden: Number.isFinite(orden) ? orden : 0,
        activo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      throw new Error(error.message)
    }

    revalidatePath('/admin/estados-porta')
    redirect('/admin/estados-porta')
  }

  async function eliminarEstado(formData: FormData) {
    'use server'

    const { admin } = await validarAdmin()

    const id = Number(formData.get('id'))
    const confirmar = String(formData.get('confirmar') ?? '')
      .trim()
      .toUpperCase()

    if (!Number.isFinite(id)) {
      throw new Error('Estado PORTA inválido.')
    }

    if (confirmar !== 'ELIMINAR') {
      throw new Error('Escribí ELIMINAR para confirmar.')
    }

    const { error } = await admin
      .from('estados_porta')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(error.message)
    }

    revalidatePath('/admin/estados-porta')
    redirect('/admin/estados-porta')
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader
        rol={profile.rol}
        usuario={profile.nombre?.trim() || user.email || 'Administrador'}
        actual="ADMIN"
      />
      <div className="max-w-5xl mx-auto px-4 py-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-red-600">
              Estados PORTA
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Administrá los estados de gestión de Portabilidad y Línea Nueva.
            </p>
          </div>

          <a
            href="/admin"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Volver al administrador
          </a>
        </div>

        <form
          action={crearEstado}
          className="bg-white border border-gray-200 rounded-xl p-5 mb-6"
        >
          <h2 className="text-lg font-semibold mb-4">
            Nuevo estado porta
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-[190px_1fr_110px_auto] gap-3 sm:items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Código
              </label>
              <input
                type="text"
                name="codigo"
                required
                placeholder="EJEMPLO_ESTADO"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Nombre visible
              </label>
              <input
                type="text"
                name="nombre"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Orden
              </label>
              <input
                type="number"
                name="orden"
                defaultValue={0}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
              />
            </div>

            <button
              type="submit"
              className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2 rounded-lg"
            >
              Agregar
            </button>
          </div>
        </form>

        <div className="space-y-3">
          {(estados ?? []).map((estado) => (
            <div
              key={estado.id}
              className="bg-white border border-gray-200 rounded-xl p-4"
            >
              <form
                action={actualizarEstado}
                className="grid grid-cols-1 sm:grid-cols-[190px_1fr_110px_auto_auto] gap-3 sm:items-end"
              >
                <input type="hidden" name="id" value={estado.id} />

                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Código
                  </label>
                  <input
                    type="text"
                    value={estado.codigo}
                    readOnly
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-100 text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Nombre visible
                  </label>
                  <input
                    type="text"
                    name="nombre"
                    defaultValue={estado.nombre}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Orden
                  </label>
                  <input
                    type="number"
                    name="orden"
                    defaultValue={estado.orden ?? 0}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700 sm:pb-2">
                  <input
                    type="checkbox"
                    name="activo"
                    defaultChecked={estado.activo}
                  />
                  Activo
                </label>

                <button
                  type="submit"
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg"
                >
                  Guardar
                </button>
              </form>

              <form
                action={eliminarEstado}
                className="mt-3 pt-3 border-t border-gray-100 flex flex-col sm:flex-row gap-2 sm:justify-end"
              >
                <input type="hidden" name="id" value={estado.id} />

                <input
                  type="text"
                  name="confirmar"
                  placeholder="Escribí ELIMINAR"
                  className="border border-red-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-900"
                />

                <button
                  type="submit"
                  className="border border-red-300 text-red-700 hover:bg-red-50 font-medium px-4 py-2 rounded-lg"
                >
                  Eliminar estado porta
                </button>
              </form>
            </div>
          ))}

          {(estados ?? []).length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
              No hay registros cargados.
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
