import { redirect } from 'next/navigation'

import { createClient } from '../../utils/supabase/server'
import AppHeader from '../../components/AppHeader'
import MisConsultasClient from './MisConsultasClient'

export default async function MisConsultasPage() {
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

  if (!profile?.activo) redirect('/login')

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader
        rol={profile.rol}
        usuario={profile.nombre?.trim() || user.email || 'Usuario'}
        actual="MIS_CONSULTAS"
        puedeGestionarVentas={profile.puede_gestionar_ventas === true}
      />

      <MisConsultasClient
        userId={user.id}
        rol={profile.rol}
        puedeGestionarVentas={profile.puede_gestionar_ventas === true}
      />
    </main>
  )
}
