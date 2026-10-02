import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '../../../utils/supabase/server'
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

  if (!profile || !profile.activo || profile.rol !== 'ADMIN') {
    redirect('/cotizador')
  }

  return { supabase, user, profile }
}

export default async function AdminNovedadesPage() {
  const { supabase, user, profile } = await validarAdmin()

  const [
    { data: novedadesPropuesta, error: errorPropuesta },
    { data: novedadesCotizador, error: errorCotizador },
  ] = await Promise.all([
    supabase
      .from('novedades_propuesta')
      .select('id, titulo, contenido, activo, orden')
      .order('orden'),
    supabase
      .from('novedades_cotizador')
      .select('id, titulo, contenido, activo, orden')
      .order('orden')
      .order('id'),
  ])

  if (errorPropuesta) {
    throw new Error(errorPropuesta.message)
  }

  if (errorCotizador) {
    throw new Error(errorCotizador.message)
  }

  async function actualizarNovedadPropuesta(formData: FormData) {
    'use server'

    const { supabase } = await validarAdmin()

    const id = Number(formData.get('id'))
    const titulo = String(formData.get('titulo') ?? '').trim()
    const contenido = String(formData.get('contenido') ?? '').trim()
    const activo = formData.get('activo') === 'on'

    if (!contenido) {
      throw new Error('El contenido es obligatorio.')
    }

    const { error } = await supabase
      .from('novedades_propuesta')
      .update({
        titulo,
        contenido,
        activo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      throw new Error(error.message)
    }

    revalidatePath('/admin/novedades')
    revalidatePath('/cotizador')
  }

  async function crearNovedadCotizador(formData: FormData) {
    'use server'

    const { supabase } = await validarAdmin()

    const titulo = String(formData.get('titulo') ?? '').trim()
    const contenido = String(formData.get('contenido') ?? '').trim()
    const activo = formData.get('activo') === 'on'

    if (!titulo) {
      throw new Error('El título es obligatorio.')
    }

    if (!contenido) {
      throw new Error('El contenido es obligatorio.')
    }

    const { data: ultima, error: errorUltima } = await supabase
      .from('novedades_cotizador')
      .select('orden')
      .order('orden', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (errorUltima) {
      throw new Error(errorUltima.message)
    }

    const orden = Number(ultima?.orden ?? 0) + 1

    const { error } = await supabase
      .from('novedades_cotizador')
      .insert({
        titulo,
        contenido,
        activo,
        orden,
      })

    if (error) {
      throw new Error(error.message)
    }

    revalidatePath('/admin/novedades')
    revalidatePath('/cotizador')
  }

  async function actualizarNovedadCotizador(formData: FormData) {
    'use server'

    const { supabase } = await validarAdmin()

    const id = Number(formData.get('id'))
    const titulo = String(formData.get('titulo') ?? '').trim()
    const contenido = String(formData.get('contenido') ?? '').trim()
    const activo = formData.get('activo') === 'on'
    const orden = Number(formData.get('orden'))

    if (!Number.isFinite(id)) {
      throw new Error('Novedad inválida.')
    }

    if (!titulo) {
      throw new Error('El título es obligatorio.')
    }

    if (!contenido) {
      throw new Error('El contenido es obligatorio.')
    }

    if (!Number.isFinite(orden) || orden < 1) {
      throw new Error('El orden debe ser un número mayor o igual a 1.')
    }

    const { error } = await supabase
      .from('novedades_cotizador')
      .update({
        titulo,
        contenido,
        activo,
        orden,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      throw new Error(error.message)
    }

    revalidatePath('/admin/novedades')
    revalidatePath('/cotizador')
  }

  async function eliminarNovedadCotizador(formData: FormData) {
    'use server'

    const { supabase } = await validarAdmin()

    const id = Number(formData.get('id'))

    if (!Number.isFinite(id)) {
      throw new Error('Novedad inválida.')
    }

    const { error } = await supabase
      .from('novedades_cotizador')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(error.message)
    }

    revalidatePath('/admin/novedades')
    revalidatePath('/cotizador')
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader
        rol={profile.rol}
        usuario={profile.nombre?.trim() || user.email || 'Administrador'}
        actual="ADMIN"
      />

      <div className="max-w-5xl mx-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Novedades / Beneficios
            </h2>

            <p className="text-gray-500 mt-1">
              Administrá las novedades de la propuesta al cliente y las novedades internas del Cotizador.
            </p>
          </div>

          <a
            href="/admin"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Volver al administrador
          </a>
        </div>

        {/* NOVEDADES DE LA PROPUESTA */}
        <section>
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-gray-900">
              Novedades de la Propuesta
            </h3>

            <p className="text-sm text-gray-500 mt-1">
              Estos tres cuadros aparecen debajo del total de la propuesta que se comparte con el cliente.
            </p>
          </div>

          <div className="space-y-5">
            {novedadesPropuesta?.map((novedad) => (
              <form
                key={novedad.id}
                action={actualizarNovedadPropuesta}
                className="bg-white border border-gray-200 rounded-xl p-6"
              >
                <input
                  type="hidden"
                  name="id"
                  value={novedad.id}
                />

                <div className="flex items-center justify-between mb-4">
                  <div className="text-xs font-semibold text-gray-400 uppercase">
                    Cuadro {novedad.orden}
                  </div>

                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      name="activo"
                      defaultChecked={novedad.activo}
                    />
                    Activo
                  </label>
                </div>

                <div className="mb-4">
                  <label className="block text-sm text-gray-500 mb-1">
                    Título
                  </label>

                  <input
                    type="text"
                    name="titulo"
                    defaultValue={novedad.titulo}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm text-gray-500 mb-1">
                    Contenido
                  </label>

                  <textarea
                    name="contenido"
                    rows={3}
                    defaultValue={novedad.contenido}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white resize-y"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2 rounded-lg"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            ))}
          </div>
        </section>

        {/* NOVEDADES INTERNAS DEL COTIZADOR */}
        <section className="mt-10 border-t border-gray-200 pt-8">
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-gray-900">
              Novedades del Cotizador
            </h3>

            <p className="text-sm text-gray-500 mt-1">
              Información interna para los vendedores. Se mostrará en el Cotizador debajo de Datos y antes de Cliente Claro.
            </p>
          </div>

          {/* ALTA */}
          <form
            action={crearNovedadCotizador}
            className="bg-white border border-gray-200 rounded-xl p-6 mb-5"
          >
            <div className="text-sm font-semibold text-gray-900 mb-4">
              Nueva novedad
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-500 mb-1">
                Título
              </label>

              <input
                type="text"
                name="titulo"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-500 mb-1">
                Contenido
              </label>

              <textarea
                name="contenido"
                rows={3}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white resize-y"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="activo"
                  defaultChecked
                />
                Activo
              </label>

              <button
                type="submit"
                className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2 rounded-lg"
              >
                Agregar novedad
              </button>
            </div>
          </form>

          {/* LISTADO */}
          <div className="space-y-5">
            {novedadesCotizador?.length === 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500">
                Todavía no hay novedades internas cargadas.
              </div>
            )}

            {novedadesCotizador?.map((novedad) => (
              <div
                key={novedad.id}
                className="bg-white border border-gray-200 rounded-xl p-6"
              >
                <form action={actualizarNovedadCotizador}>
                  <input
                    type="hidden"
                    name="id"
                    value={novedad.id}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-gray-500">
                        Orden
                      </label>

                      <input
                        type="number"
                        name="orden"
                        min="1"
                        defaultValue={novedad.orden}
                        className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        name="activo"
                        defaultChecked={novedad.activo}
                      />
                      Activo
                    </label>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm text-gray-500 mb-1">
                      Título
                    </label>

                    <input
                      type="text"
                      name="titulo"
                      required
                      defaultValue={novedad.titulo}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm text-gray-500 mb-1">
                      Contenido
                    </label>

                    <textarea
                      name="contenido"
                      rows={3}
                      required
                      defaultValue={novedad.contenido}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white resize-y"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2 rounded-lg"
                    >
                      Guardar
                    </button>
                  </div>
                </form>

                <form
                  action={eliminarNovedadCotizador}
                  className="mt-3 pt-3 border-t border-gray-100 flex justify-end"
                >
                  <input
                    type="hidden"
                    name="id"
                    value={novedad.id}
                  />

                  <button
                    type="submit"
                    className="text-sm font-medium text-red-600 hover:text-red-700"
                  >
                    Eliminar
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
