'use server'

import { createClient } from '../../utils/supabase/server'
import { createAdminClient } from '../../utils/supabase/admin'

export async function finalizarCambioPassword(): Promise<{
  ok: boolean
  rol?: string
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false }
  }

  const admin = createAdminClient()

  const { data: profile, error } = await admin
    .from('profiles')
    .update({
      debe_cambiar_password: false,
    })
    .eq('id', user.id)
    .select('rol')
    .single()

  if (error || !profile) {
    console.error(
      'Error al limpiar debe_cambiar_password:',
      error
    )

    return { ok: false }
  }

  return {
    ok: true,
    rol: profile.rol,
  }
}
