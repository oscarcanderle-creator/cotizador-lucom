import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'

const ROLES_PORTAL = [
  'ADMIN',
  'BBOO',
  'SUPERVISOR',
  'TERRENO',
  'VENDEDOR',
]

export default async function PortalPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('nombre, rol, activo')
    .eq('id', user.id)
    .single()

  if (
    profileError ||
    !profile ||
    !profile.activo ||
    !ROLES_PORTAL.includes(profile.rol)
  ) {
    redirect('/login')
  }

  const { data: contenido, error: contenidoError } = await supabase
    .from('portal_contenido')
    .select('clave, data, actualizado')
    .order('clave')

  if (contenidoError) {
    throw new Error(
      `No se pudo cargar el contenido del Portal: ${contenidoError.message}`
    )
  }

  const usuario =
    profile.nombre?.trim() ||
    user.email ||
    'Usuario Lucom'

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="text-sm font-bold uppercase tracking-wider text-red-600">
            Portal Lucom
          </div>

          <h1 className="mt-2 text-3xl font-black text-slate-900">
            Integración Portal + Cotizador
          </h1>

          <p className="mt-2 text-slate-600">
            Usuario: <strong>{usuario}</strong>
          </p>

          <p className="text-slate-600">
            Rol: <strong>{profile.rol}</strong>
          </p>

          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4">
            <div className="font-bold text-green-800">
              Sesión unificada funcionando
            </div>

            <div className="mt-1 text-sm text-green-700">
              El Portal está utilizando la autenticación y el perfil del
              Cotizador Lucom.
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-lg font-black text-slate-900">
              Contenido migrado
            </h2>

            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-bold">Clave</th>
                    <th className="px-4 py-3 font-bold">Actualizado</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 bg-white">
                  {(contenido ?? []).map((item) => (
                    <tr key={item.clave}>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {item.clave}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {item.actualizado
                          ? new Date(item.actualizado).toLocaleString(
                              'es-AR',
                              {
                                timeZone:
                                  'America/Argentina/Buenos_Aires',
                              }
                            )
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-sm text-slate-500">
              Registros encontrados: {contenido?.length ?? 0}
            </p>
          </div>

          {profile.rol === 'ADMIN' && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="font-bold text-red-800">
                Modo administrador
              </div>

              <div className="mt-1 text-sm text-red-700">
                Este usuario tendrá permisos para editar el contenido del
                Portal.
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
