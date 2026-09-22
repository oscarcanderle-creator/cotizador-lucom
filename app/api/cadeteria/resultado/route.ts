import { NextResponse } from 'next/server'

import { createClient } from '../../../../utils/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Sesión no válida.' },
        { status: 401 }
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('rol, activo')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !profile.activo) {
      return NextResponse.json(
        { error: 'El usuario no existe o se encuentra inactivo.' },
        { status: 403 }
      )
    }

    if (profile.rol !== 'CADETERIA') {
      return NextResponse.json(
        { error: 'El usuario no posee permisos para registrar entregas.' },
        { status: 403 }
      )
    }

    const body = await request.json()

    const intentoId = Number(body?.intentoId)
    const resultado = String(body?.resultado ?? '')
      .trim()
      .toUpperCase()

    const fechaResultado = String(body?.fechaResultado ?? '').trim()

    const motivoNoEntregaId =
      body?.motivoNoEntregaId === null ||
      body?.motivoNoEntregaId === undefined ||
      body?.motivoNoEntregaId === ''
        ? null
        : Number(body.motivoNoEntregaId)

    const observacion =
      typeof body?.observacion === 'string'
        ? body.observacion.trim() || null
        : null

    if (!Number.isInteger(intentoId) || intentoId <= 0) {
      return NextResponse.json(
        { error: 'El intento de entrega indicado no es válido.' },
        { status: 400 }
      )
    }

    if (!['ENTREGADO', 'NO_ENTREGADO'].includes(resultado)) {
      return NextResponse.json(
        { error: 'El resultado de entrega no es válido.' },
        { status: 400 }
      )
    }

    if (!fechaResultado || Number.isNaN(Date.parse(fechaResultado))) {
      return NextResponse.json(
        { error: 'La fecha del resultado no es válida.' },
        { status: 400 }
      )
    }

    if (
      resultado === 'NO_ENTREGADO' &&
      (
        motivoNoEntregaId === null ||
        !Number.isInteger(motivoNoEntregaId) ||
        motivoNoEntregaId <= 0
      )
    ) {
      return NextResponse.json(
        { error: 'Debe indicar un motivo de no entrega.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase.rpc(
      'registrar_resultado_entrega',
      {
        p_lote_despacho_gestion_id: intentoId,
        p_resultado: resultado,
        p_fecha_resultado: fechaResultado,
        p_motivo_no_entrega_id:
          resultado === 'NO_ENTREGADO'
            ? motivoNoEntregaId
            : null,
        p_observacion_cadete:
          resultado === 'NO_ENTREGADO'
            ? observacion
            : null,
      }
    )

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      ok: true,
      resultado: data,
    })
  } catch (error) {
    console.error('Error registrando resultado de Cadetería:', error)

    return NextResponse.json(
      { error: 'No se pudo registrar el resultado de la entrega.' },
      { status: 500 }
    )
  }
}
