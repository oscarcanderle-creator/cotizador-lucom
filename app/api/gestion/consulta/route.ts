import { NextResponse } from 'next/server'

import { createAdminClient } from '../../../../utils/supabase/admin'
import { createClient } from '../../../../utils/supabase/server'
import { enviarEmailGmail } from '../../../../utils/google/gmail'

export const runtime = 'nodejs'

type ConsultaGestion = {
  id: number
  vendedor_id: string
  tipo_consulta_id: number
  cliente: string | null
  dni: string | null
  telefono: string
  tipo_domicilio: string | null
  domicilio: string | null
  entrecalles: string | null
  localidad: string | null
  observaciones: string | null
  estado_deuda_id: number | null
  estado_cobertura_id: number | null
}

type Cambio = {
  campo: string
  anterior: string
  nuevo: string
}

type BodyGestionConsulta = {
  consulta_id: number
  cliente: string | null
  dni: string | null
  telefono: string
  tipo_domicilio: string | null
  domicilio: string | null
  entrecalles: string | null
  localidad: string | null
  observaciones: string | null
  estado_deuda_id: number | null
  estado_cobertura_id: number | null
}

const CAMPOS_CONSULTA = `
  id,
  vendedor_id,
  tipo_consulta_id,
  cliente,
  dni,
  telefono,
  tipo_domicilio,
  domicilio,
  entrecalles,
  localidad,
  observaciones,
  estado_deuda_id,
  estado_cobertura_id
`

const ETIQUETAS_TIPO_DOMICILIO: Record<string, string> = {
  CASA: 'Casa',
  EDIFICIO: 'Edificio',
  BARRIO_CERRADO: 'Barrio Cerrado',
  BARRIO_ABIERTO: 'Barrio Abierto',
}

const ETIQUETAS_TIPO_CONSULTA: Record<string, string> = {
  DEUDA_CLIENTE: 'Consulta Deuda Cliente',
  DOMICILIO_COBERTURA: 'Consulta Cobertura BAF',
  DOMICILIO_DEUDA: 'Consulta Deuda Cliente + Cobertura BAF',
}

function texto(valor: unknown) {
  if (valor === null || valor === undefined || valor === '') return '—'
  return String(valor)
}

function textoDomicilio(valor: string | null) {
  if (!valor) return '—'
  return ETIQUETAS_TIPO_DOMICILIO[valor] || valor
}

function fechaArgentina(fecha: Date) {
  const partes = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(fecha)

  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value || ''

  return `${valor('day')}/${valor('month')}/${valor('year')} ${valor('hour')}:${valor('minute')}:${valor('second')}`
}

function mensajeError(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 4000)
  return String(error).slice(0, 4000)
}

