import { NextResponse } from 'next/server'

import { createAdminClient } from '../../../../utils/supabase/admin'
import { createClient } from '../../../../utils/supabase/server'
import { enviarEmailGmail } from '../../../../utils/google/gmail'

export const runtime = 'nodejs'

type Cambio = {
  campo: string
  anterior: string
  nuevo: string
}

type BodyGestionVenta = {
  tipo: 'BAF' | 'PORTA'
  operacion_id: string
  producto_operacion_id?: number | null
  recurso_clave: string
  sesion_token: string

  responsable_id?: string | null
  vendedor_id?: string | null
  motivo_vendedor?: string | null

  estado_baf_id?: number | null
  prospector?: string | null
  cia_celular?: string | null
  sds?: string | null
  orden_trabajo?: string | null
  linea_fija?: string | null
  fecha_instalacion?: string | null
  ciclo_cuenta?: string | null
  motivo_estado?: string | null

  estado_porta_id?: number | null
  estado_bboo_id?: number | null
  bboo_id?: string | null
  sim?: string | null
  plan_cargado?: string | null
  spn?: string | null
  pin_lnva_nro?: string | null
  documentacion_dni?: boolean | null
  medio_despacho_chip_id?: number | null
  numero_seguimiento?: string | null
  observaciones_gestion?: string | null
}

function texto(valor: unknown) {
  if (valor === null || valor === undefined || valor === '') return '—'
  return String(valor)
}

function booleano(valor: unknown) {
  if (valor === true) return 'Sí'
  if (valor === false) return 'No'
  return '—'
}

