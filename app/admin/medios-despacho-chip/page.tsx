import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { createClient } from '../../../utils/supabase/server'
import { createAdminClient } from '../../../utils/supabase/admin'

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
    .select('rol, activo')
    .eq('id', user.id)
    .single()

  if (
    !profile ||
    !profile.activo ||
    profile.rol !== 'ADMIN'
  ) {
    redirect('/ventas')
  }

  return createAdminClient()
}

export default async function AdminMediosDespachoChipPage() {
  const admin = await validarAdmin()

  const { data: medios, error } = await admin
    .from('medios_despacho_chip')
    .select('id, nombre, activo, orden')
    .order('orden')
    .order('nombre')

  if (error) {
    throw new Error(error.message)
  }

  async function crearMedio(formData: FormData) {
    'use server'

    const admin = await validarAdmin()

    const nombre = String(formData.get('nombre') ?? '').trim()
    const orden = Number(formData.get('orden') ?? 0)

    if (!nombre) {
      throw new Error('El nombre del medio de despacho es obligatorio.')
    }

    const { error } = await admin
      .from('medios_despacho_chip')
      .insert({
        nombre,
        orden: Number.isFinite(orden) ? orden : 0,
        activo: true,
      })

    if (error) {
      throw new Error(error.message)
    }

    revalidatePath('/admin/medios-despacho-chip')
    redirect('/admin/medios-despacho-chip')
  }

  async function actualizarMedio(formData: FormData) {
    'use server'

    const admin = await validarAdmin()

    const id = Number(formData.get('id'))
    const nombre = String(formData.get('nombre') ?? '').trim()
    const orden = Number(formData.get('orden') ?? 0)
    const activo = formData.get('activo') === 'on'

    if (!Number.isFinite(id) || !nombre) {
      throw new Error('Datos del medio de despacho inválidos.')
    }

    const { error } = await admin
      .from('medios_despacho_chip')
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

    revalidatePath('/admin/medios-despacho-chip')
    redirect('/admin/medios-despacho-chip')
  }

  async function eliminarMedio(formData: FormData) {
    'use server'

    const admin = await validarAdmin()

    const id = Number(formData.get('id'))
    const confirmar = String(formData.get('confirmar') ?? '')
      .trim()
      .toUpperCase()

    if (!Number.isFinite(id)) {
      throw new Error('Medio de despacho inválido.')
    }

    if (confirmar !== 'ELIMINAR') {
      throw new Error('Escribí ELIMINAR para confirmar.')
    }

    const { error } = await admin
      .from('medios_despacho_chip')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(error.message)
    }

    revalidatePath('/admin/medios-despacho-chip')
    redirect('/admin/medios-despacho-chip')
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-red-600">
              Medios de despacho CHIP
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Administrá los valores del campo Medio de despacho CHIP de PORTA.
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
          action={crearMedio}
          className="bg-white border border-gray-200 rounded-xl p-5 mb-6"
        >
          <h2 className="text-lg font-semibold mb-4">
            Nuevo medio de despacho
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-3 sm:items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Nombre
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
          {(medios ?? []).map((medio) => (
            <div
              key={medio.id}
              className="bg-white border border-gray-200 rounded-xl p-4"
            >
              <form
                action={actualizarMedio}
                className="grid grid-cols-1 sm:grid-cols-[1fr_110px_auto_auto] gap-3 sm:items-end"
              >
                <input type="hidden" name="id" value={medio.id} />

                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Medio de despacho
                  </label>
                  <input
                    type="text"
                    name="nombre"
                    defaultValue={medio.nombre}
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
                    defaultValue={medio.orden ?? 0}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700 sm:pb-2">
                  <input
                    type="checkbox"
                    name="activo"
                    defaultChecked={medio.activo}
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
                action={eliminarMedio}
                className="mt-3 pt-3 border-t border-gray-100 flex flex-col sm:flex-row gap-2 sm:justify-end"
              >
                <input type="hidden" name="id" value={medio.id} />

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
                  Eliminar medio
                </button>
              </form>
            </div>
          ))}

          {(medios ?? []).length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
              No hay medios de despacho cargados.
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
