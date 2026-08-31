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

function normalizarCodigo(valor: FormDataEntryValue | null) {
  return String(valor ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

const TIPOS_ESTADO = ['GESTIONADO', 'NO_GESTIONADO'] as const

export default async function Page() {
  const { admin, user, profile } = await validarAdmin()

  const [estadosResult, tiposResult] = await Promise.all([
    admin
      .from('estados_pedido')
      .select('id, codigo, nombre, tipo_estado, activo, orden, tipo_pedido_id')
      .order('tipo_pedido_id')
      .order('orden')
      .order('nombre'),
    admin
      .from('tipos_pedido')
      .select('id, codigo, nombre, activo, orden')
      .order('orden')
      .order('nombre'),
  ])

  if (estadosResult.error) {
    throw new Error(estadosResult.error.message)
  }

  if (tiposResult.error) {
    throw new Error(tiposResult.error.message)
  }

  const estados = estadosResult.data ?? []
  const tiposPedido = tiposResult.data ?? []
  const tiposActivos = tiposPedido.filter((tipo) => tipo.activo)
  const tipoMap = new Map(
    tiposPedido.map((tipo) => [Number(tipo.id), tipo])
  )

  async function crearEstado(formData: FormData) {
    'use server'

    const { admin } = await validarAdmin()

    const codigo = normalizarCodigo(formData.get('codigo'))
    const nombre = String(formData.get('nombre') ?? '').trim()
    const tipoEstado = String(formData.get('tipo_estado') ?? '')
      .trim()
      .toUpperCase()
    const orden = Number(formData.get('orden') ?? 0)
    const tipoPedidoId = Number(formData.get('tipo_pedido_id'))

    if (!codigo || !nombre) {
      throw new Error('Código y nombre son obligatorios.')
    }

    if (!Number.isInteger(tipoPedidoId) || tipoPedidoId <= 0) {
      throw new Error('El Tipo de Pedido es obligatorio.')
    }

    if (!TIPOS_ESTADO.includes(tipoEstado as (typeof TIPOS_ESTADO)[number])) {
      throw new Error('Tipo de estado inválido.')
    }

    const { data: tipoPedido, error: tipoError } = await admin
      .from('tipos_pedido')
      .select('id, activo')
      .eq('id', tipoPedidoId)
      .maybeSingle()

    if (tipoError) {
      throw new Error(tipoError.message)
    }

    if (!tipoPedido || !tipoPedido.activo) {
      throw new Error('El Tipo de Pedido seleccionado no está disponible.')
    }

    const { error } = await admin
      .from('estados_pedido')
      .insert({
        codigo,
        nombre,
        tipo_estado: tipoEstado,
        orden: Number.isFinite(orden) ? orden : 0,
        activo: true,
        tipo_pedido_id: tipoPedidoId,
      })

    if (error) {
      throw new Error(error.message)
    }

    revalidatePath('/admin/estados-pedido')
    redirect('/admin/estados-pedido')
  }

  async function actualizarEstado(formData: FormData) {
    'use server'

    const { admin } = await validarAdmin()

    const id = Number(formData.get('id'))
    const nombre = String(formData.get('nombre') ?? '').trim()
    const tipoEstado = String(formData.get('tipo_estado') ?? '')
      .trim()
      .toUpperCase()
    const orden = Number(formData.get('orden') ?? 0)
    const activo = formData.get('activo') === 'on'
    const tipoPedidoId = Number(formData.get('tipo_pedido_id'))

    if (!Number.isInteger(id) || id <= 0 || !nombre) {
      throw new Error('Datos de estado de pedido inválidos.')
    }

    if (!Number.isInteger(tipoPedidoId) || tipoPedidoId <= 0) {
      throw new Error('El Tipo de Pedido es obligatorio.')
    }

    if (!TIPOS_ESTADO.includes(tipoEstado as (typeof TIPOS_ESTADO)[number])) {
      throw new Error('Tipo de estado inválido.')
    }

    const { data: estadoActual, error: estadoActualError } = await admin
      .from('estados_pedido')
      .select('id, tipo_pedido_id')
      .eq('id', id)
      .maybeSingle()

    if (estadoActualError) {
      throw new Error(estadoActualError.message)
    }

    if (!estadoActual) {
      throw new Error('El estado de Pedido no existe.')
    }

    if (Number(estadoActual.tipo_pedido_id) !== tipoPedidoId) {
      const { count, error: usoError } = await admin
        .from('pedidos')
        .select('id', { count: 'exact', head: true })
        .eq('estado_pedido_id', id)

      if (usoError) {
        throw new Error(usoError.message)
      }

      if ((count ?? 0) > 0) {
        throw new Error(
          'No se puede cambiar el Tipo de Pedido de un estado que ya fue utilizado. Creá un estado nuevo para el otro tipo.'
        )
      }
    }

    const { data: tipoPedido, error: tipoError } = await admin
      .from('tipos_pedido')
      .select('id')
      .eq('id', tipoPedidoId)
      .maybeSingle()

    if (tipoError) {
      throw new Error(tipoError.message)
    }

    if (!tipoPedido) {
      throw new Error('El Tipo de Pedido seleccionado no existe.')
    }

    const { error } = await admin
      .from('estados_pedido')
      .update({
        nombre,
        tipo_estado: tipoEstado,
        orden: Number.isFinite(orden) ? orden : 0,
        activo,
        tipo_pedido_id: tipoPedidoId,
      })
      .eq('id', id)

    if (error) {
      throw new Error(error.message)
    }

    revalidatePath('/admin/estados-pedido')
    redirect('/admin/estados-pedido')
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader
        rol={profile.rol}
        usuario={profile.nombre?.trim() || user.email || 'Administrador'}
        actual="ADMIN"
      />

      <div className="max-w-7xl mx-auto px-4 py-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-red-600">
              Estados de Pedido
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Administrá los estados disponibles para cada Tipo de Pedido.
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
            Nuevo estado de pedido
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[220px_190px_1fr_190px_100px_auto] gap-3 xl:items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Tipo de Pedido
              </label>
              <select
                name="tipo_pedido_id"
                required
                defaultValue=""
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
              >
                <option value="" disabled>
                  Seleccionar...
                </option>
                {tiposActivos.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Código</label>
              <input
                type="text"
                name="codigo"
                required
                placeholder="EJEMPLO_ESTADO"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Nombre visible</label>
              <input
                type="text"
                name="nombre"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Tipo de estado</label>
              <select
                name="tipo_estado"
                required
                defaultValue="NO_GESTIONADO"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
              >
                <option value="NO_GESTIONADO">NO_GESTIONADO</option>
                <option value="GESTIONADO">GESTIONADO</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Orden</label>
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

        <div className="space-y-7">
          {tiposPedido.map((tipo) => {
            const estadosDelTipo = estados.filter(
              (estado) => Number(estado.tipo_pedido_id) === Number(tipo.id)
            )

            return (
              <section key={tipo.id}>
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {tipo.nombre}
                  </h2>
                  {!tipo.activo && (
                    <span className="rounded-full bg-gray-200 px-2 py-1 text-xs font-medium text-gray-600">
                      Tipo inactivo
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {estadosDelTipo.length} estado{estadosDelTipo.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="space-y-3">
                  {estadosDelTipo.map((estado) => (
                    <div
                      key={estado.id}
                      className="bg-white border border-gray-200 rounded-xl p-4"
                    >
                      <form
                        action={actualizarEstado}
                        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[220px_190px_1fr_190px_100px_auto_auto] gap-3 xl:items-end"
                      >
                        <input type="hidden" name="id" value={estado.id} />

                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Tipo de Pedido
                          </label>
                          <select
                            name="tipo_pedido_id"
                            required
                            defaultValue={String(estado.tipo_pedido_id)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                          >
                            {tiposPedido.map((opcion) => (
                              <option key={opcion.id} value={opcion.id}>
                                {opcion.nombre}{opcion.activo ? '' : ' (inactivo)'}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Código</label>
                          <input
                            type="text"
                            value={estado.codigo}
                            readOnly
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-100 text-gray-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Nombre visible</label>
                          <input
                            type="text"
                            name="nombre"
                            defaultValue={estado.nombre}
                            required
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Tipo de estado</label>
                          <select
                            name="tipo_estado"
                            required
                            defaultValue={estado.tipo_estado}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                          >
                            <option value="NO_GESTIONADO">NO_GESTIONADO</option>
                            <option value="GESTIONADO">GESTIONADO</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Orden</label>
                          <input
                            type="number"
                            name="orden"
                            defaultValue={estado.orden ?? 0}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                          />
                        </div>

                        <label className="flex items-center gap-2 text-sm text-gray-700 xl:pb-2">
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
                    </div>
                  ))}

                  {estadosDelTipo.length === 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl p-5 text-sm text-gray-500">
                      Este Tipo de Pedido todavía no tiene estados cargados.
                    </div>
                  )}
                </div>
              </section>
            )
          })}

          {tiposPedido.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
              No hay Tipos de Pedido cargados.
            </div>
          )}

          {estados.some((estado) => !tipoMap.has(Number(estado.tipo_pedido_id))) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              Hay estados asociados a un Tipo de Pedido que ya no está disponible en el catálogo.
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
