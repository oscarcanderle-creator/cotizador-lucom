import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '../../../utils/supabase/server'
import { createAdminClient } from '../../../utils/supabase/admin'
import AppHeader from '../../../components/AppHeader'

async function validarAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre,rol,activo')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.activo || profile.rol !== 'ADMIN') redirect('/ventas')

  return { supabase, user, profile }
}

function numero(fd: FormData, campo: string) {
  const valor = Number(String(fd.get(campo) ?? '').trim())
  if (!Number.isFinite(valor)) throw new Error(`${campo} inválido.`)
  return valor
}

async function crearModem(formData: FormData) {
  'use server'
  const { user } = await validarAdmin()
  const admin = createAdminClient()

  const nombre = String(formData.get('nombre') ?? '').trim()
  const precio = numero(formData, 'precio')
  const maxCuotas = numero(formData, 'max_cuotas_factura')
  const orden = numero(formData, 'orden')

  if (!nombre) throw new Error('Completá el nombre del equipo.')
  if (precio < 0) throw new Error('El precio no puede ser negativo.')
  if (!Number.isInteger(maxCuotas) || maxCuotas < 1 || maxCuotas > 60) {
    throw new Error('Máximo de cuotas inválido.')
  }

  const { error } = await admin.from('catalogo_modems_fwa').insert({
    nombre,
    precio,
    max_cuotas_factura: maxCuotas,
    activo: true,
    orden,
    updated_by: user.id,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/admin/modems-fwa')
  revalidatePath('/ventas')
  revalidatePath('/cotizador')
}

async function actualizarModem(formData: FormData) {
  'use server'
  const { user } = await validarAdmin()
  const admin = createAdminClient()

  const id = numero(formData, 'id')
  const nombre = String(formData.get('nombre') ?? '').trim()
  const precio = numero(formData, 'precio')
  const maxCuotas = numero(formData, 'max_cuotas_factura')
  const orden = numero(formData, 'orden')
  const activo = formData.get('activo') === 'on'

  if (!nombre) throw new Error('Completá el nombre del equipo.')
  if (precio < 0) throw new Error('El precio no puede ser negativo.')
  if (!Number.isInteger(maxCuotas) || maxCuotas < 1 || maxCuotas > 60) {
    throw new Error('Máximo de cuotas inválido.')
  }

  const { error } = await admin
    .from('catalogo_modems_fwa')
    .update({
      nombre,
      precio,
      max_cuotas_factura: maxCuotas,
      activo,
      orden,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/modems-fwa')
  revalidatePath('/ventas')
  revalidatePath('/cotizador')
}

export default async function ModemsFwaPage() {
  const { user, profile } = await validarAdmin()
  const admin = createAdminClient()

  const { data: modems, error } = await admin
    .from('catalogo_modems_fwa')
    .select('id,nombre,precio,max_cuotas_factura,activo,orden')
    .order('orden', { ascending: true })
    .order('id', { ascending: true })

  if (error) throw new Error(error.message)

  const usuario = profile.nombre?.trim() || user.email || 'Administrador'

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader rol={profile.rol} usuario={usuario} actual="ADMIN" />

      <div className="mx-auto max-w-5xl px-4 py-6 sm:p-8">
        <div className="mb-6">
          <a href="/admin" className="text-sm font-semibold text-red-600 hover:text-red-700">
            ← Volver a ADMIN
          </a>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">ABM Módem FWA 5G</h1>
          <p className="mt-1 text-sm text-gray-500">
            Administrá equipos, precio de venta y máximo de cuotas contra factura.
          </p>
        </div>

        <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Nuevo equipo</h2>
          <form action={crearModem} className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <input name="nombre" required placeholder="Modem FWA 5G"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
            <input name="precio" type="number" min="0" step="1" required placeholder="Precio"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
            <input name="max_cuotas_factura" type="number" min="1" max="60" step="1" required defaultValue={24}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
            <input name="orden" type="number" step="1" required defaultValue={1}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
            <button className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700">
              Agregar
            </button>
          </form>
        </section>

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Equipos configurados</h2>
          </div>

          <div className="divide-y divide-gray-200">
            {(modems ?? []).map((m: any) => (
              <form key={m.id} action={actualizarModem}
                className="grid grid-cols-1 items-end gap-3 px-5 py-4 md:grid-cols-[1.4fr_150px_170px_100px_100px_auto]">
                <input type="hidden" name="id" value={m.id} />
                <label className="text-xs text-gray-500">
                  Equipo
                  <input name="nombre" defaultValue={m.nombre} required
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
                </label>
                <label className="text-xs text-gray-500">
                  Precio
                  <input name="precio" type="number" min="0" step="1" defaultValue={Number(m.precio ?? 0)} required
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
                </label>
                <label className="text-xs text-gray-500">
                  Máx. cuotas factura
                  <input name="max_cuotas_factura" type="number" min="1" max="60" step="1"
                    defaultValue={Number(m.max_cuotas_factura ?? 24)} required
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
                </label>
                <label className="text-xs text-gray-500">
                  Orden
                  <input name="orden" type="number" step="1" defaultValue={Number(m.orden ?? 0)} required
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
                </label>
                <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
                  <input name="activo" type="checkbox" defaultChecked={Boolean(m.activo)} />
                  Activo
                </label>
                <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                  Guardar
                </button>
              </form>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
