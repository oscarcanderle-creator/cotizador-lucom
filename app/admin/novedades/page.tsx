import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '../../../utils/supabase/server'

export default async function AdminNovedadesPage() {
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
    redirect('/cotizador')
  }

  const {
    data: novedades,
    error,
  } = await supabase
    .from('novedades_propuesta')
    .select(
      'id, titulo, contenido, activo, orden'
    )
    .order('orden')

  if (error) {
    throw new Error(error.message)
  }

  async function actualizarNovedad(
    formData: FormData
  ) {
    'use server'

    const supabase = await createClient()

    const id = Number(
      formData.get('id')
    )

    const titulo = String(
      formData.get('titulo') ?? ''
    ).trim()

    const contenido = String(
      formData.get('contenido') ?? ''
    ).trim()

    const activo =
      formData.get('activo') === 'on'

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profile } =
      await supabase
        .from('profiles')
        .select('rol, activo')
        .eq('id', user.id)
        .single()

    if (
      !profile ||
      !profile.activo ||
      profile.rol !== 'ADMIN'
    ) {
      redirect('/cotizador')
    }

    if (!contenido) {
      throw new Error(
        'El contenido es obligatorio.'
      )
    }

    const { error } = await supabase
      .from('novedades_propuesta')
      .update({
        titulo,
        contenido,
        activo,
        updated_at:
          new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      throw new Error(error.message)
    }

    revalidatePath(
      '/admin/novedades'
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-red-600">
            Claro
          </h1>

          <p className="text-gray-500 mt-1">
            Administración del Cotizador
          </p>
        </div>

        <div className="flex items-center justify-between mb-6">

          <div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Novedades de la Propuesta
            </h2>

            <p className="text-gray-500 mt-1">
              Editá los tres cuadros informativos que aparecen debajo del total de la propuesta.
            </p>
          </div>

          <a
            href="/admin"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Volver al administrador
          </a>

        </div>

        <div className="space-y-5">

          {novedades?.map(
            (novedad) => (

              <form
                key={novedad.id}
                action={actualizarNovedad}
                className="bg-white border border-gray-200 rounded-xl p-6"
              >

                <input
                  type="hidden"
                  name="id"
                  value={novedad.id}
                />

                <div className="flex items-center justify-between mb-4">

                  <div>
                    <div className="text-xs font-semibold text-gray-400 uppercase">
                      Cuadro {novedad.orden}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      name="activo"
                      defaultChecked={
                        novedad.activo
                      }
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
                    defaultValue={
                      novedad.titulo
                    }
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
                    defaultValue={
                      novedad.contenido
                    }
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

            )
          )}

        </div>

      </div>
    </main>
  )
}
