import { NextRequest, NextResponse } from 'next/server'
import { autenticarWebchat } from '../../../../lib/webchat/auth'

export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'no-store' }

function obtenerId(valor: unknown): number | null {
  const numero = Number(valor)
  return Number.isSafeInteger(numero) && numero > 0
    ? numero
    : null
}

async function verificarParticipacion(
  admin: Extract<
    Awaited<ReturnType<typeof autenticarWebchat>>,
    { admin: unknown }
  >['admin'],
  conversacionId: number,
  usuarioId: string
) {
  const { data, error } = await admin
    .from('chat_participantes')
    .select('conversacion_id')
    .eq('conversacion_id', conversacionId)
    .eq('usuario_id', usuarioId)
    .maybeSingle()

  if (error) throw error
  return Boolean(data)
}

export async function GET(request: NextRequest) {
  try {
    const sesion = await autenticarWebchat()

    if ('error' in sesion) {
      return NextResponse.json(
        { error: sesion.error },
        { status: sesion.status }
      )
    }

    const conversacionId = obtenerId(
      request.nextUrl.searchParams.get('conversacion_id')
    )

    if (!conversacionId) {
      return NextResponse.json(
        { error: 'Conversación inválida' },
        { status: 400 }
      )
    }

    const { admin, user } = sesion

    if (!(await verificarParticipacion(admin, conversacionId, user.id))) {
      return NextResponse.json(
        { error: 'Acceso no autorizado' },
        { status: 403 }
      )
    }

    const desde = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString()

    const { data, error } = await admin
      .from('chat_mensajes')
      .select('id, conversacion_id, remitente_id, contenido, enviado_en')
      .eq('conversacion_id', conversacionId)
      .gte('enviado_en', desde)
      .order('enviado_en', { ascending: false })
      .order('id', { ascending: false })
      .limit(100)

    if (error) throw error

    return NextResponse.json(
      { mensajes: (data ?? []).reverse() },
      { headers }
    )
  } catch (error) {
    console.error('Webchat mensajes GET:', error)
    return NextResponse.json(
      { error: 'No se pudieron obtener los mensajes' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const sesion = await autenticarWebchat()

    if ('error' in sesion) {
      return NextResponse.json(
        { error: sesion.error },
        { status: sesion.status }
      )
    }

    const body = await request.json().catch(() => null)
    const conversacionId = obtenerId(body?.conversacion_id)
    const contenido =
      typeof body?.contenido === 'string'
        ? body.contenido.trim()
        : ''

    if (!conversacionId || !contenido || contenido.length > 4000) {
      return NextResponse.json(
        { error: 'Mensaje inválido (máximo 4000 caracteres)' },
        { status: 400 }
      )
    }

    const { admin, user } = sesion

    if (!(await verificarParticipacion(admin, conversacionId, user.id))) {
      return NextResponse.json(
        { error: 'Acceso no autorizado' },
        { status: 403 }
      )
    }

    const { data: mensaje, error } = await admin
      .from('chat_mensajes')
      .insert({
        conversacion_id: conversacionId,
        remitente_id: user.id,
        contenido,
      })
      .select('id, conversacion_id, remitente_id, contenido, enviado_en')
      .single()

    if (error || !mensaje) {
      throw error ?? new Error('No se creó el mensaje')
    }

    const { error: actualizarError } = await admin
      .from('chat_conversaciones')
      .update({ ultimo_mensaje_en: mensaje.enviado_en })
      .eq('id', conversacionId)

    if (actualizarError) {
      console.error('Webchat: no se actualizó fecha de conversación', actualizarError)
    }

    return NextResponse.json(
      { mensaje },
      { status: 201 }
    )
  } catch (error) {
    console.error('Webchat mensajes POST:', error)
    return NextResponse.json(
      { error: 'No se pudo enviar el mensaje' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const sesion = await autenticarWebchat()

    if ('error' in sesion) {
      return NextResponse.json(
        { error: sesion.error },
        { status: sesion.status }
      )
    }

    const body = await request.json().catch(() => null)
    const conversacionId = obtenerId(body?.conversacion_id)
    const ultimoMensajeId = obtenerId(body?.ultimo_mensaje_id)

    if (!conversacionId || !ultimoMensajeId) {
      return NextResponse.json(
        { error: 'Confirmación de lectura inválida' },
        { status: 400 }
      )
    }

    const { admin, user } = sesion

    const { data: confirmado, error } = await admin.rpc(
      'chat_confirmar_lectura',
      {
        p_usuario_id: user.id,
        p_conversacion_id: conversacionId,
        p_ultimo_mensaje_id: ultimoMensajeId,
      }
    )

    if (error) throw error

    if (confirmado !== true) {
      return NextResponse.json(
        { error: 'Lectura no autorizada o mensaje inválido' },
        { status: 403 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Webchat mensajes PATCH:', error)
    return NextResponse.json(
      { error: 'No se pudo actualizar la lectura' },
      { status: 500 }
    )
  }
}
