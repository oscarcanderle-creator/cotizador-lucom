import { redirect } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/server'
import AppHeader from '../../../../components/AppHeader'
import ImportarReportesClient from './ImportarReportesClient'

const ROLES_REPORTES = ['ADMIN', 'SUPERVISOR', 'BBOO']

export default async function ImportarReportesPage() {
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

      <ImportarReportesClient />
    </main>
  )
}
