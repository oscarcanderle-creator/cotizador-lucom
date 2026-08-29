import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '../../../utils/supabase/server'
import AppHeader from '../../../components/AppHeader'

function unidadRegla(
  codigo: string,
  tipo: string
) {
  if (tipo === 'PORCENTAJE') {
    return '%'
  }

  if (tipo === 'IMPORTE') {
    return '$'
  }

  if (
    tipo === 'CANTIDAD' ||
    codigo === 'DECO_MAXIMO'
  ) {
    return 'unidades'
  }

  return ''
}

export default async function AdminReglasPage() {
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
    redirect('/cotizador')
  }

  const {
    data: reglas,
    error,
  } = await supabase
    .from('reglas_comerciales')
    .select(
      'id, codigo, nombre, tipo, valor, activo'
    )
    .order('id')

  if (error) {
    throw new Error(error.message)
  }

  async function actualizarRegla(
    formData: FormData
  ) {
    'use server'

    const supabase =
      await createClient()

    const id = Number(
      formData.get('id')
    )

    const valor = Number(
      formData.get('valor')
    )

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

    const { error } =
      await supabase
        .from('reglas_comerciales')
        .update({
          valor,
          activo,
          updated_at:
            new Date().toISOString(),
        })
        .eq('id', id)

    if (error) {
      throw new Error(
        error.message
      )
    }

    revalidatePath(
      '/admin/reglas'
    )

    revalidatePath(
      '/cotizador'
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader
        rol={profile.rol}
        usuario={profile.nombre?.trim() || user.email || 'Administrador'}
        actual="ADMIN"
      />

      <div className="max-w-5xl mx-auto px-4 py-6 sm:p-8">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">

          <div>

            <h2 className="text-2xl font-semibold text-gray-900">
              Reglas Comerciales
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Modificá los valores comerciales sin tocar el código.
            </p>

          </div>

          <a
            href="/admin"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Volver al administrador
          </a>

        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

          {reglas?.map(
            (regla, index) => {

              const unidad =
                unidadRegla(
                  regla.codigo,
                  regla.tipo
                )

              return (

                <form
                  key={regla.id}
                  action={actualizarRegla}
                  className={
                    index === 0
                      ? 'p-4'
                      : 'p-4 border-t border-gray-100'
                  }
                >

                  <input
                    type="hidden"
                    name="id"
                    value={regla.id}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_190px_auto_auto] gap-3 sm:items-center">

                    <div>

                      <div className="font-semibold text-gray-900">
                        {regla.nombre}
                      </div>

                    </div>

                    <div>

                      <label className="block text-xs text-gray-500 mb-1">
                        Valor
                      </label>

                      <div className="flex items-center gap-2">

                        {unidad === '$' && (
                          <span className="text-gray-500 font-medium">
                            $
                          </span>
                        )}

                        <input
                          type="number"
                          step="0.01"
                          name="valor"
                          defaultValue={
                            regla.valor
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
                        />

                        {unidad &&
                          unidad !== '$' && (
                          <span className="text-sm text-gray-500 whitespace-nowrap">
                            {unidad}
                          </span>
                        )}

                      </div>

                    </div>

                    <label className="flex items-center gap-2 text-sm text-gray-700">

                      <input
                        type="checkbox"
                        name="activo"
                        defaultChecked={
                          regla.activo
                        }
                      />

                      Activo

                    </label>

                    <button
                      type="submit"
                      className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg"
                    >
                      Guardar
                    </button>

                  </div>

                </form>

              )
            }
          )}

        </div>

      </div>

    </main>
  )
}
