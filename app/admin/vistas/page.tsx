import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import AppHeader from '../../../components/AppHeader'
import { createClient } from '../../../utils/supabase/server'

const ROLES = ['BBOO', 'VENDEDOR', 'SUPERVISOR', 'ADMIN'] as const
type RolVista = (typeof ROLES)[number]

async function validarAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, rol, activo')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.activo || profile.rol !== 'ADMIN') redirect('/ventas')
  return { supabase, user, profile }
}

function rolValido(valor: string): valor is RolVista {
  return ROLES.includes(valor as RolVista)
}

async function guardarVista(formData: FormData) {
  'use server'
  const { supabase } = await validarAdmin()
  const rol = String(formData.get('rol') ?? '')
  if (!rolValido(rol)) throw new Error('Rol inválido.')

  const { data: catalogo, error: catalogoError } = await supabase
    .from('catalogo_columnas_gestion_ventas')
    .select('campo')
    .eq('activo', true)

  if (catalogoError) throw new Error(`No se pudo validar el catálogo: ${catalogoError.message}`)

  const filas = (catalogo ?? []).map((item) => {
    const campo = item.campo
    const etiqueta = String(formData.get(`etiqueta__${campo}`) ?? '').trim()
    const orden = Number(formData.get(`orden__${campo}`) ?? 0)
    const ancho = Number(formData.get(`ancho__${campo}`) ?? 140)
    return {
      rol,
      campo,
      etiqueta: etiqueta || campo,
      visible: formData.get(`visible__${campo}`) === 'on',
      orden: Number.isFinite(orden) ? orden : 0,
      ancho: Math.min(600, Math.max(60, Number.isFinite(ancho) ? ancho : 140)),
      updated_at: new Date().toISOString(),
    }
  })

  const { error } = await supabase.rpc('admin_guardar_vista_gestion_ventas', {
    p_rol: rol,
    p_configuracion: filas,
  })

  if (error) throw new Error(`No se pudo guardar la vista: ${error.message}`)

  revalidatePath('/admin/vistas')
  redirect(`/admin/vistas?rol=${rol}&guardado=1`)
}

async function restaurarVista(formData: FormData) {
  'use server'
  const { supabase } = await validarAdmin()
  const rol = String(formData.get('rol') ?? '')
  if (!rolValido(rol)) throw new Error('Rol inválido.')

  const { data: catalogo, error: catalogoError } = await supabase
    .from('catalogo_columnas_gestion_ventas')
    .select('campo, etiqueta_default, ancho_default, orden_default')
    .eq('activo', true)

  if (catalogoError) throw new Error(`No se pudo cargar el catálogo: ${catalogoError.message}`)

  const visiblesBase = new Set([
    'fecha_ingreso','tipo','vendedor','responsable','cliente',
    'numero_linea','plan_cargado','estado_vendedor','estado_bboo',
  ])

  const filas = (catalogo ?? []).map((item) => ({
    rol,
    campo: item.campo,
    etiqueta: item.etiqueta_default,
    visible: visiblesBase.has(item.campo),
    orden: item.orden_default,
    ancho: item.ancho_default,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase.rpc('admin_guardar_vista_gestion_ventas', {
    p_rol: rol,
    p_configuracion: filas,
  })

  if (error) throw new Error(`No se pudo restaurar la vista: ${error.message}`)

  revalidatePath('/admin/vistas')
  redirect(`/admin/vistas?rol=${rol}&restaurado=1`)
}

export default async function AdministradorVistasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { supabase, user, profile } = await validarAdmin()
  const sp = await searchParams
  const rolSolicitado = Array.isArray(sp.rol) ? sp.rol[0] : sp.rol
  const rol: RolVista = rolSolicitado && rolValido(rolSolicitado) ? rolSolicitado : 'BBOO'

  const [{ data: catalogo, error: catalogoError }, { data: configuracion, error: configError }] =
    await Promise.all([
      supabase
        .from('catalogo_columnas_gestion_ventas')
        .select('campo, etiqueta_default, ancho_default, orden_default, aplica_baf, aplica_porta, aplica_ln')
        .eq('activo', true)
        .order('orden_default'),
      supabase
        .from('vistas_gestion_ventas')
        .select('campo, etiqueta, visible, orden, ancho')
        .eq('rol', rol)
        .order('orden'),
    ])

  if (catalogoError) throw new Error(`No se pudo cargar el catálogo: ${catalogoError.message}`)
  if (configError) throw new Error(`No se pudo cargar la vista: ${configError.message}`)

  const porCampo = new Map((configuracion ?? []).map((x) => [x.campo, x]))
  const filas = (catalogo ?? [])
    .map((c) => ({ ...c, ...(porCampo.get(c.campo) ?? {}) }))
    .sort((a, b) => Number(a.orden ?? a.orden_default) - Number(b.orden ?? b.orden_default))

  const nombreUsuario = profile.nombre?.trim() || user.email || 'Administrador'

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader rol={profile.rol} usuario={nombreUsuario} actual="ADMIN" />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:p-8">
        <a href="/admin" className="text-sm font-semibold text-red-600 hover:text-red-700">← Volver a ADMIN</a>
        <h1 className="mt-3 text-2xl font-bold text-gray-900">Administrador de Vistas</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configurá las columnas de Gestión de Ventas de forma independiente para cada rol.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <a key={r} href={`/admin/vistas?rol=${r}`}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                rol === r ? 'border-red-600 bg-red-600 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}>
              {r === 'SUPERVISOR' ? 'SUPER' : r}
            </a>
          ))}
        </div>

        <form action={guardarVista} className="mt-5">
          <input type="hidden" name="rol" value={rol} />
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-left text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-4 py-3">Visible</th>
                  <th className="px-4 py-3">Campo</th>
                  <th className="px-4 py-3">Etiqueta</th>
                  <th className="px-4 py-3">Orden</th>
                  <th className="px-4 py-3">Ancho px</th>
                  <th className="px-4 py-3">Aplica a</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filas.map((fila) => (
                  <tr key={fila.campo}>
                    <td className="px-4 py-3">
                      <input type="checkbox" name={`visible__${fila.campo}`} defaultChecked={Boolean(fila.visible)} className="h-4 w-4" />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{fila.campo}</td>
                    <td className="px-4 py-3">
                      <input name={`etiqueta__${fila.campo}`} defaultValue={fila.etiqueta ?? fila.etiqueta_default}
                        className="w-full min-w-40 rounded-lg border border-gray-300 px-3 py-2" />
                    </td>
                    <td className="px-4 py-3">
                      <input type="number" name={`orden__${fila.campo}`} defaultValue={fila.orden ?? fila.orden_default}
                        className="w-20 rounded-lg border border-gray-300 px-3 py-2" />
                    </td>
                    <td className="px-4 py-3">
                      <input type="number" min={60} max={600} name={`ancho__${fila.campo}`} defaultValue={fila.ancho ?? fila.ancho_default}
                        className="w-24 rounded-lg border border-gray-300 px-3 py-2" />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {[fila.aplica_baf && 'BAF', fila.aplica_porta && 'PORTA', fila.aplica_ln && 'LN'].filter(Boolean).join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button type="submit" className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
              Guardar vista {rol === 'SUPERVISOR' ? 'SUPER' : rol}
            </button>
          </div>
        </form>

        <form action={restaurarVista} className="mt-3">
          <input type="hidden" name="rol" value={rol} />
          <button type="submit" className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Restaurar vista predeterminada
          </button>
        </form>
      </div>
    </main>
  )
}
