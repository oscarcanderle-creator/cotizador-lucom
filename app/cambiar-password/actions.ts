'use server'

import { createClient } from '../../utils/supabase/server'
import { createAdminClient } from '../../utils/supabase/admin'

export async function finalizarCambioPassword(): Promise<{
  ok: boolean
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false }
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from('profiles')
    .update({
      debe_cambiar_password: false,
    })
    .eq('id', user.id)

  if (error) {
    console.error(
      'Error al limpiar debe_cambiar_password:',
      error
    )

    return { ok: false }
  }

  return { ok: true }
}