function fechaValor(valor: unknown) {
  if (!valor) return '—'

  const fecha = new Date(String(valor))
  if (Number.isNaN(fecha.getTime())) return String(valor)

  return fechaArgentina(fecha)
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

function agregarCambio(
  cambios: Cambio[],
  campo: string,
  valorAnterior: unknown,
  valorNuevo: unknown,
  formatear: (valor: any) => string = texto
) {
  const anterior = formatear(valorAnterior)
  const nuevo = formatear(valorNuevo)

  if (anterior !== nuevo) {
    cambios.push({ campo, anterior, nuevo })
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 })
  }

  let body: BodyGestionVenta

  try {
    body = (await request.json()) as BodyGestionVenta
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const operacionId = String(body.operacion_id ?? '').trim()
  const tipo = String(body.tipo ?? '').trim().toUpperCase()

  if (!operacionId || !['BAF', 'PORTA'].includes(tipo)) {
    return NextResponse.json({ error: 'Venta inválida.' }, { status: 400 })
  }

  // La identidad se valida con la sesión del usuario, pero la lectura de la
  // operación se hace con adminClient porque BBOO puede estar autorizado para
  // gestionar una venta aunque las RLS de operaciones no le permitan leerla
  // directamente con el cliente de sesión.
  const { data: operacion, error: operacionError } = await adminClient
    .from('operaciones')
    .select('id_operacion,tipo,usuario_id,vendedor,grupo_operacion')
    .eq('id_operacion', operacionId)
    .single()

  if (operacionError || !operacion) {
    return NextResponse.json(
      { error: operacionError?.message || 'No se encontró la Venta.' },
      { status: 404 }
    )
  }

  // ================================================================
  // NUEVA ARQUITECTURA MULTIPRODUCTO
  // Si llega producto_operacion_id, la gestión se resuelve por producto y
  // NO por operaciones.tipo. El flujo legacy queda intacto más abajo.
  // ================================================================
  const productoOperacionId = Number(body.producto_operacion_id ?? 0)

  if (Number.isInteger(productoOperacionId) && productoOperacionId > 0) {
    const { data: productoOperacion, error: productoOperacionError } = await adminClient
      .from('operacion_productos')
      .select('id,operacion_id,tipo_producto,responsable_id,producto_snapshot,plan_snapshot')
      .eq('id', productoOperacionId)
      .eq('operacion_id', operacionId)
      .eq('activo', true)
      .maybeSingle()

    if (productoOperacionError || !productoOperacion) {
      return NextResponse.json(
        { error: productoOperacionError?.message || 'No se encontró el producto de la Venta.' },
        { status: 404 }
      )
    }

    const tipoProducto = String(productoOperacion.tipo_producto ?? '').toUpperCase()
    const esBafProducto = tipoProducto === 'BAF'
    const esMovilProducto = ['PORTA', 'LINEA_NUEVA'].includes(tipoProducto)

    if (!esBafProducto && !esMovilProducto) {
      return NextResponse.json(
        { error: `El producto ${tipoProducto || 'sin tipo'} todavía no tiene gestión implementada.` },
        { status: 400 }
      )
    }

    if ((esBafProducto && tipo !== 'BAF') || (esMovilProducto && tipo !== 'PORTA')) {
      return NextResponse.json(
        { error: 'El tipo de gestión no corresponde al producto seleccionado.' },
        { status: 400 }
      )
    }

    // En el modelo multiproducto el bloqueo pertenece a la operación comercial completa.
    const recursoClaveCanonicoProducto = String(operacion.id_operacion)
    const recursoClaveProducto = String(body.recurso_clave ?? '').trim()
    const sesionTokenProducto = String(body.sesion_token ?? '').trim()

    if (
      !recursoClaveProducto ||
      !sesionTokenProducto ||
      recursoClaveProducto !== recursoClaveCanonicoProducto
    ) {
      return NextResponse.json(
        { error: 'La sesión de gestión no corresponde a esta Venta.' },
        { status: 409 }
      )
    }

    const { data: bloqueoValidoProducto, error: bloqueoProductoError } = await supabase.rpc(
      'validar_bloqueo_gestion',
      {
        p_tipo_recurso: 'VENTA',
        p_recurso_clave: recursoClaveCanonicoProducto,
        p_sesion_token: sesionTokenProducto,
      }
    )

    if (bloqueoProductoError || bloqueoValidoProducto !== true) {
      return NextResponse.json(
        { error: 'No se puede guardar: esta sesión ya no posee el bloqueo de gestión de la Venta.' },
        { status: 409 }
      )
    }

    const liberarBloqueoProducto = async () => {
      const { error } = await supabase.rpc('liberar_bloqueo_gestion', {
        p_tipo_recurso: 'VENTA',
        p_recurso_clave: recursoClaveCanonicoProducto,
        p_sesion_token: sesionTokenProducto,
        p_motivo: 'GUARDADO',
      })
      if (error) console.error('La venta multiproducto se guardó pero no se pudo liberar el bloqueo:', error)
    }

    const { data: actorProducto, error: actorProductoError } = await adminClient
      .from('profiles')
      .select('rol,activo,puede_gestionar_ventas,nombre,vendedor')
      .eq('id', user.id)
      .maybeSingle()

    if (actorProductoError || !actorProducto?.activo) {
      return NextResponse.json({ error: 'No se pudo validar el perfil del usuario.' }, { status: 403 })
    }

    const rolActor = String(actorProducto.rol ?? '')
    const autorizado =
      ['ADMIN', 'SUPERVISOR', 'BBOO'].includes(rolActor) ||
      (rolActor === 'VENDEDOR' && actorProducto.puede_gestionar_ventas === true)

    if (!autorizado) {
      return NextResponse.json({ error: 'No tiene permisos para gestionar esta Venta.' }, { status: 403 })
    }

    // PORTA/LN: la regla de habilitación se valida también en backend.
    if (esMovilProducto) {
      const { error: habilitacionError } = await adminClient.rpc(
        'validar_habilitacion_producto_movil',
        { p_producto_operacion_id: productoOperacionId }
      )

      if (habilitacionError) {
        return NextResponse.json(
          { error: habilitacionError.message },
          { status: 409 }
        )
      }
    }

    const tablaGestionProducto = esBafProducto
      ? 'gestion_producto_baf'
      : 'gestion_producto_movil'

    const { data: anteriorProducto, error: anteriorProductoError } = await adminClient
      .from(tablaGestionProducto)
      .select('*')
      .eq('producto_operacion_id', productoOperacionId)
      .maybeSingle()

    if (anteriorProductoError) {
      return NextResponse.json({ error: anteriorProductoError.message }, { status: 400 })
    }

    const responsableAnterior = productoOperacion.responsable_id ?? null
    let responsableNuevo = responsableAnterior

    // En Gestión de Ventas la asignación operativa no se elige desde el formulario:
    // VENDEDOR gestor siempre se representa a sí mismo; BBOO conserva Responsable comercial.
    // ADMIN/SUPERVISOR mantienen la reasignación explícita desde sus vistas.
    if (rolActor === 'VENDEDOR' && actorProducto.puede_gestionar_ventas === true) {
      if (responsableAnterior && responsableAnterior !== user.id) {
        return NextResponse.json(
          { error: 'Este producto está asignado a otro Responsable.' },
          { status: 409 }
        )
      }
      responsableNuevo = user.id
    } else if (body.responsable_id !== undefined && rolActor !== 'BBOO') {
      responsableNuevo = body.responsable_id ? String(body.responsable_id) : null
    }

    const ahora = new Date().toISOString()
    let payloadGestion: Record<string, unknown>
    let tipoVisibleProducto = tipoProducto === 'LINEA_NUEVA' ? 'Línea Nueva' : tipoProducto

    if (esBafProducto) {
      const ot = body.orden_trabajo == null ? null : String(body.orden_trabajo).trim() || null
      if (ot && !/^\d{8}$/.test(ot)) {
        return NextResponse.json(
          { error: 'La Orden de Trabajo debe contener exactamente 8 dígitos.' },
          { status: 400 }
        )
      }

      payloadGestion = {
        responsable_id: responsableNuevo,
        fecha_gestion: ahora,
        prospector: body.prospector ?? null,
        cia_celular: body.cia_celular ?? null,
        sds: body.sds ?? null,
        orden_trabajo: ot,
        linea_fija: body.linea_fija ?? null,
        fecha_instalacion: body.fecha_instalacion ?? null,
        ciclo_cuenta: body.ciclo_cuenta ?? null,
        motivo_estado: body.motivo_estado ?? null,
        estado_baf_id: body.estado_baf_id ?? null,
        updated_at: ahora,
        updated_by: user.id,
      }
    } else {
      const estadoPortaEfectivo =
        rolActor === 'BBOO'
          ? anteriorProducto?.estado_porta_id ?? null
          : body.estado_porta_id ?? null

      const estadoBbooEfectivo =
        rolActor === 'VENDEDOR'
          ? anteriorProducto?.estado_bboo_id ?? null
          : body.estado_bboo_id ?? null

      const bbooIdEfectivo =
        rolActor === 'BBOO' ? user.id : anteriorProducto?.bboo_id ?? null

      // Fechas automáticas de gestión móvil.
      // Se registran una sola vez: cambiar posteriormente de estado no borra
      // ni reemplaza la primera fecha alcanzada.
      let fechaCargaStlEfectiva = anteriorProducto?.fecha_carga_stl ?? null
      let fechaPortaEfectiva = anteriorProducto?.fecha_porta ?? null

      if (estadoPortaEfectivo != null) {
        const { data: estadoPortaSeleccionado, error: estadoPortaSeleccionadoError } =
          await adminClient
            .from('estados_porta')
            .select('codigo,nombre')
            .eq('id', estadoPortaEfectivo)
            .maybeSingle()

        if (estadoPortaSeleccionadoError) {
          return NextResponse.json(
            { error: `No se pudo validar el Estado Vendedor: ${estadoPortaSeleccionadoError.message}` },
            { status: 400 }
          )
        }

        const codigoEstadoVendedor = String(estadoPortaSeleccionado?.codigo ?? '').trim().toUpperCase()

        if (codigoEstadoVendedor === 'CARGADO_STL' && !fechaCargaStlEfectiva) {
          fechaCargaStlEfectiva = ahora
        }
      }

      // Fecha PORTA depende del Estado BBOO, no del Estado Vendedor.
      // Se registra solamente la primera vez que BBOO llega a ACTIVA NRO PORTADO.
      if (estadoBbooEfectivo != null) {
        const { data: estadoBbooSeleccionado, error: estadoBbooSeleccionadoError } =
          await adminClient
            .from('estados_bboo')
            .select('codigo,nombre')
            .eq('id', estadoBbooEfectivo)
            .maybeSingle()

        if (estadoBbooSeleccionadoError) {
          return NextResponse.json(
            { error: `No se pudo validar el Estado BBOO: ${estadoBbooSeleccionadoError.message}` },
            { status: 400 }
          )
        }

        const normalizarEstado = (valor: unknown) =>
          String(valor ?? '')
            .trim()
            .toUpperCase()
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')

        const codigoBboo = normalizarEstado(estadoBbooSeleccionado?.codigo)
        const nombreBboo = normalizarEstado(estadoBbooSeleccionado?.nombre)

        if (
          (codigoBboo === 'ACTIVA NRO PORTADO' || nombreBboo === 'ACTIVA NRO PORTADO') &&
          !fechaPortaEfectiva
        ) {
          fechaPortaEfectiva = ahora
        }
      }

      payloadGestion = {
        responsable_id: responsableNuevo,
        bboo_id: bbooIdEfectivo,
        fecha_carga_stl: fechaCargaStlEfectiva,
        sim: body.sim ?? null,
        plan_cargado: body.plan_cargado ?? null,
        sds: body.sds ?? null,
        spn: anteriorProducto?.spn ?? null,
        pin_lnva_nro: body.pin_lnva_nro ?? null,
        documentacion_dni: body.documentacion_dni ?? null,
        medio_despacho_chip_id: body.medio_despacho_chip_id ?? null,
        fecha_porta: fechaPortaEfectiva,
        numero_seguimiento: body.numero_seguimiento ?? null,
        observaciones_gestion: body.observaciones_gestion ?? null,
        estado_porta_id: estadoPortaEfectivo,
        estado_bboo_id: estadoBbooEfectivo,
        updated_at: ahora,
        updated_by: user.id,
      }
    }

    let guardarError: any = null
    if (anteriorProducto?.id) {
      const resultado = await adminClient
        .from(tablaGestionProducto)
        .update(payloadGestion)
        .eq('producto_operacion_id', productoOperacionId)
      guardarError = resultado.error
    } else {
      const resultado = await adminClient
        .from(tablaGestionProducto)
        .insert({ producto_operacion_id: productoOperacionId, ...payloadGestion })
      guardarError = resultado.error
    }

    if (guardarError) {
      return NextResponse.json({ error: guardarError.message }, { status: 400 })
    }

    if (responsableNuevo !== responsableAnterior) {
      const { error: responsableError } = await adminClient
        .from('operacion_productos')
        .update({ responsable_id: responsableNuevo, updated_at: ahora, updated_by: user.id })
        .eq('id', productoOperacionId)

      if (responsableError) {
        return NextResponse.json(
          { error: `La gestión se guardó, pero no se pudo actualizar el Responsable: ${responsableError.message}` },
          { status: 400 }
        )
      }
    }

    const { data: posteriorProducto, error: posteriorProductoError } = await adminClient
      .from(tablaGestionProducto)
      .select('*')
      .eq('producto_operacion_id', productoOperacionId)
      .single()

    if (posteriorProductoError || !posteriorProducto) {
      await liberarBloqueoProducto()
      return NextResponse.json({
        ok: true,
        cambios: 0,
        notificacion: 'ERROR',
        aviso: 'La gestión se guardó, pero no se pudo releer para auditarla.',
      })
    }

    const cambiosProducto: Cambio[] = []
    const camposProducto = esBafProducto
      ? [
          ['responsable_id', 'Responsable'],
          ['estado_baf_id', 'Estado BAF'],
          ['prospector', 'Prospector'],
          ['cia_celular', 'CIA Celular'],
          ['sds', 'SDS'],
          ['orden_trabajo', 'Orden Trabajo'],
          ['linea_fija', 'Línea Fija'],
          ['fecha_instalacion', 'Fecha Instalación'],
          ['ciclo_cuenta', 'Ciclo Cuenta'],
          ['motivo_estado', 'Motivo Estado'],
        ]
      : [
          ['responsable_id', 'Responsable'],
          ['estado_porta_id', 'Estado Vendedor'],
          ['estado_bboo_id', 'Estado BBOO'],
          ['bboo_id', 'BBOO'],
          ['fecha_carga_stl', 'Fecha Carga STL'],
          ['sim', 'SIM'],
          ['plan_cargado', 'Plan cargado'],
          ['sds', 'SDS'],
          ['pin_lnva_nro', 'PIN / LNVA NRO'],
          ['documentacion_dni', 'Documentación DNI'],
          ['medio_despacho_chip_id', 'Medio de despacho CHIP'],
          ['fecha_porta', 'Fecha PORTA'],
          ['numero_seguimiento', 'Número de seguimiento'],
          ['observaciones_gestion', 'Observaciones gestión'],
        ]

    for (const [campo, etiqueta] of camposProducto) {
      const anteriorValor = campo === 'responsable_id'
        ? responsableAnterior
        : anteriorProducto?.[campo] ?? null
      const nuevoValor = campo === 'responsable_id'
        ? responsableNuevo
        : posteriorProducto?.[campo] ?? null
      agregarCambio(cambiosProducto, etiqueta, anteriorValor, nuevoValor,
        campo === 'documentacion_dni' ? booleano : texto)
    }

    if (cambiosProducto.length > 0) {
      const filasHistorial = cambiosProducto.map((cambio) => ({
        producto_operacion_id: productoOperacionId,
        tipo_accion: 'MODIFICACION',
        campo: cambio.campo,
        etiqueta: cambio.campo,
        valor_anterior: cambio.anterior,
        valor_nuevo: cambio.nuevo,
        usuario_id: user.id,
        rol_actor: rolActor,
      }))

      const { error: historialError } = await adminClient
        .from('historial_producto')
        .insert(filasHistorial)

      if (historialError) {
        console.error('Gestión guardada, pero no se pudo registrar historial_producto:', historialError)
      }
    }

    // Historial específico de estados por producto.
    const estadoAnterior = esBafProducto
      ? anteriorProducto?.estado_baf_id ?? null
      : `${anteriorProducto?.estado_porta_id ?? ''}|${anteriorProducto?.estado_bboo_id ?? ''}`
    const estadoNuevo = esBafProducto
      ? posteriorProducto?.estado_baf_id ?? null
      : `${posteriorProducto?.estado_porta_id ?? ''}|${posteriorProducto?.estado_bboo_id ?? ''}`

    if (String(estadoAnterior ?? '') !== String(estadoNuevo ?? '')) {
      const { error: historialEstadoError } = await adminClient
        .from('historial_estados_producto')
        .insert({
          producto_operacion_id: productoOperacionId,
          tipo_producto: tipoProducto,
          estado_anterior: estadoAnterior == null ? null : String(estadoAnterior),
          estado_nuevo: estadoNuevo == null ? 'SIN_ESTADO' : String(estadoNuevo),
          usuario_id: user.id,
          observacion: 'Cambio registrado desde Gestión de Ventas',
        })

      if (historialEstadoError) {
        console.error('No se pudo registrar historial_estados_producto:', historialEstadoError)
      }
    }

    if (cambiosProducto.length === 0) {
      await liberarBloqueoProducto()
      return NextResponse.json({ ok: true, cambios: 0, notificacion: 'NO_CAMBIOS' })
    }

    // Notificación al Vendedor originante. El guardado nunca se revierte si el email falla.
    const vendedorId = operacion.usuario_id
    const responsableNombre =
      actorProducto.vendedor?.trim() || actorProducto.nombre?.trim() || user.email || 'Usuario'
    const asunto = `Notificación de Gestión ${tipoVisibleProducto}`
    const referencia = `Operación: ${operacionId} · Producto: ${productoOperacionId}`
    const mensaje = [
      asunto,
      '',
      referencia,
      `Producto: ${productoOperacion.producto_snapshot || tipoVisibleProducto} · ${productoOperacion.plan_snapshot || ''}`.trim(),
      `Vendedor: ${operacion.vendedor || '—'}`,
      `Fecha de gestión: ${fechaArgentina(new Date())}`,
      `Responsable: ${responsableNombre}`,
      '',
      'Cambios realizados:',
      ...cambiosProducto.map((cambio) => `${cambio.campo}: ${cambio.anterior} → ${cambio.nuevo}`),
    ].join('\n')

    let destinatario: string | null = null
    let errorDestinatario: string | null = null

    if (vendedorId) {
      try {
        const { data: vendedorAuth, error: vendedorAuthError } =
          await adminClient.auth.admin.getUserById(vendedorId)
        if (vendedorAuthError) throw vendedorAuthError
        destinatario = vendedorAuth.user?.email?.trim().toLowerCase() || null
        if (!destinatario) throw new Error('El Vendedor no tiene email configurado en Supabase Auth.')
      } catch (error) {
        errorDestinatario = mensajeError(error)
      }
    } else {
      errorDestinatario = 'La Venta no tiene Vendedor asignado.'
    }

    const { data: notificacion, error: notificacionError } = await adminClient
      .from('notificaciones')
      .insert({
        operacion_id: operacionId,
        usuario_id: vendedorId,
        canal: 'EMAIL',
        asunto,
        mensaje,
        destinatario,
        estado: errorDestinatario ? 'ERROR' : 'PENDIENTE',
        error_envio: errorDestinatario,
        tipo_gestion: 'VENTA',
        registro_id: String(productoOperacionId),
        referencia,
        cambios: cambiosProducto,
        responsable_id: user.id,
        responsable_nombre: responsableNombre,
        intentos: errorDestinatario ? 1 : 0,
      })
      .select('id')
      .single()

    if (notificacionError || !notificacion) {
      console.error('Gestión guardada, pero no se pudo registrar la notificación:', notificacionError)
      await liberarBloqueoProducto()
      return NextResponse.json({
        ok: true,
        cambios: cambiosProducto.length,
        notificacion: 'ERROR',
        aviso: 'La gestión se guardó, pero no se pudo registrar la notificación.',
      })
    }

    if (errorDestinatario || !destinatario) {
      await liberarBloqueoProducto()
      return NextResponse.json({
        ok: true,
        cambios: cambiosProducto.length,
        notificacion: 'ERROR',
        aviso: errorDestinatario || 'No hay destinatario para la notificación.',
      })
    }

    try {
      await enviarEmailGmail({ destinatario, asunto, mensaje })
      await adminClient
        .from('notificaciones')
        .update({
          estado: 'ENVIADA',
          fecha_envio: new Date().toISOString(),
          error_envio: null,
          intentos: 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', notificacion.id)

      await liberarBloqueoProducto()
      return NextResponse.json({
        ok: true,
        cambios: cambiosProducto.length,
        notificacion: 'ENVIADA',
      })
    } catch (error) {
      const detalleError = mensajeError(error)
      await adminClient
        .from('notificaciones')
        .update({
          estado: 'ERROR',
          error_envio: detalleError,
          intentos: 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', notificacion.id)

      await liberarBloqueoProducto()
      return NextResponse.json({
        ok: true,
        cambios: cambiosProducto.length,
        notificacion: 'ERROR',
        aviso: 'La gestión se guardó, pero no se pudo enviar el email.',
      })
    }
  }

  if (operacion.tipo !== tipo) {
    return NextResponse.json(
      { error: 'El tipo de gestión no corresponde a la Venta.' },
      { status: 400 }
    )
  }

  const recursoClaveCanonico =
    operacion.tipo === 'PORTA' && operacion.grupo_operacion
      ? String(operacion.grupo_operacion)
      : String(operacion.id_operacion)
  const recursoClave = String(body.recurso_clave ?? '').trim()
  const sesionToken = String(body.sesion_token ?? '').trim()

  if (!recursoClave || !sesionToken || recursoClave !== recursoClaveCanonico) {
    return NextResponse.json(
      { error: 'La sesión de gestión no corresponde a esta Venta.' },
      { status: 409 }
    )
  }

  const { data: bloqueoValido, error: bloqueoError } = await supabase.rpc(
    'validar_bloqueo_gestion',
    {
      p_tipo_recurso: 'VENTA',
      p_recurso_clave: recursoClaveCanonico,
      p_sesion_token: sesionToken,
    }
  )

  if (bloqueoError || bloqueoValido !== true) {
    return NextResponse.json(
      { error: 'No se puede guardar: esta sesión ya no posee el bloqueo de gestión de la Venta.' },
      { status: 409 }
    )
  }

  const liberarBloqueo = async () => {
    const { error } = await supabase.rpc('liberar_bloqueo_gestion', {
      p_tipo_recurso: 'VENTA',
      p_recurso_clave: recursoClaveCanonico,
      p_sesion_token: sesionToken,
      p_motivo: 'GUARDADO',
    })
    if (error) console.error('La venta se guardó pero no se pudo liberar el bloqueo:', error)
  }

  const { data: actorProfilePermisos, error: actorProfilePermisosError } = await adminClient
    .from('profiles')
    .select('rol,activo,puede_gestionar_ventas')
    .eq('id', user.id)
    .maybeSingle()

  if (actorProfilePermisosError || !actorProfilePermisos?.activo) {
    return NextResponse.json(
      { error: 'No se pudo validar el perfil del usuario.' },
      { status: 403 }
    )
  }

  const tablaGestion = tipo === 'BAF' ? 'gestion_baf' : 'gestion_porta'
  const { data: asignacionAnterior } = await adminClient
    .from(tablaGestion)
    .select('responsable_id')
    .eq('operacion_id', operacionId)
    .maybeSingle()

  const responsableAnteriorId = asignacionAnterior?.responsable_id ?? null
  const vendedorAnteriorId = operacion.usuario_id ?? null
  const vendedorAnteriorNombre = operacion.vendedor ?? null

  const { data: operacionesGrupo, error: operacionesGrupoError } =
    tipo === 'PORTA' && operacion.grupo_operacion
      ? await adminClient
          .from('operaciones')
          .select('id_operacion')
          .eq('grupo_operacion', operacion.grupo_operacion)
          .eq('tipo', 'PORTA')
      : { data: [{ id_operacion: operacionId }], error: null }

  if (operacionesGrupoError) {
    return NextResponse.json(
      { error: `No se pudieron identificar las líneas relacionadas: ${operacionesGrupoError.message}` },
      { status: 400 }
    )
  }

  const idsObjetivo = (operacionesGrupo ?? []).map((item: any) => String(item.id_operacion))
  if (idsObjetivo.length === 0) idsObjetivo.push(operacionId)

  // Vendedor y Responsable forman parte de la misma confirmación de Guardar.
  // SUPER/ADMIN usan la RPC de reasignación; los demás gestores solo pueden
  // actualizar Responsable mediante la RPC ya existente para gestores.
  if (body.vendedor_id !== undefined) {
    if (!['ADMIN', 'SUPERVISOR'].includes(String(actorProfilePermisos.rol))) {
      return NextResponse.json(
        { error: 'No tiene permisos para cambiar el Vendedor de esta Venta.' },
        { status: 403 }
      )
    }

    const vendedorId = String(body.vendedor_id ?? '').trim()
    if (!vendedorId) {
      return NextResponse.json({ error: 'El Vendedor es obligatorio.' }, { status: 400 })
    }

    for (const idObjetivo of idsObjetivo) {
      const { error } = await supabase.rpc('super_reasignar_venta', {
        p_operacion_id: idObjetivo,
        p_vendedor_id: vendedorId,
        p_responsable_id: body.responsable_id ?? null,
        p_motivo_vendedor: body.motivo_vendedor ?? null,
      })

      if (error) {
        return NextResponse.json(
          { error: `No se pudieron guardar las asignaciones de ${idObjetivo}: ${error.message}` },
          { status: 400 }
        )
      }
    }
  } else if (
    body.responsable_id !== undefined &&
    !['BBOO', 'VENDEDOR'].includes(String(actorProfilePermisos.rol))
  ) {
    const responsableSolicitadoId = body.responsable_id ?? null

    // Para VENDEDOR gestor / otros actores autorizados, solo ejecutar una
    // reasignación si el Responsable realmente cambió.
    //
    // BBOO queda excluido de esta rama: al gestionar una venta debe conservar
    // el Responsable existente y solamente registrarse en gestion_porta.bboo_id.
    if (responsableSolicitadoId !== responsableAnteriorId) {
      for (const idObjetivo of idsObjetivo) {
        const { error } = await supabase.rpc('gestor_asignar_responsable_venta', {
          p_operacion_id: idObjetivo,
          p_responsable_id: responsableSolicitadoId,
        })

        if (error) {
          return NextResponse.json(
            { error: `No se pudo guardar el Responsable de ${idObjetivo}: ${error.message}` },
            { status: 400 }
          )
        }
      }
    }
  }

  const cambios: Cambio[] = []
  let tipoVisible = tipo === 'BAF' ? 'BAF' : 'PORTA'

  if (tipo === 'BAF') {
    const { data: anterior, error: anteriorError } = await adminClient
      .from('gestion_baf')
      .select(`
        estado_baf_id,
        prospector,
        cia_celular,
        sds,
        orden_trabajo,
        linea_fija,
        fecha_instalacion,
        ciclo_cuenta,
        motivo_estado
      `)
      .eq('operacion_id', operacionId)
      .maybeSingle()

    if (anteriorError) {
      return NextResponse.json({ error: anteriorError.message }, { status: 400 })
    }

    const { error: rpcError } = await supabase.rpc('super_guardar_gestion_baf', {
      p_operacion_id: operacionId,
      p_estado_baf_id: body.estado_baf_id ?? null,
      p_prospector: body.prospector ?? null,
      p_cia_celular: body.cia_celular ?? null,
      p_sds: body.sds ?? null,
      p_orden_trabajo: body.orden_trabajo ?? null,
      p_linea_fija: body.linea_fija ?? null,
      p_fecha_instalacion: body.fecha_instalacion ?? null,
      p_ciclo_cuenta: body.ciclo_cuenta ?? null,
      p_motivo_estado: body.motivo_estado ?? null,
    })

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 400 })
    }

    const { data: posterior, error: posteriorError } = await adminClient
      .from('gestion_baf')
      .select(`
        estado_baf_id,
        prospector,
        cia_celular,
        sds,
        orden_trabajo,
        linea_fija,
        fecha_instalacion,
        ciclo_cuenta,
        motivo_estado
      `)
      .eq('operacion_id', operacionId)
      .single()

    if (posteriorError || !posterior) {
      console.error(
        'Venta BAF guardada, pero no se pudo releer para notificar:',
        posteriorError
      )

      await liberarBloqueo()
      return NextResponse.json({
        ok: true,
        cambios: 0,
        notificacion: 'ERROR',
        aviso: 'La gestión se guardó, pero no se pudo generar la notificación.',
      })
    }

    const idsEstado = Array.from(
      new Set(
        [anterior?.estado_baf_id, posterior.estado_baf_id].filter(
          (id): id is number => id != null
        )
      )
    )

    const nombresEstado = new Map<number, string>()

    if (idsEstado.length > 0) {
      const { data: estados } = await adminClient
        .from('estados_baf')
        .select('id,nombre')
        .in('id', idsEstado)

      for (const estado of estados || []) {
        nombresEstado.set(Number(estado.id), estado.nombre)
      }
    }

    const nombreEstado = (id: number | null) =>
      id == null ? 'Sin estado' : nombresEstado.get(Number(id)) || `Estado #${id}`

    agregarCambio(
      cambios,
      'Estado BAF',
      anterior?.estado_baf_id,
      posterior.estado_baf_id,
      nombreEstado
    )
    agregarCambio(cambios, 'Prospector', anterior?.prospector, posterior.prospector)
    agregarCambio(cambios, 'CIA Celular', anterior?.cia_celular, posterior.cia_celular)
    agregarCambio(cambios, 'SDS', anterior?.sds, posterior.sds)
    agregarCambio(
      cambios,
      'Orden Trabajo',
      anterior?.orden_trabajo,
      posterior.orden_trabajo
    )
    agregarCambio(cambios, 'Línea Fija', anterior?.linea_fija, posterior.linea_fija)
    agregarCambio(
      cambios,
      'Fecha Instalación',
      anterior?.fecha_instalacion,
      posterior.fecha_instalacion
    )
    agregarCambio(cambios, 'Ciclo Cuenta', anterior?.ciclo_cuenta, posterior.ciclo_cuenta)
    agregarCambio(
      cambios,
      'Motivo Estado',
      anterior?.motivo_estado,
      posterior.motivo_estado
    )
  } else {
    const [portaBaseResult, anteriorResult] = await Promise.all([
      adminClient
        .from('operaciones_porta')
        .select('es_linea_nueva')
        .eq('operacion_id', operacionId)
        .maybeSingle(),
      adminClient
        .from('gestion_porta')
        .select(`
          estado_porta_id,
          estado_bboo_id,
          bboo_id,
          fecha_carga_stl,
          sim,
          plan_cargado,
          sds,
          spn,
          pin_lnva_nro,
          documentacion_dni,
          medio_despacho_chip_id,
          fecha_porta,
          numero_seguimiento,
          observaciones_gestion
        `)
        .eq('operacion_id', operacionId)
        .maybeSingle(),
    ])

    const portaBase = portaBaseResult.data
    const { data: anterior, error: anteriorError } = anteriorResult

    tipoVisible = portaBase?.es_linea_nueva ? 'Línea Nueva' : 'PORTA'

    if (anteriorError) {
      return NextResponse.json({ error: anteriorError.message }, { status: 400 })
    }

    const rolActor = String(actorProfilePermisos.rol)

    const estadoPortaEfectivo =
      rolActor === 'BBOO'
        ? anterior?.estado_porta_id ?? null
        : body.estado_porta_id ?? null

    const estadoBbooEfectivo =
      rolActor === 'VENDEDOR'
        ? anterior?.estado_bboo_id ?? null
        : body.estado_bboo_id ?? null

    // La identificación BBOO es automática: BBOO se registra a sí mismo.
    // Los demás roles conservan la asignación BBOO ya existente.
    const bbooIdEfectivo =
      rolActor === 'BBOO' ? user.id : anterior?.bboo_id ?? null

    // SPN ya no se edita desde la interfaz, pero aún existe en la base.
    // Se conserva sin cambios hasta decidir su eliminación definitiva.
    const spnEfectivo = anterior?.spn ?? null

    const { error: rpcError } = await supabase.rpc('super_guardar_gestion_porta', {
      p_operacion_id: operacionId,
      p_estado_porta_id: estadoPortaEfectivo,
      p_estado_bboo_id: estadoBbooEfectivo,
      p_bboo_id: bbooIdEfectivo,
      p_sim: body.sim ?? null,
      p_plan_cargado: body.plan_cargado ?? null,
      p_sds: body.sds ?? null,
      p_spn: spnEfectivo,
      p_pin_lnva_nro: body.pin_lnva_nro ?? null,
      p_documentacion_dni: body.documentacion_dni ?? null,
      p_medio_despacho_chip_id: body.medio_despacho_chip_id ?? null,
      p_numero_seguimiento: body.numero_seguimiento ?? null,
      p_observaciones_gestion: body.observaciones_gestion ?? null,
    })

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 400 })
    }

    const { data: posterior, error: posteriorError } = await adminClient
      .from('gestion_porta')
      .select(`
        estado_porta_id,
        estado_bboo_id,
        bboo_id,
        fecha_carga_stl,
        sim,
        plan_cargado,
        sds,
        spn,
        pin_lnva_nro,
        documentacion_dni,
        medio_despacho_chip_id,
        fecha_porta,
        numero_seguimiento,
        observaciones_gestion
      `)
      .eq('operacion_id', operacionId)
      .single()

    if (posteriorError || !posterior) {
      console.error(
        'Venta PORTA/Línea Nueva guardada, pero no se pudo releer para notificar:',
        posteriorError
      )

      await liberarBloqueo()
      return NextResponse.json({
        ok: true,
        cambios: 0,
        notificacion: 'ERROR',
        aviso: 'La gestión se guardó, pero no se pudo generar la notificación.',
      })
    }

    const idsEstadoVendedor = Array.from(
      new Set(
        [anterior?.estado_porta_id, posterior.estado_porta_id].filter(
          (id): id is number => id != null
        )
      )
    )
    const idsEstadoBboo = Array.from(
      new Set(
        [anterior?.estado_bboo_id, posterior.estado_bboo_id].filter(
          (id): id is number => id != null
        )
      )
    )
    const idsBboo = Array.from(
      new Set(
        [anterior?.bboo_id, posterior.bboo_id].filter(
          (id): id is string => Boolean(id)
        )
      )
    )
    const idsMedio = Array.from(
      new Set(
        [anterior?.medio_despacho_chip_id, posterior.medio_despacho_chip_id].filter(
          (id): id is number => id != null
        )
      )
    )

    const nombresEstadoVendedor = new Map<number, string>()
    const nombresEstadoBboo = new Map<number, string>()
    const nombresBboo = new Map<string, string>()
    const nombresMedio = new Map<number, string>()

    const [estadosVendedorResult, estadosBbooResult, perfilesResult, mediosResult] =
      await Promise.all([
        idsEstadoVendedor.length > 0
          ? adminClient.from('estados_porta').select('id,nombre').in('id', idsEstadoVendedor)
          : Promise.resolve({ data: [] as Array<{ id: number; nombre: string }> }),
        idsEstadoBboo.length > 0
          ? adminClient.from('estados_bboo').select('id,nombre').in('id', idsEstadoBboo)
          : Promise.resolve({ data: [] as Array<{ id: number; nombre: string }> }),
        idsBboo.length > 0
          ? adminClient.from('profiles').select('id,nombre,vendedor').in('id', idsBboo)
          : Promise.resolve({
              data: [] as Array<{ id: string; nombre: string | null; vendedor: string | null }>,
            }),
        idsMedio.length > 0
          ? adminClient.from('medios_despacho_chip').select('id,nombre').in('id', idsMedio)
          : Promise.resolve({ data: [] as Array<{ id: number; nombre: string }> }),
      ])

    for (const estado of estadosVendedorResult.data || []) {
      nombresEstadoVendedor.set(Number(estado.id), estado.nombre)
    }

    for (const estado of estadosBbooResult.data || []) {
      nombresEstadoBboo.set(Number(estado.id), estado.nombre)
    }

    for (const perfil of perfilesResult.data || []) {
      nombresBboo.set(
        perfil.id,
        perfil.vendedor?.trim() || perfil.nombre?.trim() || perfil.id
      )
    }

    for (const medio of mediosResult.data || []) {
      nombresMedio.set(Number(medio.id), medio.nombre)
    }

    const nombreEstadoVendedor = (id: number | null) =>
      id == null
        ? 'Sin estado'
        : nombresEstadoVendedor.get(Number(id)) || `Estado #${id}`

    const nombreEstadoBboo = (id: number | null) =>
      id == null
        ? 'Sin estado'
        : nombresEstadoBboo.get(Number(id)) || `Estado #${id}`

    const nombreBboo = (id: string | null) =>
      id == null ? 'Sin asignar' : nombresBboo.get(id) || id

    const nombreMedio = (id: number | null) =>
      id == null ? 'Sin asignar' : nombresMedio.get(Number(id)) || `Medio #${id}`

    agregarCambio(
      cambios,
      'Estado Vendedor',
      anterior?.estado_porta_id,
      posterior.estado_porta_id,
      nombreEstadoVendedor
    )
    agregarCambio(
      cambios,
      'Estado BBOO',
      anterior?.estado_bboo_id,
      posterior.estado_bboo_id,
      nombreEstadoBboo
    )
    agregarCambio(cambios, 'BBOO', anterior?.bboo_id, posterior.bboo_id, nombreBboo)
    agregarCambio(
      cambios,
      'Fecha Carga STL',
      anterior?.fecha_carga_stl,
      posterior.fecha_carga_stl,
      fechaValor
    )
    agregarCambio(cambios, 'SIM', anterior?.sim, posterior.sim)
    agregarCambio(
      cambios,
      'Plan cargado',
      anterior?.plan_cargado,
      posterior.plan_cargado
    )
    agregarCambio(cambios, 'SDS', anterior?.sds, posterior.sds)
    agregarCambio(
      cambios,
      'PIN / LNVA NRO',
      anterior?.pin_lnva_nro,
      posterior.pin_lnva_nro
    )
    agregarCambio(
      cambios,
      'Documentación DNI',
      anterior?.documentacion_dni,
      posterior.documentacion_dni,
      booleano
    )
    agregarCambio(
      cambios,
      'Medio de despacho CHIP',
      anterior?.medio_despacho_chip_id,
      posterior.medio_despacho_chip_id,
      nombreMedio
    )
    agregarCambio(
      cambios,
      'Fecha PORTA',
      anterior?.fecha_porta,
      posterior.fecha_porta,
      fechaValor
    )
    agregarCambio(
      cambios,
      'Número de seguimiento',
      anterior?.numero_seguimiento,
      posterior.numero_seguimiento
    )
    agregarCambio(
      cambios,
      'Observaciones gestión',
      anterior?.observaciones_gestion,
      posterior.observaciones_gestion
    )
  }

  const [{ data: operacionAsignada }, { data: gestionAsignada }] = await Promise.all([
    adminClient
      .from('operaciones')
      .select('usuario_id,vendedor')
      .eq('id_operacion', operacionId)
      .maybeSingle(),
    adminClient
      .from(tablaGestion)
      .select('responsable_id')
      .eq('operacion_id', operacionId)
      .maybeSingle(),
  ])

  const responsablePosteriorId = gestionAsignada?.responsable_id ?? null
  const vendedorPosteriorId = operacionAsignada?.usuario_id ?? null
  const vendedorPosteriorNombre = operacionAsignada?.vendedor ?? null

  const idsPerfilesAsignacion = Array.from(
    new Set(
      [responsableAnteriorId, responsablePosteriorId]
        .filter((id): id is string => Boolean(id))
    )
  )
  const nombresResponsables = new Map<string, string>()

  if (idsPerfilesAsignacion.length > 0) {
    const { data: perfilesAsignacion } = await adminClient
      .from('profiles')
      .select('id,nombre,vendedor')
      .in('id', idsPerfilesAsignacion)

    for (const perfil of perfilesAsignacion || []) {
      nombresResponsables.set(
        perfil.id,
        perfil.vendedor?.trim() || perfil.nombre?.trim() || perfil.id
      )
    }
  }

  const nombreResponsable = (id: string | null) =>
    id ? nombresResponsables.get(id) || id : 'Sin asignar'

  agregarCambio(
    cambios,
    'Responsable',
    responsableAnteriorId,
    responsablePosteriorId,
    nombreResponsable
  )

  if (vendedorAnteriorId !== vendedorPosteriorId || vendedorAnteriorNombre !== vendedorPosteriorNombre) {
    agregarCambio(
      cambios,
      'Vendedor',
      vendedorAnteriorNombre || vendedorAnteriorId,
      vendedorPosteriorNombre || vendedorPosteriorId
    )
  }

  if (cambios.length === 0) {
    await liberarBloqueo()
    return NextResponse.json({
      ok: true,
      cambios: 0,
      notificacion: 'NO_CAMBIOS',
    })
  }

  // Releemos la operación DESPUÉS del guardado. De esta manera la
  // notificación siempre se dirige al Vendedor actual de la Venta.
  const [operacionPosteriorResult, actorProfileResult] = await Promise.all([
    adminClient
      .from('operaciones')
      .select('id_operacion,usuario_id,vendedor')
      .eq('id_operacion', operacionId)
      .single(),
    adminClient
      .from('profiles')
      .select('nombre,vendedor')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  const {
    data: operacionPosterior,
    error: operacionPosteriorError,
  } = operacionPosteriorResult
  const actorProfile = actorProfileResult.data

  if (operacionPosteriorError || !operacionPosterior) {
    console.error(
      'Venta guardada, pero no se pudo releer el Vendedor:',
      operacionPosteriorError
    )

    await liberarBloqueo()
    return NextResponse.json({
      ok: true,
      cambios: cambios.length,
      notificacion: 'ERROR',
      aviso: 'La gestión se guardó, pero no se pudo identificar al Vendedor.',
    })
  }

  const vendedorId = operacionPosterior.usuario_id

  const responsableNombre =
    actorProfile?.vendedor?.trim() ||
    actorProfile?.nombre?.trim() ||
    user.email ||
    'Usuario'

  const asunto = `Notificación de Gestión ${tipoVisible}`
  const referencia = `Operación: ${operacionId}`
  const fechaGestion = new Date()

  const mensaje = [
    asunto,
    '',
    referencia,
    `Vendedor: ${operacionPosterior.vendedor || '—'}`,
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

  if (!vendedorId) {
    errorDestinatario = 'La Venta no tiene Vendedor asignado.'
  } else {
    try {
      const { data: vendedorAuth, error: vendedorAuthError } =
        await adminClient.auth.admin.getUserById(vendedorId)

      if (vendedorAuthError) throw vendedorAuthError

      destinatario = vendedorAuth.user?.email?.trim().toLowerCase() || null

      if (!destinatario) {
        throw new Error('El Vendedor no tiene email configurado en Supabase Auth.')
      }
    } catch (error) {
      errorDestinatario = mensajeError(error)
    }
  }

  const estadoInicial = errorDestinatario ? 'ERROR' : 'PENDIENTE'

  const { data: notificacion, error: notificacionError } = await adminClient
    .from('notificaciones')
    .insert({
      operacion_id: operacionId,
      usuario_id: vendedorId,
      canal: 'EMAIL',
      asunto,
      mensaje,
      destinatario,
      estado: estadoInicial,
      error_envio: errorDestinatario,
      tipo_gestion: 'VENTA',
      registro_id: operacionId,
      referencia,
      cambios,
      responsable_id: user.id,
      responsable_nombre: responsableNombre,
      intentos: errorDestinatario ? 1 : 0,
    })
    .select('id')
    .single()

  if (notificacionError || !notificacion) {
    console.error(
      'Venta guardada, pero no se pudo registrar la notificación:',
      notificacionError
    )

    await liberarBloqueo()
    return NextResponse.json({
      ok: true,
      cambios: cambios.length,
      notificacion: 'ERROR',
      aviso: 'La gestión se guardó, pero no se pudo registrar la notificación.',
    })
  }

  if (errorDestinatario || !destinatario) {
    await liberarBloqueo()
    return NextResponse.json({
      ok: true,
      cambios: cambios.length,
      notificacion: 'ERROR',
      aviso: errorDestinatario
        ? `La gestión se guardó, pero no se pudo enviar el email: ${errorDestinatario}`
        : 'La gestión se guardó, pero el Vendedor no tiene un email utilizable.',
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

    await liberarBloqueo()
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

    await liberarBloqueo()
    return NextResponse.json({
      ok: true,
      cambios: cambios.length,
      notificacion: 'ERROR',
      aviso: 'La gestión se guardó, pero no se pudo enviar el email.',
    })
  }
}