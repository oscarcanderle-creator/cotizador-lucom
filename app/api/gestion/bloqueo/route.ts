import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../utils/supabase/admin'
import { createClient } from '../../../../utils/supabase/server'

export const runtime = 'nodejs'

type Accion = 'ADQUIRIR' | 'RENOVAR' | 'LIBERAR'

export async function POST(request: Request) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 })

  const { data: profile } = await admin
    .from('profiles')
    .select('rol,activo,puede_gestionar_ventas')
    .eq('id', user.id)
    .maybeSingle()

  const autorizado = profile?.activo === true && (
    profile?.rol === 'ADMIN' ||
    profile?.rol === 'SUPERVISOR' ||
    profile?.rol === 'BBOO' ||
    (profile?.rol === 'VENDEDOR' && profile?.puede_gestionar_ventas === true)
  )

  if (!autorizado) return NextResponse.json({ error: 'No tiene permisos para gestionar ventas.' }, { status: 403 })

  let body: any
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const accion = String(body?.accion ?? '').toUpperCase() as Accion
  const tipoRecurso = String(body?.tipo_recurso ?? '').toUpperCase()
  const recursoClave = String(body?.recurso_clave ?? '').trim()
  const sesionToken = String(body?.sesion_token ?? '').trim()

  if (!['ADQUIRIR', 'RENOVAR', 'LIBERAR'].includes(accion) || tipoRecurso !== 'VENTA' || !recursoClave || !sesionToken) {
    return NextResponse.json({ error: 'Parámetros de bloqueo inválidos.' }, { status: 400 })
  }

  const funcion = accion === 'ADQUIRIR'
    ? 'adquirir_bloqueo_gestion'
    : accion === 'RENOVAR'
      ? 'renovar_bloqueo_gestion'
      : 'liberar_bloqueo_gestion'

  const parametros: any = {
    p_tipo_recurso: tipoRecurso,
    p_recurso_clave: recursoClave,
    p_sesion_token: sesionToken,
  }
  if (accion === 'LIBERAR') parametros.p_motivo = String(body?.motivo ?? 'CANCELADO')

  const { data, error } = await supabase.rpc(funcion, parametros)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data ?? { ok: true })
}
