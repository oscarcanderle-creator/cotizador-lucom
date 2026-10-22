import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { createAdminClient } from '../../../../utils/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROLES_PERMITIDOS = ['ADMIN', 'SUPERVISOR', 'BBOO']

export async function GET(request: Request) {
  const responder = (mensaje: string, status: number) =>
    NextResponse.json(
      { error: mensaje },
      { status, headers: { 'Cache-Control': 'no-store' } }
    )

  try {
    const url = new URL(request.url)
    const intentoTexto = url.searchParams.get('intento_id') ?? ''

    if (!/^[1-9]\d*$/.test(intentoTexto)) {
      return responder('Identificador de intento inválido.', 400)
    }

    const intentoId = Number(intentoTexto)

    if (!Number.isSafeInteger(intentoId)) {
      return responder('Identificador de intento inválido.', 400)
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return responder('Sesión no válida.', 401)
    }

    const { data: perfil, error: perfilError } = await supabase
      .from('profiles')
      .select('rol,activo')
      .eq('id', user.id)
      .maybeSingle()

    if (perfilError || !perfil?.activo) {
      return responder('Perfil no autorizado.', 403)
    }

    if (!ROLES_PERMITIDOS.includes(String(perfil.rol ?? ''))) {
      return responder('No tiene permisos para ver comprobantes.', 403)
    }

    const admin = createAdminClient()

    const { data: intento, error: intentoError } = await admin
      .from('lote_despacho_gestiones')
      .select('id,gestion_entrega_id')
      .eq('id', intentoId)
      .maybeSingle()

    if (intentoError) {
      console.error('Error consultando intento:', intentoError)
      return responder('No se pudo consultar el intento.', 500)
    }

    if (!intento) {
      return responder('Intento no encontrado.', 404)
    }

    const { data: gestion, error: gestionError } = await admin
      .from('gestiones_entrega')
      .select('id,operacion_id')
      .eq('id', intento.gestion_entrega_id)
      .maybeSingle()

    if (gestionError) {
      console.error('Error consultando gestión:', gestionError)
      return responder('No se pudo consultar la gestión.', 500)
    }

    if (!gestion) {
      return responder('Gestión no encontrada.', 404)
    }

    const { data: operacion, error: operacionError } = await admin
      .from('operaciones')
      .select('id_operacion')
      .eq('id_operacion', gestion.operacion_id)
      .maybeSingle()

    if (operacionError || !operacion) {
      return responder('Operación no encontrada.', 404)
    }

    const { data: evidencia, error: evidenciaError } = await admin
      .from('evidencias_entrega')
      .select('foto_path')
      .eq('intento_id', intentoId)
      .maybeSingle()

    if (evidenciaError) {
      console.error('Error consultando evidencia:', evidenciaError)
      return responder('No se pudo consultar la evidencia.', 500)
    }

    if (!evidencia?.foto_path) {
      return responder('Este intento no tiene fotografía registrada.', 404)
    }

    const { data, error } = await admin.storage
      .from('evidencias-entrega')
      .createSignedUrl(evidencia.foto_path, 300)

    if (error || !data?.signedUrl) {
      console.error('Error generando enlace fotográfico:', error)
      return responder('No se pudo abrir el comprobante.', 500)
    }

    return NextResponse.redirect(data.signedUrl, {
      status: 302,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('Error inesperado en comprobante:', error)
    return responder('Error al consultar el comprobante.', 500)
  }
}
