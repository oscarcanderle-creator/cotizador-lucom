import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '../../../utils/supabase/server'
import AppHeader from '../../../components/AppHeader'

function fechaArgentinaParaDB(valor: string) {
  /*
   * datetime-local entrega algo como:
   *
   * 2026-08-25T09:00
   *
   * No contiene zona horaria.
   * Le agregamos explícitamente Argentina (-03:00).
   */
  return new Date(
    `${valor}:00-03:00`
  ).toISOString()
}

function fechaParaInput(valor: string) {
  /*
   * Convertimos el timestamp de Supabase
   * nuevamente a hora Argentina para
   * mostrarlo correctamente en datetime-local.
   */
  const fecha = new Date(valor)

  const partes =
    new Intl.DateTimeFormat('en-CA', {
      timeZone:
        'America/Argentina/Buenos_Aires',

      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',

      hourCycle: 'h23',
    }).formatToParts(fecha)

  const obtener = (tipo: string) =>
    partes.find(
      (parte) => parte.type === tipo
    )?.value ?? ''

  return (
    `${obtener('year')}-` +
    `${obtener('month')}-` +
    `${obtener('day')}T` +
    `${obtener('hour')}:` +
    `${obtener('minute')}`
  )
}

async function validarAdmin() {
  const supabase =
    await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } =
    await supabase
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

  return {
    supabase,
    user,
    profile,
  }
}