function referenciaConsulta(
  codigoTipo: string,
  consulta: ConsultaGestion
) {
  if (codigoTipo === 'DEUDA_CLIENTE') {
    return {
      tabla: `DNI: ${texto(consulta.dni)}`,
      cuerpo: [`DNI: ${texto(consulta.dni)}`],
    }
  }

  if (codigoTipo === 'DOMICILIO_COBERTURA') {
    return {
      tabla: `Domicilio: ${texto(consulta.domicilio)}`,
      cuerpo: [`Domicilio: ${texto(consulta.domicilio)}`],
    }
  }

  if (codigoTipo === 'DOMICILIO_DEUDA') {
    return {
      tabla: `DNI: ${texto(consulta.dni)} | Domicilio: ${texto(consulta.domicilio)}`,
      cuerpo: [
        `DNI: ${texto(consulta.dni)}`,
        `Domicilio: ${texto(consulta.domicilio)}`,
      ],
    }
  }

  return {
    tabla: `Consulta #${consulta.id}`,
    cuerpo: [`Consulta: #${consulta.id}`],
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Sesión no válida.' },
      { status: 401 }
    )
  }

  let body: BodyGestionConsulta

  try {
    body = (await request.json()) as BodyGestionConsulta
  } catch {
    return NextResponse.json(
      { error: 'Solicitud inválida.' },
      { status: 400 }
    )
  }

  if (!Number.isInteger(Number(body.consulta_id))) {
    return NextResponse.json(
      { error: 'Consulta inválida.' },
      { status: 400 }
    )
  }

  const consultaId = Number(body.consulta_id)

  const { data: anteriorData, error: anteriorError } = await supabase
    .from('consultas')
    .select(CAMPOS_CONSULTA)
    .eq('id', consultaId)
    .single()

  if (anteriorError || !anteriorData) {
    return NextResponse.json(
      { error: anteriorError?.message || 'No se encontró la Consulta.' },
      { status: 404 }
    )
  }

  const anterior = anteriorData as unknown as ConsultaGestion

  const { error: rpcError } = await supabase.rpc(
    'gestionar_consulta_completa',
    {
      p_consulta_id: consultaId,
      p_cliente: body.cliente,
      p_dni: body.dni,
      p_telefono: body.telefono,
      p_tipo_domicilio: body.tipo_domicilio,
      p_domicilio: body.domicilio,
      p_entrecalles: body.entrecalles,
      p_localidad: body.localidad,
      p_observaciones: body.observaciones,
      p_estado_deuda_id: body.estado_deuda_id,
      p_estado_cobertura_id: body.estado_cobertura_id,
    }
  )

  if (rpcError) {
    return NextResponse.json(
      { error: rpcError.message },
      { status: 400 }
    )
  }

  const { data: posteriorData, error: posteriorError } = await supabase
    .from('consultas')
    .select(CAMPOS_CONSULTA)
    .eq('id', consultaId)
    .single()

  if (posteriorError || !posteriorData) {
    // La gestión ya quedó guardada. No devolvemos un error de guardado.
    console.error(
      'Consulta guardada, pero no se pudo releer para notificar:',
      posteriorError
    )

    return NextResponse.json({
      ok: true,
      cambios: 0,
      notificacion: 'ERROR',
      aviso: 'La gestión se guardó, pero no se pudo generar la notificación.',
    })
  }

  const posterior = posteriorData as unknown as ConsultaGestion

  const idsEstado = Array.from(
    new Set(
      [
        anterior.estado_deuda_id,
        posterior.estado_deuda_id,
        anterior.estado_cobertura_id,
        posterior.estado_cobertura_id,
      ].filter((id): id is number => id != null)
    )
  )

  const nombresEstado = new Map<number, string>()

  if (idsEstado.length > 0) {
    const { data: estados } = await adminClient
      .from('estados_consulta')
      .select('id,nombre')
      .in('id', idsEstado)

    for (const estado of estados || []) {
      nombresEstado.set(Number(estado.id), estado.nombre)
    }
  }

  const nombreEstado = (id: number | null) =>
    id == null ? '—' : nombresEstado.get(id) || `Estado #${id}`

  const cambios: Cambio[] = []

  const agregarCambio = (
    campo: string,
    valorAnterior: unknown,
    valorNuevo: unknown,
    formatear: (valor: any) => string = texto
  ) => {
    const anteriorTexto = formatear(valorAnterior)
    const nuevoTexto = formatear(valorNuevo)

    if (anteriorTexto !== nuevoTexto) {
      cambios.push({
        campo,
        anterior: anteriorTexto,
        nuevo: nuevoTexto,
      })
    }
  }

  agregarCambio('Cliente', anterior.cliente, posterior.cliente)
  agregarCambio('DNI', anterior.dni, posterior.dni)
  agregarCambio('Teléfono', anterior.telefono, posterior.telefono)
  agregarCambio(
    'Tipo de domicilio',
    anterior.tipo_domicilio,
    posterior.tipo_domicilio,
    textoDomicilio
  )
  agregarCambio('Domicilio', anterior.domicilio, posterior.domicilio)
  agregarCambio('Entre calles', anterior.entrecalles, posterior.entrecalles)
  agregarCambio('Localidad', anterior.localidad, posterior.localidad)
  agregarCambio('Observaciones', anterior.observaciones, posterior.observaciones)
  agregarCambio(
    'Estado Deuda',
    anterior.estado_deuda_id,
    posterior.estado_deuda_id,
    nombreEstado
  )
  agregarCambio(
    'Estado Cobertura',
    anterior.estado_cobertura_id,
    posterior.estado_cobertura_id,
    nombreEstado
  )

  if (cambios.length === 0) {
    return NextResponse.json({
      ok: true,
      cambios: 0,
      notificacion: 'NO_CAMBIOS',
    })
  }

  const { data: tipoConsulta, error: tipoError } = await adminClient
    .from('tipos_consulta')
    .select('codigo,nombre')
    .eq('id', posterior.tipo_consulta_id)
    .single()

  const codigoTipo = tipoConsulta?.codigo || ''
  const nombreTipo =
    ETIQUETAS_TIPO_CONSULTA[codigoTipo] ||
    tipoConsulta?.nombre ||
    'Consulta'

  const referencia = referenciaConsulta(codigoTipo, posterior)
  const fechaGestion = new Date()

  const { data: actorProfile } = await adminClient
    .from('profiles')
    .select('nombre')
    .eq('id', user.id)
    .single()

  const responsableNombre =
    actorProfile?.nombre?.trim() || user.email || 'Usuario'

  const asunto = 'Notificación de Gestión CONSULTA'
  const mensaje = [
    asunto,
    '',
    nombreTipo,
    ...referencia.cuerpo,
    '',
    `Fecha de gestión: ${fechaArgentina(fechaGestion)}`,
    `Responsable: ${responsableNombre}`,
    '',
    'Cambios realizados:',
    ...cambios.map(
      (cambio) => `${cambio.campo}: ${cambio.anterior} → ${cambio.nuevo}`
    ),
  ].join('\n')

  let destinatario: string | null = null
  let errorDestinatario: string | null = null

  try {
    const { data: vendedorAuth, error: vendedorAuthError } =
      await adminClient.auth.admin.getUserById(posterior.vendedor_id)

    if (vendedorAuthError) throw vendedorAuthError

    destinatario = vendedorAuth.user?.email?.trim().toLowerCase() || null

    if (!destinatario) {
      throw new Error('El Vendedor no tiene email configurado en Supabase Auth.')
    }
  } catch (error) {
    errorDestinatario = mensajeError(error)
  }

  const estadoInicial = errorDestinatario ? 'ERROR' : 'PENDIENTE'

  const { data: notificacion, error: notificacionError } = await adminClient
    .from('notificaciones')
    .insert({
      operacion_id: null,
      usuario_id: posterior.vendedor_id,
      canal: 'EMAIL',
      asunto,
      mensaje,
      destinatario,
      estado: estadoInicial,
      error_envio: errorDestinatario,
      tipo_gestion: 'CONSULTA',
      registro_id: String(posterior.id),
      referencia: referencia.tabla,
      cambios,
      responsable_id: user.id,
      responsable_nombre: responsableNombre,
      intentos: errorDestinatario ? 1 : 0,
    })
    .select('id')
    .single()

  if (notificacionError || !notificacion) {
    console.error(
      'Consulta guardada, pero no se pudo registrar la notificación:',
      notificacionError
    )

    return NextResponse.json({
      ok: true,
      cambios: cambios.length,
      notificacion: 'ERROR',
      aviso: 'La gestión se guardó, pero no se pudo registrar la notificación.',
    })
  }

  if (errorDestinatario || !destinatario) {
    return NextResponse.json({
      ok: true,
      cambios: cambios.length,
      notificacion: 'ERROR',
      aviso: 'La gestión se guardó, pero el Vendedor no tiene un email utilizable.',
    })
  }

  try {
    await enviarEmailGmail({
      destinatario,
      asunto,
      mensaje,
    })

    const ahora = new Date().toISOString()
    const { error: updateError } = await adminClient
      .from('notificaciones')
      .update({
        estado: 'ENVIADA',
        fecha_envio: ahora,
        error_envio: null,
        intentos: 1,
        updated_at: ahora,
      })
      .eq('id', notificacion.id)

    if (updateError) {
      console.error(
        'Email enviado, pero no se pudo marcar la notificación como ENVIADA:',
        updateError
      )
    }

    return NextResponse.json({
      ok: true,
      cambios: cambios.length,
      notificacion: 'ENVIADA',
    })
  } catch (error) {
    const detalleError = mensajeError(error)
    const ahora = new Date().toISOString()

    const { error: updateError } = await adminClient
      .from('notificaciones')
      .update({
        estado: 'ERROR',
        error_envio: detalleError,
        intentos: 1,
        updated_at: ahora,
      })
      .eq('id', notificacion.id)

    if (updateError) {
      console.error(
        'No se pudo guardar el error de envío de la notificación:',
        updateError
      )
    }

    return NextResponse.json({
      ok: true,
      cambios: cambios.length,
      notificacion: 'ERROR',
      aviso: 'La gestión se guardó, pero no se pudo enviar el email.',
    })
  }
}
