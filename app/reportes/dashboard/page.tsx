import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../../utils/supabase/server'
import AppHeader from '../../../components/AppHeader'
import DashboardClient from './DashboardClient'

const ROLES_DASHBOARD = ['ADMIN', 'SUPERVISOR', 'BBOO', 'VENDEDOR']

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, rol, activo, puede_gestionar_ventas')
    .eq('id', user.id)
    .single()

  if (!profile?.activo) redirect('/ventas')

  if (!ROLES_DASHBOARD.includes(profile.rol)) {
    redirect('/reportes')
  }

  const nombreUsuario = profile.nombre?.trim() || user.email || 'Usuario'

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader
        rol={profile.rol}
        usuario={nombreUsuario}
        actual="REPORTES"
        puedeGestionarVentas={profile.puede_gestionar_ventas === true}
      />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:p-8">
        <Link
          href="/reportes"
          className="text-sm font-medium text-gray-600 hover:text-red-700"
        >
          ← Volver a Reportes
        </Link>

        <div className="mt-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Dashboard
          </h1>
          <p className="mt-2 text-gray-600">
            Panel de indicadores y análisis de resultados comerciales
            de Grupo Lucom.
          </p>
        </div>

        <div className="mt-8">
          <DashboardClient
            puedeVerTodos={['ADMIN', 'SUPERVISOR', 'BBOO'].includes(profile.rol)}
            puedeVerGestion={['ADMIN', 'SUPERVISOR'].includes(profile.rol)}
          />
        </div>
      </div>
    </main>
  )
}
