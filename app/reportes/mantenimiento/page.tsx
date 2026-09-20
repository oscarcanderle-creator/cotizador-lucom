import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'
import AppHeader from '../../../components/AppHeader'

const ROLES_REPORTES = ['ADMIN', 'SUPERVISOR', 'BBOO']

export default async function MantenimientoReportesPage() {
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
          <Link
            href="/reportes"
            className="text-sm font-semibold text-red-600 hover:text-red-700"
          >
            ← Volver a Reportes
          </Link>

          <h1 className="mt-3 text-2xl font-bold text-gray-900">
            Mantenimiento
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Procesos de entrada y salida de información de la plataforma.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Link
            href="/reportes/mantenimiento/importar"
            className="rounded-xl border border-gray-200 bg-gray-100 p-5 transition hover:border-gray-300 hover:bg-gray-200 hover:shadow-sm"
          >
            <div className="text-lg font-semibold text-gray-900">
              Importar
            </div>

            <div className="mt-2 text-sm text-gray-500">
              Incorporá y actualizá información proveniente de reportes externos de Claro.
            </div>
          </Link>

          <Link
            href="/reportes/mantenimiento/exportar"
            className="rounded-xl border border-gray-200 bg-gray-100 p-5 transition hover:border-gray-300 hover:bg-gray-200 hover:shadow-sm"
          >
            <div className="text-lg font-semibold text-gray-900">
              Exportar
            </div>

            <div className="mt-2 text-sm text-gray-500">
              Prepará la información operativa para los procesos de cierre mensual.
            </div>
          </Link>
        </div>
      </div>
    </main>
  )
}
