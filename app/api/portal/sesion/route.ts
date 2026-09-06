import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'

const ROLES_PORTAL = [
  'ADMIN',
  'BBOO',
  'SUPERVISOR',
  'TERRENO',
  'VENDEDOR',
]

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { ok: false, autenticado: false },
      { status: 401 }
    )
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('nombre, rol, activo')
    .eq('id', user.id)
    .single()

  if (
    error ||
    !profile ||
    !profile.activo ||
    !ROLES_PORTAL.includes(profile.rol)
  ) {
    return NextResponse.json(
      { ok: false, autenticado: false },
      { status: 403 }
    )
  }

  return NextResponse.json({
    ok: true,
    autenticado: true,
    usuario: {
      id: user.id,
      email: user.email ?? '',
      nombre: profile.nombre ?? '',
      rol: profile.rol,
      admin: profile.rol === 'ADMIN',
    },
  })
}
