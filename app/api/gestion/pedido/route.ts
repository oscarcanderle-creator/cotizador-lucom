import { NextResponse } from 'next/server'

import { createAdminClient } from '../../../../utils/supabase/admin'
import { createClient } from '../../../../utils/supabase/server'
import { enviarEmailGmail } from '../../../../utils/google/gmail'

export const runtime = 'nodejs'

type PedidoGestion = {
  id: number
  codigo: string | null
  vendedor_id: string
  tipo_pedido_id: number
  domicilio: string | null
  entre_calles: string | null
  barrio: string | null
  telefono: string | null
  coordenadas: string | null
  acronimo_olt_proxima: string | null
  nombre_edificio: string | null
  torre: string | null
  cant_unidades_f: string | null
  administrador: string | null
  telefono_adm: string | null
  encargado: string | null
  telefono_enc: string | null
  notas_anexas: string | null
  id_venta_cargada: string | null
  observaciones_vendedor: string | null
  observaciones_gestion: string | null
  estado_pedido_id: number | null
}

type Cambio = {
  campo: string
  anterior: string
  nuevo: string
}

type BodyGestionPedido = {
  pedido_id: number
  domicilio: string | null
  entre_calles: string | null
  barrio: string | null
  telefono: string | null
  coordenadas: string | null
  acronimo_olt_proxima: string | null
  nombre_edificio: string | null
  torre: string | null
  cant_unidades_f: string | null
  administrador: string | null
  telefono_adm: string | null
  encargado: string | null
  telefono_enc: string | null
  notas_anexas: string | null
  id_venta_cargada: string | null
  observaciones_vendedor: string | null
  observaciones_gestion: string | null
  estado_pedido_id: number | null
}

const CAMPOS_PEDIDO = `
  id,
  codigo,
  vendedor_id,
  tipo_pedido_id,
  domicilio,
  entre_calles,
  barrio,
  telefono,
  coordenadas,
  acronimo_olt_proxima,
  nombre_edificio,
  torre,
  cant_unidades_f,
  administrador,
  telefono_adm,
  encargado,
  telefono_enc,
  notas_anexas,
  id_venta_cargada,
  observaciones_vendedor,
  observaciones_gestion,
  estado_pedido_id
`

const ETIQUETAS_TIPO_PEDIDO: Record<string, string> = {
  ACOMETIDA: 'Pedido de Acometida',
  PROYECTO: 'Pedido de Proyecto',
  AMPLIACION: 'Pedido de Ampliación',
  AMPLIACION_CUADRA_SATURADA: 'Pedido de Ampliación Cuadra Saturada',
}

