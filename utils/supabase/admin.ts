import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL

  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY

  if (
    !supabaseUrl ||
    !supabaseSecretKey
  ) {
    throw new Error(
      'Faltan variables de Supabase para el cliente ADMIN.'
    )
  }

  return createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  )
}
