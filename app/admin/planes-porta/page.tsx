import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import AppHeader from '../../../components/AppHeader'
import { createClient } from '../../../utils/supabase/server'

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

async function crearPlan(formData: FormData) {
  'use server'
  const { supabase } = await validarAdmin()

  const nombre = String(formData.get('nombre') ?? '').trim()
  const orden = Number(formData.get('orden') ?? 0)

  if (!nombre || !Number.isFinite(orden)) {
    throw new Error('Datos de plan inválidos.')
  }

  const { error } = await supabase.from('catalogo_planes_porta').insert({
    nombre,
    orden,
    activo: true,
  })

  if (error) throw new Error(`No se pudo crear el plan: ${error.message}`)
  revalidatePath('/admin/planes-porta')
}

async function actualizarPlan(formData: FormData) {
  'use server'
  const { supabase } = await validarAdmin()

  const id = Number(formData.get('id'))
  const nombre = String(formData.get('nombre') ?? '').trim()
  const orden = Number(formData.get('orden') ?? 0)
  const activo = formData.get('activo') === 'on'

  if (!Number.isFinite(id) || !nombre || !Number.isFinite(orden)) {
    throw new Error('Datos de plan inválidos.')
  }

  const { error } = await supabase
    .from('catalogo_planes_porta')
    .update({ nombre, orden, activo })
    .eq('id', id)

  if (error) throw new Error(`No se pudo actualizar el plan: ${error.message}`)
  revalidatePath('/admin/planes-porta')
}

export default async function PlanesPortaPage() {
  const { supabase, user, profile } = await validarAdmin()

  const { data: planes, error } = await supabase
    .from('catalogo_planes_porta')
    .select('id, nombre, orden, activo')
    .order('orden', { ascending: true })
    .order('nombre', { ascending: true })

  if (error) {
    throw new Error(`No se pudieron cargar los planes PORTA/Línea Nueva: ${error.message}`)
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
            Planes PORTA / Línea Nueva
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Administrá los planes que se ofrecen y cargan en Portabilidad y Línea Nueva.
          </p>
        </div>

        <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Nuevo plan</h2>
          <form action={crearPlan} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px_auto]">
            <input
              name="nombre"
              required
              placeholder="Ej.: 15Gb"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              name="orden"
              type="number"
              defaultValue={0}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
            <h2 className="font-semibold text-gray-900">Planes configurados</h2>
          </div>

          <div className="divide-y divide-gray-200">
            {(planes ?? []).map((plan) => (
              <form
                key={plan.id}
                action={actualizarPlan}
                className="grid grid-cols-1 items-center gap-3 px-5 py-4 sm:grid-cols-[1fr_120px_120px_auto]"
              >
                <input type="hidden" name="id" value={plan.id} />
                <input
                  name="nombre"
                  defaultValue={plan.nombre}
                  required
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  name="orden"
                  type="number"
                  defaultValue={plan.orden ?? 0}
                  required
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    name="activo"
                    type="checkbox"
                    defaultChecked={Boolean(plan.activo)}
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

            {(planes ?? []).length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-gray-500">
                No hay planes configurados.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