export default async function AdminFlashPage() {
  const {
    supabase,
    user,
    profile,
  } = await validarAdmin()

  const {
    data: promociones,
    error,
  } = await supabase
    .from('promociones_flash')
    .select(
      'id, nombre, origen, porcentaje, fecha_desde, fecha_hasta, activo'
    )
    .order('fecha_desde', {
      ascending: false,
    })

  if (error) {
    throw new Error(error.message)
  }

  /*
   * =====================================================
   * CREAR PROMOCIÓN
   * =====================================================
   */

  async function crearPromocion(
    formData: FormData
  ) {
    'use server'

    const { supabase } =
      await validarAdmin()

    const origen =
      String(
        formData.get('origen') ?? ''
      )

    const porcentaje =
      Number(
        formData.get('porcentaje')
      )

    const fechaDesde =
      String(
        formData.get('fecha_desde') ?? ''
      )

    const fechaHasta =
      String(
        formData.get('fecha_hasta') ?? ''
      )

    const activo =
      formData.get('activo') === 'on'

    if (
      !origen ||
      !fechaDesde ||
      !fechaHasta ||
      !Number.isFinite(porcentaje)
    ) {
      throw new Error(
        'Faltan datos de la promoción.'
      )
    }

    if (
      porcentaje < 0 ||
      porcentaje > 100
    ) {
      throw new Error(
        'El porcentaje debe estar entre 0 y 100.'
      )
    }

    const desde =
      fechaArgentinaParaDB(
        fechaDesde
      )

    const hasta =
      fechaArgentinaParaDB(
        fechaHasta
      )

    if (
      new Date(hasta) <=
      new Date(desde)
    ) {
      throw new Error(
        'La fecha de finalización debe ser posterior al inicio.'
      )
    }

    const nombre =
      `Flash ${origen}`

    const { error } =
      await supabase
        .from('promociones_flash')
        .insert({
          nombre,
          origen,
          porcentaje,

          fecha_desde:
            desde,

          fecha_hasta:
            hasta,

          activo,
        })

    if (error) {
      throw new Error(
        error.message
      )
    }

    revalidatePath(
      '/admin/flash'
    )

    revalidatePath(
      '/cotizador'
    )
  }

  /*
   * =====================================================
   * ACTUALIZAR PROMOCIÓN
   * =====================================================
   */

  async function actualizarPromocion(
    formData: FormData
  ) {
    'use server'

    const { supabase } =
      await validarAdmin()

    const id =
      Number(
        formData.get('id')
      )

    const origen =
      String(
        formData.get('origen') ?? ''
      )

    const porcentaje =
      Number(
        formData.get('porcentaje')
      )

    const fechaDesde =
      String(
        formData.get('fecha_desde') ?? ''
      )

    const fechaHasta =
      String(
        formData.get('fecha_hasta') ?? ''
      )

    const activo =
      formData.get('activo') === 'on'

    if (
      !id ||
      !origen ||
      !fechaDesde ||
      !fechaHasta ||
      !Number.isFinite(porcentaje)
    ) {
      throw new Error(
        'Faltan datos de la promoción.'
      )
    }

    const desde =
      fechaArgentinaParaDB(
        fechaDesde
      )

    const hasta =
      fechaArgentinaParaDB(
        fechaHasta
      )

    if (
      new Date(hasta) <=
      new Date(desde)
    ) {
      throw new Error(
        'La fecha de finalización debe ser posterior al inicio.'
      )
    }

    const { error } =
      await supabase
        .from('promociones_flash')
        .update({
          nombre:
            `Flash ${origen}`,

          origen,

          porcentaje,

          fecha_desde:
            desde,

          fecha_hasta:
            hasta,

          activo,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq('id', id)

    if (error) {
      throw new Error(
        error.message
      )
    }

    revalidatePath(
      '/admin/flash'
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

      <div className="max-w-6xl mx-auto px-4 py-6 sm:p-8">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">

          <div>

            <h2 className="text-2xl font-semibold text-gray-900">
              Promociones Flash
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Descuentos temporales con vigencia exacta en horario Argentina.
            </p>

          </div>

          <a
            href="/admin"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Volver al administrador
          </a>

        </div>

        {/* NUEVA PROMOCIÓN */}

        <form
          action={crearPromocion}
          className="bg-white border border-gray-200 rounded-xl p-5 mb-7"
        >

          <h3 className="font-semibold text-gray-900 mb-4">
            Nueva promoción
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

            <div>

              <label className="block text-xs text-gray-500 mb-1">
                Origen
              </label>

              <select
                name="origen"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
              >
                <option value="PERSONAL">
                  Personal
                </option>

                <option value="MOVISTAR">
                  Movistar
                </option>
              </select>

            </div>

            <div>

              <label className="block text-xs text-gray-500 mb-1">
                Descuento %
              </label>

              <input
                type="number"
                name="porcentaje"
                min="0"
                max="100"
                step="0.01"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
              />

            </div>

            <div>

              <label className="block text-xs text-gray-500 mb-1">
                Desde
              </label>

              <input
                type="datetime-local"
                name="fecha_desde"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
              />

            </div>

            <div>

              <label className="block text-xs text-gray-500 mb-1">
                Hasta
              </label>

              <input
                type="datetime-local"
                name="fecha_hasta"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
              />

            </div>

          </div>

          <div className="flex items-center justify-between mt-4">

            <label className="flex items-center gap-2 text-sm text-gray-700">

              <input
                type="checkbox"
                name="activo"
                defaultChecked
              />

              Activa

            </label>

            <button
              type="submit"
              className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2 rounded-lg"
            >
              Crear Flash
            </button>

          </div>

        </form>

        {/* PROMOCIONES EXISTENTES */}

        <div className="space-y-4">

          {promociones &&
          promociones.length > 0 ? (

            promociones.map(
              (promo) => (

                <form
                  key={promo.id}
                  action={
                    actualizarPromocion
                  }
                  className="bg-white border border-gray-200 rounded-xl p-5"
                >

                  <input
                    type="hidden"
                    name="id"
                    value={promo.id}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_120px_1fr_1fr_auto] gap-3 items-end">

                    <div>

                      <label className="block text-xs text-gray-500 mb-1">
                        Origen
                      </label>

                      <select
                        name="origen"
                        defaultValue={
                          promo.origen
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                      >
                        <option value="PERSONAL">
                          Personal
                        </option>

                        <option value="MOVISTAR">
                          Movistar
                        </option>
                      </select>

                    </div>

                    <div>

                      <label className="block text-xs text-gray-500 mb-1">
                        %
                      </label>

                      <input
                        type="number"
                        name="porcentaje"
                        min="0"
                        max="100"
                        step="0.01"
                        defaultValue={
                          promo.porcentaje
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                      />

                    </div>

                    <div>

                      <label className="block text-xs text-gray-500 mb-1">
                        Desde
                      </label>

                      <input
                        type="datetime-local"
                        name="fecha_desde"
                        defaultValue={
                          fechaParaInput(
                            promo.fecha_desde
                          )
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                      />

                    </div>

                    <div>

                      <label className="block text-xs text-gray-500 mb-1">
                        Hasta
                      </label>

                      <input
                        type="datetime-local"
                        name="fecha_hasta"
                        defaultValue={
                          fechaParaInput(
                            promo.fecha_hasta
                          )
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                      />

                    </div>

                    <button
                      type="submit"
                      className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg"
                    >
                      Guardar
                    </button>

                  </div>

                  <div className="mt-3">

                    <label className="flex items-center gap-2 text-sm text-gray-700">

                      <input
                        type="checkbox"
                        name="activo"
                        defaultChecked={
                          promo.activo
                        }
                      />

                      Activa

                    </label>

                  </div>

                </form>

              )
            )

          ) : (

            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
              No hay promociones Flash cargadas.
            </div>

          )}

        </div>

      </div>

    </main>
  )
}
