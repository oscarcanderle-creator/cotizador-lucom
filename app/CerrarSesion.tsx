'use client'

import { createBrowserClient } from '@supabase/ssr'

export default function CerrarSesion() {

  async function cerrarSesion() {

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )

    await supabase.auth.signOut()

    window.location.href = '/login'
  }

  return (
    <button
      type="button"
      onClick={cerrarSesion}
      className="text-sm text-gray-500 hover:text-red-600 transition"
    >
      Cerrar sesión
    </button>
  )
}
