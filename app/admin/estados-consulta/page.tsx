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

const AMBITOS = ['DEUDA', 'COBERTURA'] as const
const TIPOS_ESTADO = ['GESTIONADO', 'NO_GESTIONADO'] as const

export default async function Page() {
  const { admin, user, profile } = await validarAdmin()

  const { data: estados, error } = await admin
    .from('estados_consulta')
    .select('id, codigo, nombre, ambito, tipo_estado, activo, orden')
    .order('orden')
    .order('nombre')

  if (error) {
    throw new Error(error.message)
  }

  async function crearEstado(formData: FormData) {
    'use server'

    const { admin } = await validarAdmin()

    const codigo = normalizarCodigo(formData.get('codigo'))
    const nombre = String(formData.get('nombre') ?? '').trim()
    const ambito = String(formData.get('ambito') ?? '').trim().toUpperCase()
    const tipoEstado = String(formData.get('tipo_estado') ?? '').trim().toUpperCase()
    const orden = Number(formData.get('orden') ?? 0)

    if (!codigo || !nombre) {
      throw new Error('Código y nombre son obligatorios.')
    }

    if (!AMBITOS.includes(ambito as (typeof AMBITOS)[number])) {
      throw new Error('Ámbito de consulta inválido.')
    }

    if (!TIPOS_ESTADO.includes(tipoEstado as (typeof TIPOS_ESTADO)[number])) {
      throw new Error('Tipo de estado inválido.')
    }

    const { error } = await admin
      .from('estados_consulta')
      .insert({
        codigo,
        nombre,
        ambito,
        tipo_estado: tipoEstado,
        orden: Number.isFinite(orden) ? orden : 0,
        activo: true,
      })

    if (error) {
      throw new Error(error.message)
    }

    revalidatePath('/admin/estados-consulta')
    redirect('/admin/estados-consulta')
  }

  async function actualizarEstado(formData: FormData) {
    'use server'

    const { admin } = await validarAdmin()

    const id = Number(formData.get('id'))
    const nombre = String(formData.get('nombre') ?? '').trim()
    const ambito = String(formData.get('ambito') ?? '').trim().toUpperCase()
    const tipoEstado = String(formData.get('tipo_estado') ?? '').trim().toUpperCase()
    const orden = Number(formData.get('orden') ?? 0)
    const activo = formData.get('activo') === 'on'

    if (!Number.isFinite(id) || !nombre) {
      throw new Error('Datos de estado de consulta inválidos.')
    }

    if (!AMBITOS.includes(ambito as (typeof AMBITOS)[number])) {
      throw new Error('Ámbito de consulta inválido.')
    }

    if (!TIPOS_ESTADO.includes(tipoEstado as (typeof TIPOS_ESTADO)[number])) {
      throw new Error('Tipo de estado inválido.')
    }

    const { error } = await admin
      .from('estados_consulta')
      .update({
        nombre,
        ambito,
        tipo_estado: tipoEstado,
        orden: Number.isFinite(orden) ? orden : 0,
        activo,
      })
      .eq('id', id)

    if (error) {
      throw new Error(error.message)
    }

    revalidatePath('/admin/estados-consulta')
    redirect('/admin/estados-consulta')
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
              Estados de Consulta
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Administrá los estados de Deuda y Cobertura y su clasificación operativa.
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
            Nuevo estado de consulta
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[180px_1fr_150px_180px_90px_auto] gap-3 xl:items-end">
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
              <label className="block text-xs text-gray-500 mb-1">Ámbito</label>
              <select
                name="ambito"
                required
                defaultValue="DEUDA"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
              >
                <option value="DEUDA">DEUDA</option>
                <option value="COBERTURA">COBERTURA</option>
              </select>
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

        <div className="space-y-3">
          {(estados ?? []).map((estado) => (
            <div
              key={estado.id}
              className="bg-white border border-gray-200 rounded-xl p-4"
            >
              <form
                action={actualizarEstado}
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[180px_1fr_150px_180px_90px_auto_auto] gap-3 xl:items-end"
              >
                <input type="hidden" name="id" value={estado.id} />

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
                  <label className="block text-xs text-gray-500 mb-1">Ámbito</label>
                  <select
                    name="ambito"
                    required
                    defaultValue={estado.ambito ?? 'DEUDA'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                  >
                    <option value="DEUDA">DEUDA</option>
                    <option value="COBERTURA">COBERTURA</option>
                  </select>
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
