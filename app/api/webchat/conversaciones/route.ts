import { NextRequest, NextResponse } from 'next/server'
import { autenticarWebchat } from '../../../../lib/webchat/auth'
import { puedeContactar, type PerfilChat } from '../../../../lib/webchat/permisos'

export const dynamic = 'force-dynamic'

const noCache = { 'Cache-Control': 'no-store' }

export async function GET() {
  try {
    const sesion = await autenticarWebchat()

    if ('error' in sesion) {
      return NextResponse.json(
        { error: sesion.error },
        { status: sesion.status }
      )
    }

    const { admin, user } = sesion

    const { data: participaciones, error } = await admin
      .from('chat_participantes')
      .select('conversacion_id, ultima_lectura_en')
      .eq('usuario_id', user.id)

    if (error) throw error

    const ids = (participaciones ?? []).map(
      (p) => p.conversacion_id
    )

    if (!ids.length) {
      return NextResponse.json(
        { conversaciones: [] },
        { headers: noCache }
      )
    }

    const [conversaciones, participantes] = await Promise.all([
      admin
        .from('chat_conversaciones')
        .select('id, creada_en, ultimo_mensaje_en')
        .in('id', ids),
      admin
        .from('chat_participantes')
        .select('conversacion_id, usuario_id')
        .in('conversacion_id', ids),
    ])

    if (conversaciones.error) throw conversaciones.error
    if (participantes.error) throw participantes.error

    const otrosIds = [
      ...new Set(
        (participantes.data ?? [])
          .filter((p) => p.usuario_id !== user.id)
          .map((p) => p.usuario_id)
      ),
    ]

    const perfiles = otrosIds.length
      ? await admin
          .from('profiles')
          .select('id, nombre, vendedor, rol, activo')
          .in('id', otrosIds)
      : { data: [], error: null }

    if (perfiles.error) throw perfiles.error

    const nombres = new Map(
      (perfiles.data ?? []).map((p) => [p.id, p])
    )

    const resultado = (conversaciones.data ?? []).map((c) => {
      const otro = (participantes.data ?? []).find(
        (p) =>
          p.conversacion_id === c.id &&
          p.usuario_id !== user.id
      )

      return {
        ...c,
        destinatario: otro
          ? nombres.get(otro.usuario_id) ?? null
          : null,
        ultima_lectura_en:
          (participaciones ?? []).find(
            (p) => p.conversacion_id === c.id
          )?.ultima_lectura_en ?? null,
      }
    })

    const desde = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString()

    const { data: mensajes, error: mensajesError } = await admin
      .from('chat_mensajes')
      .select('conversacion_id, remitente_id, enviado_en')
      .in('conversacion_id', ids)
      .gte('enviado_en', desde)
      .order('enviado_en', { ascending: false })
      .limit(10000)

    if (mensajesError) throw mensajesError

    const conNoLeidos = resultado.map((conversacion) => ({
      ...conversacion,
      no_leidos: (mensajes ?? []).filter((mensaje) =>
        mensaje.conversacion_id === conversacion.id &&
        mensaje.remitente_id !== user.id &&
        (
          !conversacion.ultima_lectura_en ||
          mensaje.enviado_en > conversacion.ultima_lectura_en
        )
      ).length,
    }))

    conNoLeidos.sort((a, b) =>
      (b.ultimo_mensaje_en ?? b.creada_en).localeCompare(
        a.ultimo_mensaje_en ?? a.creada_en
      )
    )

    return NextResponse.json(
      { conversaciones: conNoLeidos },
      { headers: noCache }
    )
  } catch (error) {
    console.error('Webchat conversaciones GET:', error)

    return NextResponse.json(
      { error: 'No se pudieron obtener las conversaciones' },
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

    const { admin, user, perfil } = sesion
    const body = await request.json().catch(() => null)
    const destinatarioId = body?.destinatario_id

    if (
      typeof destinatarioId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(destinatarioId)
    ) {
      return NextResponse.json(
        { error: 'Destinatario inválido' },
        { status: 400 }
      )
    }

    const { data: destino, error: destinoError } = await admin
      .from('profiles')
      .select('id, nombre, vendedor, rol, activo, puede_gestionar_ventas')
      .eq('id', destinatarioId)
      .single()

    if (destinoError || !destino) {
      return NextResponse.json(
        { error: 'Destinatario no encontrado' },
        { status: 404 }
      )
    }

    if (!puedeContactar(perfil, destino as PerfilChat)) {
      return NextResponse.json(
        { error: 'Conversación no permitida' },
        { status: 403 }
      )
    }

    const { data: conversacionId, error: crearError } = await admin
      .rpc('chat_crear_conversacion_privada', {
        p_remitente: user.id,
        p_destinatario: destinatarioId,
      })

    if (crearError || !conversacionId) {
      throw crearError ?? new Error('No se pudo crear la conversación')
    }

    return NextResponse.json({
      conversacion_id: conversacionId,
    })
  } catch (error) {
    console.error('Webchat conversaciones POST:', error)

    return NextResponse.json(
      { error: 'No se pudo crear la conversación' },
      { status: 500 }
    )
  }
}
