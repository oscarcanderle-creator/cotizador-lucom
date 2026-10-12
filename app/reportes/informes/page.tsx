import EditorReportMaker from '../../../components/reportmaker/EditorReportMaker'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'
import AppHeader from '../../../components/AppHeader'

export default async function ConstructorInformesPage() {
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

  const nombreUsuario = profile.nombre?.trim() || user.email || 'Usuario'

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader
        rol={profile.rol}
        usuario={nombreUsuario}
        actual="REPORTES"
        puedeGestionarVentas={profile.puede_gestionar_ventas === true}
      />

      <div className="mx-auto max-w-6xl px-4 py-6 sm:p-8">
        <Link
          href="/reportes"
          className="text-sm font-medium text-red-700 hover:underline"
        >
          ← Volver a Reportes
        </Link>

        <h1 className="mt-6 text-2xl font-bold text-gray-900">
          ReportMaker
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          Creá informes personalizados seleccionando fuentes de información,
          columnas, períodos y filtros.
        </p>

        <div className="mt-8">
          <EditorReportMaker />
        </div>
      </div>
    </main>
  )
}