function texto(valor: unknown) {
  if (valor === null || valor === undefined || valor === '') return '—'
  return String(valor)
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

function referenciaPedido(pedido: PedidoGestion) {
  const cuerpo = [`Domicilio: ${texto(pedido.domicilio)}`]

  if (pedido.barrio) cuerpo.push(`Barrio: ${texto(pedido.barrio)}`)
  if (pedido.id_venta_cargada) {
    cuerpo.push(`ID Venta Cargada: ${texto(pedido.id_venta_cargada)}`)
  }

  return {
    tabla: `Domicilio: ${texto(pedido.domicilio)}`,
    cuerpo,
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

  let body: BodyGestionPedido

  try {
    body = (await request.json()) as BodyGestionPedido
  } catch {
    return NextResponse.json(
      { error: 'Solicitud inválida.' },
      { status: 400 }
    )
  }

  if (!Number.isInteger(Number(body.pedido_id))) {
    return NextResponse.json(
      { error: 'Pedido inválido.' },
      { status: 400 }
    )
  }

  const pedidoId = Number(body.pedido_id)

  const { data: anteriorData, error: anteriorError } = await supabase
    .from('pedidos')
    .select(CAMPOS_PEDIDO)
    .eq('id', pedidoId)
    .single()

  if (anteriorError || !anteriorData) {
    return NextResponse.json(
      { error: anteriorError?.message || 'No se encontró el Pedido.' },
      { status: 404 }
    )
  }

  const anterior = anteriorData as unknown as PedidoGestion

  const { data: perfilActor } = await adminClient
    .from('profiles')
    .select('rol,activo')
    .eq('id', user.id)
    .maybeSingle()

  if (!perfilActor?.activo) {
    return NextResponse.json(
      { error: 'Usuario inactivo.' },
      { status: 403 }
    )
  }

  if (!['ADMIN', 'SUPERVISOR', 'BBOO'].includes(String(perfilActor.rol))) {
    return NextResponse.json(
      { error: 'No tenés permisos para gestionar Pedidos.' },
      { status: 403 }
    )
  }

  const { error: rpcError } = await supabase.rpc(
    'gestionar_pedido_completo',
    {
      p_pedido_id: pedidoId,
      p_domicilio: body.domicilio,
      p_entre_calles: body.entre_calles,
      p_barrio: body.barrio,
      p_telefono: body.telefono,
      p_coordenadas: body.coordenadas,
      p_acronimo_olt_proxima: body.acronimo_olt_proxima,
      p_nombre_edificio: body.nombre_edificio,
      p_torre: body.torre,
      p_cant_unidades_f: body.cant_unidades_f,
      p_administrador: body.administrador,
      p_telefono_adm: body.telefono_adm,
      p_encargado: body.encargado,
      p_telefono_enc: body.telefono_enc,
      p_notas_anexas: body.notas_anexas,
      p_id_venta_cargada: body.id_venta_cargada,
      p_observaciones_vendedor: body.observaciones_vendedor,
      p_observaciones_gestion: body.observaciones_gestion,
      p_estado_pedido_id: body.estado_pedido_id,
    }
  )

  if (rpcError) {
    return NextResponse.json(
      { error: rpcError.message },
      { status: 400 }
    )
  }

  const { data: posteriorData, error: posteriorError } = await supabase
    .from('pedidos')
    .select(CAMPOS_PEDIDO)
    .eq('id', pedidoId)
    .single()

  if (posteriorError || !posteriorData) {
    console.error(
      'Pedido guardado, pero no se pudo releer para notificar:',
      posteriorError
    )

    return NextResponse.json({
      ok: true,
      cambios: 0,
      notificacion: 'ERROR',
      aviso: 'La gestión se guardó, pero no se pudo generar la notificación.',
    })
  }

  const posterior = posteriorData as unknown as PedidoGestion

  const idsEstado = Array.from(
    new Set(
      [
        anterior.estado_pedido_id,
        posterior.estado_pedido_id,
      ].filter((id): id is number => id != null)
    )
  )

  const nombresEstado = new Map<number, string>()

  if (idsEstado.length > 0) {
    const { data: estados } = await adminClient
      .from('estados_pedido')
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

  agregarCambio('Domicilio', anterior.domicilio, posterior.domicilio)
  agregarCambio('Entre Calles', anterior.entre_calles, posterior.entre_calles)
  agregarCambio('Barrio', anterior.barrio, posterior.barrio)
  agregarCambio('Teléfono Cliente', anterior.telefono, posterior.telefono)
  agregarCambio('Coordenadas', anterior.coordenadas, posterior.coordenadas)
  agregarCambio(
    'Acrónimo OLT Próxima',
    anterior.acronimo_olt_proxima,
    posterior.acronimo_olt_proxima
  )
  agregarCambio('Nombre Edificio', anterior.nombre_edificio, posterior.nombre_edificio)
  agregarCambio('Torre', anterior.torre, posterior.torre)
  agregarCambio('Cantidad UF', anterior.cant_unidades_f, posterior.cant_unidades_f)
  agregarCambio('Nombre Administrador', anterior.administrador, posterior.administrador)
  agregarCambio(
    'Teléfono Administrador',
    anterior.telefono_adm,
    posterior.telefono_adm
  )
  agregarCambio('Nombre Encargado', anterior.encargado, posterior.encargado)
  agregarCambio(
    'Teléfono Encargado',
    anterior.telefono_enc,
    posterior.telefono_enc
  )
  agregarCambio('Notas Anexas', anterior.notas_anexas, posterior.notas_anexas)
  agregarCambio(
    'ID Venta Cargada',
    anterior.id_venta_cargada,
    posterior.id_venta_cargada
  )
  agregarCambio(
    'Observaciones',
    anterior.observaciones_vendedor,
    posterior.observaciones_vendedor
  )
  agregarCambio(
    'Observaciones Gestión',
    anterior.observaciones_gestion,
    posterior.observaciones_gestion
  )
  agregarCambio(
    'Estado Gestión',
    anterior.estado_pedido_id,
    posterior.estado_pedido_id,
    nombreEstado
  )

  if (cambios.length === 0) {
    return NextResponse.json({
      ok: true,
      cambios: 0,
      notificacion: 'NO_CAMBIOS',
    })
  }

const { data: tipoPedidoDb } = await adminClient
  .from('tipos_pedido')
  .select('codigo,nombre')
  .eq('id', posterior.tipo_pedido_id)
  .maybeSingle()  

  const codigoTipo = tipoPedidoDb?.codigo || ''
  const nombreTipo =
    ETIQUETAS_TIPO_PEDIDO[codigoTipo] ||
    tipoPedidoDb?.nombre ||
    'Pedido'

  const referencia = referenciaPedido(posterior)
  const fechaGestion = new Date()

  const { data: actorProfile } = await adminClient
    .from('profiles')
    .select('nombre')
    .eq('id', user.id)
    .single()

  const responsableNombre =
    actorProfile?.nombre?.trim() || user.email || 'Usuario'

  const asunto = 'Notificación de Gestión PEDIDO'
  const mensaje = [
    asunto,
    '',
    nombreTipo,
    `ID Pedido: ${posterior.codigo || `#${posterior.id}`}`,
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
      tipo_gestion: 'PEDIDO',
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
      'Pedido guardado, pero no se pudo registrar la notificación:',
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
