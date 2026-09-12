import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import AppHeader from '../../../components/AppHeader'
import { createClient } from '../../../utils/supabase/server'
import { createAdminClient } from '../../../utils/supabase/admin'

async function validarAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, rol, activo')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.activo || profile.rol !== 'ADMIN') {
    redirect('/ventas')
  }

  return { supabase, user, profile }
}

async function crearOrigen(formData: FormData) {
  'use server'

  await validarAdmin()
  const supabase = createAdminClient()
  const nombre = String(formData.get('nombre') ?? '').trim()
  const orden = Number(formData.get('orden') ?? 0)

  if (!nombre || !Number.isFinite(orden)) {
    throw new Error('Datos de origen inválidos.')
  }

  const { error } = await supabase.from('catalogo_origenes').insert({
    nombre,
    orden,
    activo: true,
  })

  if (error) {
    throw new Error(`No se pudo crear el Origen del Dato: ${error.message}`)
  }

  revalidatePath('/admin/origenes')
  revalidatePath('/ventas')
}

async function actualizarOrigen(formData: FormData) {
  'use server'

  await validarAdmin()
  const supabase = createAdminClient()
  const id = Number(formData.get('id'))
  const nombre = String(formData.get('nombre') ?? '').trim()
  const orden = Number(formData.get('orden') ?? 0)
  const activo = formData.get('activo') === 'on'

  if (!Number.isFinite(id) || !nombre || !Number.isFinite(orden)) {
    throw new Error('Datos de origen inválidos.')
  }

  const { error } = await supabase
    .from('catalogo_origenes')
    .update({ nombre, orden, activo })
    .eq('id', id)

  if (error) {
    throw new Error(`No se pudo actualizar el Origen del Dato: ${error.message}`)
  }

  revalidatePath('/admin/origenes')
  revalidatePath('/ventas')
}

export default async function OrigenesPage() {
  const { user, profile } = await validarAdmin()
  const supabase = createAdminClient()

  const { data: origenes, error } = await supabase
    .from('catalogo_origenes')
    .select('id, nombre, orden, activo')
    .order('orden', { ascending: true })
    .order('nombre', { ascending: true })

  if (error) {
    throw new Error(`No se pudieron cargar los Orígenes del Dato: ${error.message}`)
  }

  const nombreUsuario = profile.nombre?.trim() || user.email || 'Administrador'

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader rol={profile.rol} usuario={nombreUsuario} actual="ADMIN" />

      <div className="mx-auto max-w-5xl px-4 py-6 sm:p-8">
        <div className="mb-6">
          <a href="/admin" className="text-sm font-semibold text-red-600 hover:text-red-700">
            ← Volver a ADMIN
          </a>

          <h1 className="mt-3 text-2xl font-bold text-gray-900">
            ABM Origen del Dato
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Administrá los valores disponibles en el desplegable Origen del Dato del formulario de Ventas.
          </p>
        </div>

        <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Nuevo origen</h2>

          <form action={crearOrigen} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px_auto]">
            <input
              name="nombre"
              required
              placeholder="Ej.: Redes Sociales"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />

            <input
              name="orden"
              type="number"
              defaultValue={0}
              required
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />

            <button
              type="submit"
              className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Agregar
            </button>
          </form>
        </section>

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Orígenes configurados</h2>
          </div>

          <div className="divide-y divide-gray-200">
            {(origenes ?? []).map((origen) => (
              <form
                key={origen.id}
                action={actualizarOrigen}
                className="grid grid-cols-1 items-center gap-3 px-5 py-4 sm:grid-cols-[1fr_120px_120px_auto]"
              >
                <input type="hidden" name="id" value={origen.id} />

                <input
                  name="nombre"
                  defaultValue={origen.nombre}
                  required
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />

                <input
                  name="orden"
                  type="number"
                  defaultValue={origen.orden ?? 0}
                  required
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />

                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    name="activo"
                    type="checkbox"
                    defaultChecked={Boolean(origen.activo)}
                    className="h-4 w-4"
                  />
                  Activo
                </label>

                <button
                  type="submit"
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  Guardar
                </button>
              </form>
            ))}

            {(origenes ?? []).length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-gray-500">
                No hay Orígenes del Dato configurados.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
