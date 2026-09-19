import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { createAdminClient } from '../../../../utils/supabase/admin'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 })

  const operacionId = String(request.nextUrl.searchParams.get('operacion') ?? '').trim()
  if (!operacionId) return NextResponse.json({ error: 'Falta la operación.' }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, activo, puede_gestionar_ventas')
    .eq('id', user.id)
    .single()

  if (!profile?.activo) {
    return NextResponse.json({ error: 'Usuario no habilitado.' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: operacion, error } = await admin
    .from('operaciones')
    .select(`id_operacion, usuario_id, cliente_id, domicilio_id,
      cliente:clientes (nombre, apellido, dni, telefono, email),
      domicilio:domicilios (calle_nro, entre_calles, localidad, barrio, piso, dpto, datos_extras)`)
    .eq('id_operacion', operacionId)

    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!operacion) {
    return NextResponse.json({ error: 'La venta no existe.' }, { status: 404 })
  }

  const esPropietario = operacion.usuario_id === user.id

  const esVendedorGestor =
    profile.rol === 'VENDEDOR' &&
    profile.puede_gestionar_ventas === true

  if (!esPropietario && !esVendedorGestor) {
    return NextResponse.json(
      { error: 'No tiene permisos para sincronizar esta venta.' },
      { status: 403 }
    )
  }




  const { data: productos, error: errorProductos } = await admin
    .from('operacion_productos')
    .select(`id, tipo_producto, plan_snapshot, producto_id, orden,
      producto:productos (negocio),
      baf:operacion_producto_baf (tv, cantidad_decos),
      movil:operacion_producto_movil (nim, compania_actual, modalidad_actual, es_fwa, forma_pago_modem, cuotas_modem, precio_modem_snapshot)`)
    .eq('operacion_id', operacionId)
    .eq('activo', true)
    .order('orden', { ascending: true })

  if (errorProductos) return NextResponse.json({ error: errorProductos.message }, { status: 500 })

  const { data: existentes } = await admin
    .from('cliente_servicios')
    .select('tipo_servicio, modalidad, numero_servicio')
    .eq('cliente_id', operacion.cliente_id)
    .eq('domicilio_id', operacion.domicilio_id)
    .eq('origen', 'DECLARADO_CLIENTE')

  const lista: any[] = productos ?? []

  const uno = (valor: any) =>
    Array.isArray(valor) ? (valor[0] ?? null) : (valor ?? null)
  const productoNegocio = lista
    .map((p: any) => uno(p.producto)?.negocio)
    .find((v: any) => String(v ?? '').trim() !== '')

  const negocio = productoNegocio === 'PYME' ? 'PYME' : 'MASIVO'
  const cliente: any = operacion.cliente ?? {}
  const domicilio: any = operacion.domicilio ?? {}
  const moviles = lista.filter((p: any) => p.tipo_producto === 'PORTA' || p.tipo_producto === 'LINEA_NUEVA')
  const baf = lista.filter((p: any) => p.tipo_producto === 'BAF')
  const primeraCompania = moviles
    .map((p: any) => uno(p.movil)?.compania_actual)
    .find((v: any) => String(v ?? '').trim() !== '') ?? ''
  const serviciosExistentes: any[] = existentes ?? []
  const lineasClaroExistentes = serviciosExistentes.filter((s: any) => s.tipo_servicio === 'LINEA_MOVIL')

  return NextResponse.json({
    ok: true,
    operacionId,
    negocio,
    cliente: {
      nombre: cliente.nombre ?? '',
      apellido: cliente.apellido ?? '',
      dni: cliente.dni ?? '',
      telefono: cliente.telefono ?? '',
      email: cliente.email ?? '',
      companiaActual: primeraCompania,
      domicilio: domicilio.calle_nro ?? '',
      entreCalles: domicilio.entre_calles ?? '',
      localidad: domicilio.localidad ?? '',
      observacionesDomicilio: [
        domicilio.barrio ? `Barrio: ${domicilio.barrio}` : '',
        domicilio.piso ? `Piso: ${domicilio.piso}` : '',
        domicilio.dpto ? `Dpto: ${domicilio.dpto}` : '',
        domicilio.datos_extras ?? '',
      ].filter(Boolean).join(' · '),
    },
    lineas: moviles.map((p: any, index: number) => {
      const detalle = uno(p.movil) ?? {}
      const compania = String(detalle.compania_actual ?? '').trim().toUpperCase()
      const tipo = p.tipo_producto === 'LINEA_NUEVA'
        ? 'LINEA NUEVA'
        : ['PERSONAL', 'MOVISTAR', 'TUENTI'].includes(compania) ? compania : 'PERSONAL'
      return {
        id: index + 1,
        tipo,
        plan: p.plan_snapshot ?? '',
        cantidad: 1,
        esFwa: detalle.es_fwa === true,
        formaPagoModem: detalle.es_fwa === true ? (detalle.forma_pago_modem ?? '') : '',
        cuotasModem: detalle.es_fwa === true ? Number(detalle.cuotas_modem ?? 1) : 1,
        precioModem: detalle.es_fwa === true ? Number(detalle.precio_modem_snapshot ?? 0) : 0,
        portabilidades: p.tipo_producto === 'PORTA'
          ? [{ nim: detalle.nim ?? '', origen: String(detalle.modalidad_actual ?? '').toUpperCase() === 'POS' ? 'POS' : 'PRE' }]
          : [],
      }
    }),
    internet: baf.map((p: any, index: number) => ({ id: index + 1, plan: p.plan_snapshot ?? '' })),
    tvActivo: baf.some((p: any) => String(uno(p.baf)?.tv ?? '').toUpperCase() === 'SI'),
    cantidadDecosAdicionales: Math.max(0, ...baf.map((p: any) => Number(uno(p.baf)?.cantidad_decos ?? 0))),
    clienteTieneBAF: serviciosExistentes.some((s: any) => s.tipo_servicio === 'BAF'),
    clienteTieneLineasClaro: lineasClaroExistentes.length > 0,
    cantidadLineasActuales: Math.max(1, lineasClaroExistentes.length),
  })
}
