import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

import { createClient } from '../../../../utils/supabase/server'
import { createAdminClient } from '../../../../utils/supabase/admin'

function fechaExcel(valor: any) {
  if (!valor) return null
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d
}

function nombreCliente(cliente: any) {
  if (!cliente) return ''
  const apellido = String(cliente.apellido ?? '').trim()
  const nombre = String(cliente.nombre ?? '').trim()
  return [apellido, nombre].filter(Boolean).join(', ')
}

function etiquetaTipo(tipo: string) {
  if (tipo === 'BAF') return 'Internet / BAF'
  if (tipo === 'PORTA') return 'Portabilidad'
  if (tipo === 'LINEA_NUEVA') return 'Línea Nueva'
  if (tipo === 'FWA') return 'FWA'
  if (tipo === 'TV') return 'TV'
  return tipo || ''
}

function unico(valores: any[]) {
  const limpios = valores
    .flatMap((v) => (Array.isArray(v) ? v : [v]))
    .map((v) => String(v ?? '').trim())
    .filter((v) => v && v !== '-')

  return Array.from(new Set(limpios)).join(' | ')
}

function siNo(valor: any) {
  return valor ? 'Sí' : 'No'
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('activo')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.activo) {
      return NextResponse.json({ error: 'Usuario inactivo.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const desde = String(body.desde ?? '')
    const hasta = String(body.hasta ?? '')

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(desde) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(hasta) ||
      desde > hasta
    ) {
      return NextResponse.json(
        { error: 'Rango de fechas inválido.' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // La exportación de Mis Ventas siempre queda limitada al usuario
    // autenticado, independientemente de su rol.
    const desdeIso = `${desde}T00:00:00-03:00`
    const hastaSiguiente = new Date(`${hasta}T12:00:00-03:00`)
    hastaSiguiente.setUTCDate(hastaSiguiente.getUTCDate() + 1)
    const hastaIso = `${hastaSiguiente.toISOString().slice(0, 10)}T00:00:00-03:00`

    const { data: operaciones, error: errorOperaciones } = await admin
      .from('operaciones')
      .select(`
        id_operacion,
        tipo,
        fecha_hora,
        vendedor,
        origen_dato,
        grupo_operacion,
        cliente_id
      `)
      .eq('usuario_id', user.id)
      .in('tipo', ['BAF', 'PORTA'])
      .gte('fecha_hora', desdeIso)
      .lt('fecha_hora', hastaIso)
      .order('fecha_hora', { ascending: false })

    if (errorOperaciones) throw errorOperaciones

    const ops = operaciones ?? []
    const idsOperaciones = ops.map((o: any) => o.id_operacion)
    const clienteIds = Array.from(
      new Set(ops.map((o: any) => o.cliente_id).filter(Boolean))
    )

    const [
      rClientes,
      rProductos,
      rBafLegacy,
      rPortaLegacy,
      rGestionBafLegacy,
      rGestionPortaLegacy,
      rContextos,
      rPerfiles,
      rMedios,
    ] = await Promise.all([
      clienteIds.length
        ? admin
            .from('clientes')
            .select('id,dni,tipo_documento,nombre,apellido,telefono')
            .in('id', clienteIds)
        : Promise.resolve({ data: [], error: null }),

      idsOperaciones.length
        ? admin
            .from('operacion_productos')
            .select(
              'id,operacion_id,tipo_producto,plan_snapshot,producto_snapshot,orden,activo,responsable_id'
            )
            .in('operacion_id', idsOperaciones)
            .eq('activo', true)
            .order('orden', { ascending: true })
        : Promise.resolve({ data: [], error: null }),

      idsOperaciones.length
        ? admin
            .from('operaciones_baf')
            .select('operacion_id,plan,modalidad_plan')
            .in('operacion_id', idsOperaciones)
        : Promise.resolve({ data: [], error: null }),

      idsOperaciones.length
        ? admin
            .from('operaciones_porta')
            .select(
              'operacion_id,nim,es_linea_nueva,gigas_acordados,compania_actual,numero_linea,tipo_sim'
            )
            .in('operacion_id', idsOperaciones)
        : Promise.resolve({ data: [], error: null }),

      idsOperaciones.length
        ? admin
            .from('gestion_baf')
            .select(
              'operacion_id,responsable_id,estado_baf_id,sds,fecha_instalacion,orden_trabajo'
            )
            .in('operacion_id', idsOperaciones)
        : Promise.resolve({ data: [], error: null }),

      idsOperaciones.length
        ? admin
            .from('gestion_porta')
            .select(
              'operacion_id,responsable_id,estado_porta_id,estado_bboo_id,bboo_id,medio_despacho_chip_id,fecha_carga_stl,fecha_porta,pin_lnva_nro,sim,plan_cargado,sds,numero_seguimiento'
            )
            .in('operacion_id', idsOperaciones)
        : Promise.resolve({ data: [], error: null }),

      idsOperaciones.length
        ? admin
            .from('operacion_contexto_comercial')
            .select(
              'operacion_id,es_conexion_full,modalidad_conexion_full,tipo_referencia_habilitante,referencia_habilitante,cantidad_servicios,descuento_convergencia'
            )
            .in('operacion_id', idsOperaciones)
        : Promise.resolve({ data: [], error: null }),

      admin.from('profiles').select('id,nombre,vendedor'),

      admin.from('medios_despacho_chip').select('id,nombre'),
    ])

    for (const resultado of [
      rClientes,
      rProductos,
      rBafLegacy,
      rPortaLegacy,
      rGestionBafLegacy,
      rGestionPortaLegacy,
      rContextos,
      rPerfiles,
      rMedios,
    ]) {
      if ((resultado as any).error) throw (resultado as any).error
    }

    const productos = (rProductos.data ?? []) as any[]
    const idsProductos = productos.map((p: any) => p.id)

    const [
      rDetalleBafNuevo,
      rDetalleMovilNuevo,
      rGestionBafNueva,
      rGestionMovilNueva,
    ] = await Promise.all([
      idsProductos.length
        ? admin
            .from('operacion_producto_baf')
            .select('*')
            .in('producto_operacion_id', idsProductos)
        : Promise.resolve({ data: [], error: null }),

      idsProductos.length
        ? admin
            .from('operacion_producto_movil')
            .select('*')
            .in('producto_operacion_id', idsProductos)
        : Promise.resolve({ data: [], error: null }),

      idsProductos.length
        ? admin
            .from('gestion_producto_baf')
            .select('*')
            .in('producto_operacion_id', idsProductos)
        : Promise.resolve({ data: [], error: null }),

      idsProductos.length
        ? admin
            .from('gestion_producto_movil')
            .select('*')
            .in('producto_operacion_id', idsProductos)
        : Promise.resolve({ data: [], error: null }),
    ])

    for (const resultado of [
      rDetalleBafNuevo,
      rDetalleMovilNuevo,
      rGestionBafNueva,
      rGestionMovilNueva,
    ]) {
      if ((resultado as any).error) throw (resultado as any).error
    }

    const todasGestionesBaf = [
      ...((rGestionBafLegacy.data ?? []) as any[]),
      ...((rGestionBafNueva.data ?? []) as any[]),
    ]
    const todasGestionesMovil = [
      ...((rGestionPortaLegacy.data ?? []) as any[]),
      ...((rGestionMovilNueva.data ?? []) as any[]),
    ]

    const idsEstadoBaf = Array.from(
      new Set(todasGestionesBaf.map((g: any) => g.estado_baf_id).filter(Boolean))
    )
    const idsEstadoPorta = Array.from(
      new Set(
        todasGestionesMovil.map((g: any) => g.estado_porta_id).filter(Boolean)
      )
    )
    const idsEstadoBboo = Array.from(
      new Set(
        todasGestionesMovil.map((g: any) => g.estado_bboo_id).filter(Boolean)
      )
    )

    const [rEstadosBaf, rEstadosPorta, rEstadosBboo] = await Promise.all([
      idsEstadoBaf.length
        ? admin.from('estados_baf').select('id,nombre').in('id', idsEstadoBaf)
        : Promise.resolve({ data: [], error: null }),

      idsEstadoPorta.length
        ? admin
            .from('estados_porta')
            .select('id,nombre')
            .in('id', idsEstadoPorta)
        : Promise.resolve({ data: [], error: null }),

      idsEstadoBboo.length
        ? admin
            .from('estados_bboo')
            .select('id,nombre')
            .in('id', idsEstadoBboo)
        : Promise.resolve({ data: [], error: null }),
    ])

    for (const resultado of [rEstadosBaf, rEstadosPorta, rEstadosBboo]) {
      if ((resultado as any).error) throw (resultado as any).error
    }

    const mapa = (arr: any[], key = 'id') =>
      new Map(arr.map((x: any) => [x[key], x]))

    const clientes = mapa((rClientes.data ?? []) as any[])
    const bafLegacy = mapa((rBafLegacy.data ?? []) as any[], 'operacion_id')
    const portaLegacy = mapa((rPortaLegacy.data ?? []) as any[], 'operacion_id')
    const gestionBafLegacy = mapa(
      (rGestionBafLegacy.data ?? []) as any[],
      'operacion_id'
    )
    const gestionPortaLegacy = mapa(
      (rGestionPortaLegacy.data ?? []) as any[],
      'operacion_id'
    )
    const contextos = mapa((rContextos.data ?? []) as any[], 'operacion_id')
    const perfiles = mapa((rPerfiles.data ?? []) as any[])
    const medios = mapa((rMedios.data ?? []) as any[])
    const estadosBaf = mapa((rEstadosBaf.data ?? []) as any[])
    const estadosPorta = mapa((rEstadosPorta.data ?? []) as any[])
    const estadosBboo = mapa((rEstadosBboo.data ?? []) as any[])

    const detalleBafNuevo = mapa(
      (rDetalleBafNuevo.data ?? []) as any[],
      'producto_operacion_id'
    )
    const detalleMovilNuevo = mapa(
      (rDetalleMovilNuevo.data ?? []) as any[],
      'producto_operacion_id'
    )
    const gestionBafNueva = mapa(
      (rGestionBafNueva.data ?? []) as any[],
      'producto_operacion_id'
    )
    const gestionMovilNueva = mapa(
      (rGestionMovilNueva.data ?? []) as any[],
      'producto_operacion_id'
    )

    function nombrePerfil(id: any) {
      if (!id) return ''
      const p: any = perfiles.get(id)
      return p?.vendedor || p?.nombre || ''
    }

    function nombreEstadoBaf(id: any) {
      return (estadosBaf.get(id) as any)?.nombre || ''
    }

    function nombreEstadoPorta(id: any) {
      return (estadosPorta.get(id) as any)?.nombre || ''
    }

    function nombreEstadoBboo(id: any) {
      return (estadosBboo.get(id) as any)?.nombre || ''
    }

    function nombreMedio(id: any) {
      return (medios.get(id) as any)?.nombre || ''
    }

    const productosPorOperacion = new Map<string, any[]>()

    for (const producto of productos) {
      const actuales = productosPorOperacion.get(producto.operacion_id) ?? []
      actuales.push(producto)
      productosPorOperacion.set(producto.operacion_id, actuales)
    }

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Plataforma Lucom'

    const worksheet = workbook.addWorksheet('Mis Ventas', {
      views: [{ state: 'frozen', ySplit: 1 }],
    })

    worksheet.columns = [
      { header: 'Fecha Ingreso', key: 'fecha_ingreso', width: 20 },
      { header: 'Operación', key: 'operacion', width: 29 },
      { header: 'Tipo', key: 'tipo', width: 24 },
      { header: 'Vendedor', key: 'vendedor', width: 24 },
      { header: 'Responsable', key: 'responsable', width: 24 },
      { header: 'Cliente', key: 'cliente', width: 30 },
      { header: 'Tipo Documento', key: 'tipo_documento', width: 16 },
      { header: 'DNI / CUIT', key: 'dni', width: 16 },
      { header: 'Teléfono', key: 'telefono', width: 16 },
      { header: 'Número Línea / NIM', key: 'numero_linea', width: 22 },
      { header: 'Compañía Actual', key: 'compania_actual', width: 20 },
      { header: 'Tipo SIM', key: 'tipo_sim', width: 14 },
      { header: 'Plan Acordado', key: 'plan_acordado', width: 24 },
      { header: 'Plan Cargado', key: 'plan_cargado', width: 24 },
      { header: 'Estado Vendedor', key: 'estado_vendedor', width: 24 },
      { header: 'Estado BBOO', key: 'estado_bboo', width: 24 },
      { header: 'Estado BAF', key: 'estado_baf', width: 24 },
      { header: 'BBOO', key: 'bboo', width: 24 },
      { header: 'Fecha Carga STL', key: 'fecha_carga_stl', width: 18 },
      { header: 'Fecha Porta', key: 'fecha_porta', width: 18 },
      {
        header: 'Medio Despacho Chip',
        key: 'medio_despacho_chip',
        width: 24,
      },
      { header: 'Número Seguimiento', key: 'numero_seguimiento', width: 22 },
      { header: 'PIN / LNVA', key: 'pin', width: 18 },
      { header: 'SIM Operativo', key: 'sim_operativo', width: 24 },
      { header: 'SDS', key: 'sds', width: 18 },
      { header: 'Fecha Instalación', key: 'fecha_instalacion', width: 18 },
      { header: 'Orden Trabajo', key: 'orden_trabajo', width: 18 },
      { header: 'Conexión Full', key: 'conexion_full', width: 15 },
      { header: 'Modalidad Full', key: 'modalidad_full', width: 20 },
      { header: 'Tipo Referencia', key: 'tipo_referencia', width: 20 },
      { header: 'Referencia', key: 'referencia', width: 18 },
      { header: 'Cantidad Servicios', key: 'cantidad_servicios', width: 18 },
      {
        header: 'Descuento Convergencia',
        key: 'descuento_convergencia',
        width: 24,
      },
      { header: 'Origen', key: 'origen', width: 20 },
      { header: 'Grupo Operación', key: 'grupo_operacion', width: 20 },
    ]

    for (const operacion of ops as any[]) {
      const cliente: any = clientes.get(operacion.cliente_id)
      const nuevos = productosPorOperacion.get(operacion.id_operacion) ?? []
      const contexto: any = contextos.get(operacion.id_operacion)

      let tipo = ''
      let responsable = ''
      let numeroLinea = ''
      let companiaActual = ''
      let tipoSim = ''
      let planAcordado = ''
      let planCargado = ''
      let estadoVendedor = ''
      let estadoBboo = ''
      let estadoBaf = ''
      let bboo = ''
      let fechaCargaStl = ''
      let fechaPorta = ''
      let medioDespachoChip = ''
      let numeroSeguimiento = ''
      let pin = ''
      let simOperativo = ''
      let sds = ''
      let fechaInstalacion = ''
      let ordenTrabajo = ''

      if (nuevos.length > 0) {
        tipo = unico(nuevos.map((p: any) => etiquetaTipo(p.tipo_producto)))
        responsable = unico(
          nuevos.map((p: any) => nombrePerfil(p.responsable_id))
        )
        planAcordado = unico(nuevos.map((p: any) => p.plan_snapshot))

        numeroLinea = unico(
          nuevos.map((p: any) => {
            const d: any = detalleMovilNuevo.get(p.id)
            return d?.numero_linea || d?.nim
          })
        )

        companiaActual = unico(
          nuevos.map((p: any) => {
            const d: any = detalleMovilNuevo.get(p.id)
            return d?.compania_actual
          })
        )

        tipoSim = unico(
          nuevos.map((p: any) => {
            const d: any = detalleMovilNuevo.get(p.id)
            return d?.tipo_sim
          })
        )

        planCargado = unico(
          nuevos.map((p: any) => {
            const g: any = gestionMovilNueva.get(p.id)
            return g?.plan_cargado
          })
        )

        estadoVendedor = unico(
          nuevos.map((p: any) => {
            const g: any = gestionMovilNueva.get(p.id)
            return nombreEstadoPorta(g?.estado_porta_id)
          })
        )

        estadoBboo = unico(
          nuevos.map((p: any) => {
            const g: any = gestionMovilNueva.get(p.id)
            return nombreEstadoBboo(g?.estado_bboo_id)
          })
        )

        estadoBaf = unico(
          nuevos.map((p: any) => {
            const g: any = gestionBafNueva.get(p.id)
            return nombreEstadoBaf(g?.estado_baf_id)
          })
        )

        bboo = unico(
          nuevos.map((p: any) => {
            const g: any = gestionMovilNueva.get(p.id)
            return nombrePerfil(g?.bboo_id)
          })
        )

        fechaCargaStl = unico(
          nuevos.map((p: any) => {
            const g: any = gestionMovilNueva.get(p.id)
            return g?.fecha_carga_stl
          })
        )

        fechaPorta = unico(
          nuevos.map((p: any) => {
            const g: any = gestionMovilNueva.get(p.id)
            return g?.fecha_porta
          })
        )

        medioDespachoChip = unico(
          nuevos.map((p: any) => {
            const g: any = gestionMovilNueva.get(p.id)
            return nombreMedio(g?.medio_despacho_chip_id)
          })
        )

        numeroSeguimiento = unico(
          nuevos.map((p: any) => {
            const g: any = gestionMovilNueva.get(p.id)
            return g?.numero_seguimiento
          })
        )

        pin = unico(
          nuevos.map((p: any) => {
            const g: any = gestionMovilNueva.get(p.id)
            return g?.pin_lnva_nro
          })
        )

        simOperativo = unico(
          nuevos.map((p: any) => {
            const g: any = gestionMovilNueva.get(p.id)
            return g?.sim
          })
        )

        sds = unico(
          nuevos.map((p: any) => {
            const gb: any = gestionBafNueva.get(p.id)
            const gm: any = gestionMovilNueva.get(p.id)
            return gb?.sds || gm?.sds
          })
        )

        fechaInstalacion = unico(
          nuevos.map((p: any) => {
            const g: any = gestionBafNueva.get(p.id)
            return g?.fecha_instalacion
          })
        )

        ordenTrabajo = unico(
          nuevos.map((p: any) => {
            const g: any = gestionBafNueva.get(p.id)
            return g?.orden_trabajo
          })
        )
      } else {
        const baf: any = bafLegacy.get(operacion.id_operacion)
        const porta: any = portaLegacy.get(operacion.id_operacion)
        const gb: any = gestionBafLegacy.get(operacion.id_operacion)
        const gp: any = gestionPortaLegacy.get(operacion.id_operacion)

        tipo =
          operacion.tipo === 'PORTA' && porta?.es_linea_nueva
            ? 'Línea Nueva'
            : etiquetaTipo(operacion.tipo)

        responsable = nombrePerfil(
          operacion.tipo === 'BAF' ? gb?.responsable_id : gp?.responsable_id
        )

        numeroLinea =
          operacion.tipo === 'PORTA'
            ? porta?.numero_linea || porta?.nim || ''
            : ''

        companiaActual =
          operacion.tipo === 'PORTA' ? porta?.compania_actual || '' : ''

        tipoSim = operacion.tipo === 'PORTA' ? porta?.tipo_sim || '' : ''

        planAcordado =
          operacion.tipo === 'BAF'
            ? baf?.plan || ''
            : porta?.gigas_acordados || ''

        planCargado =
          operacion.tipo === 'PORTA' ? gp?.plan_cargado || '' : ''

        estadoVendedor =
          operacion.tipo === 'PORTA'
            ? nombreEstadoPorta(gp?.estado_porta_id)
            : ''

        estadoBboo =
          operacion.tipo === 'PORTA'
            ? nombreEstadoBboo(gp?.estado_bboo_id)
            : ''

        estadoBaf =
          operacion.tipo === 'BAF'
            ? nombreEstadoBaf(gb?.estado_baf_id)
            : ''

        bboo =
          operacion.tipo === 'PORTA' ? nombrePerfil(gp?.bboo_id) : ''

        fechaCargaStl =
          operacion.tipo === 'PORTA' ? gp?.fecha_carga_stl || '' : ''

        fechaPorta =
          operacion.tipo === 'PORTA' && !porta?.es_linea_nueva
            ? gp?.fecha_porta || ''
            : ''

        medioDespachoChip =
          operacion.tipo === 'PORTA'
            ? nombreMedio(gp?.medio_despacho_chip_id)
            : ''

        numeroSeguimiento =
          operacion.tipo === 'PORTA' ? gp?.numero_seguimiento || '' : ''

        pin = operacion.tipo === 'PORTA' ? gp?.pin_lnva_nro || '' : ''
        simOperativo = operacion.tipo === 'PORTA' ? gp?.sim || '' : ''

        sds =
          operacion.tipo === 'BAF' ? gb?.sds || '' : gp?.sds || ''

        fechaInstalacion =
          operacion.tipo === 'BAF' ? gb?.fecha_instalacion || '' : ''

        ordenTrabajo =
          operacion.tipo === 'BAF' ? gb?.orden_trabajo || '' : ''
      }

      worksheet.addRow({
        fecha_ingreso: fechaExcel(operacion.fecha_hora),
        operacion: operacion.id_operacion,
        tipo,
        vendedor: operacion.vendedor || '',
        responsable,
        cliente: nombreCliente(cliente),
        tipo_documento: cliente?.tipo_documento || '',
        dni: cliente?.dni || '',
        telefono: cliente?.telefono || '',
        numero_linea: numeroLinea,
        compania_actual: companiaActual,
        tipo_sim: tipoSim,
        plan_acordado: planAcordado,
        plan_cargado: planCargado,
        estado_vendedor: estadoVendedor,
        estado_bboo: estadoBboo,
        estado_baf: estadoBaf,
        bboo,
        fecha_carga_stl: fechaCargaStl,
        fecha_porta: fechaPorta,
        medio_despacho_chip: medioDespachoChip,
        numero_seguimiento: numeroSeguimiento,
        pin,
        sim_operativo: simOperativo,
        sds,
        fecha_instalacion: fechaInstalacion,
        orden_trabajo: ordenTrabajo,
        conexion_full: siNo(contexto?.es_conexion_full),
        modalidad_full: contexto?.modalidad_conexion_full || '',
        tipo_referencia: contexto?.tipo_referencia_habilitante || '',
        referencia: contexto?.referencia_habilitante || '',
        cantidad_servicios: contexto?.cantidad_servicios ?? '',
        descuento_convergencia: contexto?.descuento_convergencia ?? '',
        origen: operacion.origen_dato || '',
        grupo_operacion: operacion.grupo_operacion || '',
      })
    }

    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).height = 22
    worksheet.getColumn('fecha_ingreso').numFmt = 'dd/mm/yyyy hh:mm'

    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: {
        row: Math.max(1, worksheet.rowCount),
        column: worksheet.columnCount,
      },
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const nombre = `mis_ventas_${desde}_${hasta}.xlsx`

    return new Response(buffer as any, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nombre}"`,
      },
    })
  } catch (e: any) {
    console.error('exportar mis ventas', e)

    return NextResponse.json(
      { error: e?.message || 'No se pudo generar la exportación.' },
      { status: 500 }
    )
  }
}
