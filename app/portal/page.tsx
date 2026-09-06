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

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('rol, activo')
    .eq('id', user.id)
    .single()

  if (
    error ||
    !profile ||
    !profile.activo ||
    !ROLES_PORTAL.includes(profile.rol)
  ) {
    redirect('/login')
  }

  return (
    <main
      style={{
        margin: 0,
        padding: 0,
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        background: '#ffffff',
      }}
    >
      <iframe
        src="/portal/integrado"
        title="Portal Lucom"
        style={{
          width: '100%',
          height: '100%',
          border: 0,
          display: 'block',
        }}
      />
    </main>
  )
}
