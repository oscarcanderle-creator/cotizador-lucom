import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'

export const runtime = 'nodejs'

type BodyResolverCaminante = {
  operacion_id?: string
  obs?: string | null
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Sesión no válida.' },
      { status: 401 }
    )
  }

  let body: BodyResolverCaminante

  try {
    body = (await request.json()) as BodyResolverCaminante
  } catch {
    return NextResponse.json(
      { error: 'Solicitud inválida.' },
      { status: 400 }
    )
  }

  const operacionId = String(body.operacion_id || '').trim()

  if (!operacionId) {
    return NextResponse.json(
      { error: 'Operación inválida.' },
      { status: 400 }
    )
  }

  const obs =
    body.obs === undefined || body.obs === null
      ? null
      : String(body.obs).trim()

  const { data, error } = await supabase.rpc(
    'super_resolver_caminante_psr',
    {
      p_operacion_id: operacionId,
      p_obs: obs,
    }
  )

  if (error) {
    console.error('Error resolviendo Caminante PSR:', error)

    return NextResponse.json(
      {
        error:
          error.message ||
          'No se pudo resolver el Caminante contra el padrón ITEC.',
      },
      { status: 400 }
    )
  }

  return NextResponse.json(data)
}
