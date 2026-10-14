import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { createAdminClient } from '../../../../utils/supabase/admin'

const ROLES_PERMITIDOS = new Set([
  'ADMIN',
  'SUPERVISOR',
  'BBOO',
])

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autenticado.' },
        { status: 401 },
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('rol, activo')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile?.activo) {
      return NextResponse.json(
        { error: 'Usuario inactivo o perfil no disponible.' },
        { status: 403 },
      )
    }

    const rol = String(profile.rol ?? '').toUpperCase()

    if (!ROLES_PERMITIDOS.has(rol)) {
      return NextResponse.json(
        { error: 'No tiene permisos para actualizar datos.' },
        { status: 403 },
      )
    }

    const body = await request.json().catch(() => null)

    const desdeId = body?.desde_id ?? 0

    if (
      !Number.isSafeInteger(desdeId) ||
      desdeId < 0
    ) {
      return NextResponse.json(
        { error: 'Identificador de lote inválido.' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    const { data, error } = await admin.rpc(
      'actualizar_datos_desde_reportes_lote',
      {
        p_usuario_id: user.id,
        p_desde_id: desdeId,
        p_limite: 100,
      },
    )

    if (error) {
      throw error
    }

    if (!data?.ok) {
      return NextResponse.json(
        {
          error: data?.mensaje || 'No se pudo actualizar los datos.',
        },
        { status: 400 },
      )
    }

    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('actualizar datos desde reportes', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo actualizar los datos.',
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autenticado.' },
        { status: 401 },
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('rol, activo')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile?.activo) {
      return NextResponse.json(
        { error: 'Usuario inactivo o perfil no disponible.' },
        { status: 403 },
      )
    }

    const rol = String(profile.rol ?? '').toUpperCase()

    if (!ROLES_PERMITIDOS.has(rol)) {
      return NextResponse.json(
        { error: 'No tiene permisos para consultar esta información.' },
        { status: 403 },
      )
    }

    const admin = createAdminClient()

    const { count, error } = await admin
      .from('reporte_fija')
      .select('sds', { count: 'exact', head: true })

    if (error) {
      throw error
    }

    return NextResponse.json({
      ok: true,
      reporte_fija_disponible: (count ?? 0) > 0,
      registros_fija: count ?? 0,
    })
  } catch (error: unknown) {
    console.error('consultar estado de actualización', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo consultar el estado de los reportes.',
      },
      { status: 500 },
    )
  }
}
