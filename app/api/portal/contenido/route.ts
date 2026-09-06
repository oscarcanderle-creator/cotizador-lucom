import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'No autenticado' },
      { status: 401 }
    )
  }

  const { data, error } = await supabase
    .from('portal_contenido')
    .select('clave, data, actualizado')
    .order('clave')

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    contenido: data ?? [],
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'No autenticado' },
      { status: 401 }
    )
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('rol, activo')
    .eq('id', user.id)
    .single()

  if (
    profileError ||
    !profile ||
    !profile.activo ||
    profile.rol !== 'ADMIN'
  ) {
    return NextResponse.json(
      { ok: false, error: 'Sin permisos de administrador' },
      { status: 403 }
    )
  }

  let body: {
    clave?: unknown
    data?: unknown
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'JSON inválido' },
      { status: 400 }
    )
  }

  const clave =
    typeof body.clave === 'string'
      ? body.clave.trim()
      : ''

  if (!clave) {
    return NextResponse.json(
      { ok: false, error: 'Falta clave' },
      { status: 400 }
    )
  }

  const actualizado = new Date().toISOString()

  const { error } = await supabase
    .from('portal_contenido')
    .upsert(
      {
        clave,
        data: body.data ?? {},
        actualizado,
      },
      {
        onConflict: 'clave',
      }
    )

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    actualizado,
  })
}
