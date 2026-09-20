import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import AppHeader from '../../components/AppHeader'

const ROLES_REPORTES = ['ADMIN', 'SUPERVISOR', 'BBOO']

export default async function ReportesPage() {
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
    !ROLES_REPORTES.includes(profile.rol)
  ) {
    redirect('/ventas')
  }

  const nombreUsuario =
    profile.nombre?.trim() ||
    user.email ||
    'Usuario'

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader
        rol={profile.rol}
        usuario={nombreUsuario}
        actual="REPORTES"
      />

      <div className="mx-auto max-w-6xl px-4 py-6 sm:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Reportes
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Información, mantenimiento y análisis de la operación.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/reportes/mantenimiento"
            className="rounded-xl border border-gray-200 bg-gray-100 p-5 transition hover:border-gray-300 hover:bg-gray-200 hover:shadow-sm"
          >
            <div className="text-lg font-semibold text-gray-900">
              Mantenimiento
            </div>
            <div className="mt-2 text-sm text-gray-500">
              Importación de reportes externos y exportación de información operativa.
            </div>
          </Link>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 opacity-70">
            <div className="flex items-center justify-between gap-3">
              <div className="text-lg font-semibold text-gray-900">
                Informes
              </div>
              <span className="rounded-full bg-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                Próximamente
              </span>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              Consulta y análisis detallado de la información disponible.
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 opacity-70">
            <div className="flex items-center justify-between gap-3">
              <div className="text-lg font-semibold text-gray-900">
                Dashboard
              </div>
              <span className="rounded-full bg-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                Próximamente
              </span>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              Indicadores, evolución y visualización de resultados.
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
