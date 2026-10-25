import { createClient } from '../../utils/supabase/server'
import { createAdminClient } from '../../utils/supabase/admin'
import type { PerfilChat } from './permisos'

export async function autenticarWebchat() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { error: 'No autenticado', status: 401 } as const
  }

  const admin = createAdminClient()

  const { data: perfil, error: perfilError } = await admin
    .from('profiles')
    .select('id, nombre, vendedor, rol, activo, puede_gestionar_ventas')
    .eq('id', user.id)
    .single()

  if (perfilError || !perfil || perfil.activo !== true) {
    return { error: 'Usuario no habilitado', status: 403 } as const
  }

  return {
    user,
    perfil: perfil as PerfilChat,
    admin,
  }
}
