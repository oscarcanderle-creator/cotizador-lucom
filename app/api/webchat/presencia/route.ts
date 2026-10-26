import { NextResponse } from 'next/server'
import { autenticarWebchat } from '../../../../lib/webchat/auth'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const auth = await autenticarWebchat()

    if ('error' in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      )
    }

    const { error } = await auth.admin
      .from('chat_presencia')
      .upsert(
        {
          usuario_id: auth.user.id,
          ultima_actividad_en: new Date().toISOString(),
        },
        { onConflict: 'usuario_id' }
      )

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Webchat presencia POST:', error)

    return NextResponse.json(
      { error: 'No se pudo actualizar la presencia' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const auth = await autenticarWebchat()

    if ('error' in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      )
    }

    const limite = new Date(
      Date.now() - 60 * 1000
    ).toISOString()

    const { data, error } = await auth.admin
      .from('chat_presencia')
      .select('usuario_id')
      .gte('ultima_actividad_en', limite)

    if (error) throw error

    return NextResponse.json(
      {
        conectados: (data ?? []).map(
          (registro) => registro.usuario_id
        ),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (error) {
    console.error('Webchat presencia GET:', error)

    return NextResponse.json(
      { error: 'No se pudo consultar la presencia' },
      { status: 500 }
    )
  }
}
