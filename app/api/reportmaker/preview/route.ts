import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { createAdminClient } from '../../../../utils/supabase/admin'
type Negocio = 'INTERNET' | 'PORTABILIDAD' | 'LINEA_NUEVA'
const NEGOCIOS: Negocio[] = ['INTERNET', 'PORTABILIDAD', 'LINEA_NUEVA']
const TAMANO_LOTE = 100
const LIMITE_VISTA_PREVIA = 100
const MAX_OPERACIONES_EXAMINADAS = 10000
function extraerSigla(valor: unknown): string | null {
  const token = String(valor ?? '').trim().split(/\s+/)[0]?.toUpperCase() || ''
  return /^[A-Z0-9]{2}$/.test(token) ? token : null
}
function clasificarProducto(tipo: unknown): Negocio | null {
  switch (String(tipo ?? '').toUpperCase()) {
    case 'BAF': return 'INTERNET'
    case 'PORTA': return 'PORTABILIDAD'
    case 'LINEA_NUEVA': return 'LINEA_NUEVA'
    default: return null
  }
}
function texto(valor: unknown): string {
  return valor == null ? '' : String(valor).trim()
}
function unirValores(valores: unknown[]): string {
  return [...new Set(valores.map(texto).filter(Boolean))].join(' + ')
}
function fechaArgentina(valor: unknown, hora = false): string {
  const cadena = texto(valor)
  if (!cadena) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(cadena)) {
    const [anio, mes, dia] = cadena.split('-')
    return `${dia}/${mes}/${anio}`
  }
  const fecha = new Date(cadena)
  if (Number.isNaN(fecha.getTime())) return cadena
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit', month: '2-digit', year: 'numeric',
    ...(hora ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).format(fecha)
}
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    const { data: perfil, error: errorPerfil } = await supabase
      .from('profiles').select('rol,activo,vendedor').eq('id', user.id).maybeSingle()
    if (errorPerfil || !perfil?.activo) {
      return NextResponse.json({ error: 'Usuario no habilitado.' }, { status: 403 })
    }
    const rol = texto(perfil.rol).toUpperCase()
    const sigla = extraerSigla(perfil.vendedor)
    const accesoGlobal = ['ADMIN', 'SUPERVISOR', 'BBOO'].includes(rol)
    const accesoGrupo = ['VENDEDOR', 'TERRENO'].includes(rol) &&
      !!sigla && sigla !== 'L1' && sigla !== 'LT'
    if (!accesoGlobal && !accesoGrupo) {
      return NextResponse.json({ error: 'Perfil no habilitado para esta consulta.' }, { status: 403 })
    }
    const body = await request.json().catch(() => ({}))
    if (!Array.isArray(body.negocios) || body.negocios.length === 0 ||
      body.negocios.some((n: unknown) => !NEGOCIOS.includes(n as Negocio))) {
      return NextResponse.json({ error: 'Selección de negocios inválida.' }, { status: 400 })
    }
    const negocios: Negocio[] = [...new Set<Negocio>(body.negocios)]
    const desde = texto(body.desde)
    const hasta = texto(body.hasta)
    const fechaValida = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      !Number.isNaN(new Date(`${v}T12:00:00Z`).getTime()) &&
      new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v
    if (!fechaValida(desde) || !fechaValida(hasta) || desde > hasta) {
      return NextResponse.json({ error: 'Período inválido.' }, { status: 400 })
    }
    // Los filtros aún no están implementados: nunca devolver resultados que los ignoren.
    if (Array.isArray(body.filtros) && body.filtros.length > 0) {
      return NextResponse.json({ error: 'Los filtros personalizados todavía no están disponibles.' }, { status: 400 })
    }
    const admin = createAdminClient()
    type Operacion = {
      id_operacion: string; tipo: string; fecha_hora: string | null;
      vendedor: string | null; origen_dato: string | null; cliente_id: string | null
    }
    const seleccionadas: Array<{ operacion: Operacion; tipos: Set<Negocio> }> = []
    let examinadas = 0
    const offsetInicial = Number(body.offset ?? 0)
    if (!Number.isSafeInteger(offsetInicial) || offsetInicial < 0 || offsetInicial > 100000) {
      return NextResponse.json({ error: 'Desplazamiento inválido.' }, { status: 400 })
    }
    let offset = offsetInicial
    let agotadas = false
    while (seleccionadas.length < LIMITE_VISTA_PREVIA &&
      examinadas < MAX_OPERACIONES_EXAMINADAS) {
      const cantidad = Math.min(TAMANO_LOTE, MAX_OPERACIONES_EXAMINADAS - examinadas)
      let consulta = admin.from('operaciones')
        .select('id_operacion,tipo,fecha_hora,vendedor,origen_dato,cliente_id')
        .in('tipo', ['BAF', 'PORTA'])
        .gte('fecha_hora', `${desde}T00:00:00-03:00`)
        .lt('fecha_hora', `${hasta}T23:59:59.999-03:00`)
        .order('fecha_hora', { ascending: false })
        .order('id_operacion', { ascending: true })
        .range(offset, offset + cantidad - 1)
      if (!accesoGlobal && sigla) consulta = consulta.ilike('vendedor', `${sigla} %`)
      const { data: operaciones, error } = await consulta
      if (error) throw error
      if (!operaciones?.length) { agotadas = true; break }
      offset += operaciones.length
      examinadas += operaciones.length
      const permitidas = operaciones.filter(o => accesoGlobal || extraerSigla(o.vendedor) === sigla)
      if (permitidas.length) {
        const ids = permitidas.map(o => o.id_operacion)
        const [rProductos, rPorta] = await Promise.all([
          admin.from('operacion_productos').select('operacion_id,tipo_producto')
            .in('operacion_id', ids).eq('activo', true),
          admin.from('operaciones_porta').select('operacion_id,es_linea_nueva')
            .in('operacion_id', ids),
        ])
        if (rProductos.error) throw rProductos.error
        if (rPorta.error) throw rPorta.error
        const productos = new Map<string, Set<Negocio>>()
        for (const p of rProductos.data ?? []) {
          const tipo = clasificarProducto(p.tipo_producto)
          if (!tipo) continue
          const id = String(p.operacion_id)
          if (!productos.has(id)) productos.set(id, new Set())
          productos.get(id)!.add(tipo)
        }
        const esLineaNueva = new Map((rPorta.data ?? []).map(p =>
          [String(p.operacion_id), Boolean(p.es_linea_nueva)]))
        for (const operacion of permitidas) {
          const id = String(operacion.id_operacion)
          let tipos = productos.get(id)
          if (!tipos?.size) {
            tipos = new Set<Negocio>([operacion.tipo === 'BAF'
              ? 'INTERNET' : esLineaNueva.get(id) ? 'LINEA_NUEVA' : 'PORTABILIDAD'])
          }
          if (negocios.some(n => tipos!.has(n))) {
            seleccionadas.push({ operacion, tipos })
            if (seleccionadas.length >= LIMITE_VISTA_PREVIA) break
          }
        }
      }
      if (operaciones.length < cantidad) { agotadas = true; break }
    }
    const ids = seleccionadas.map(s => s.operacion.id_operacion)
    const clienteIds = [...new Set(seleccionadas.map(s => s.operacion.cliente_id).filter((id): id is string => !!id))]
    // Las consultas comerciales se realizan únicamente para las 100 operaciones autorizadas.
    const [rClientes, rBaf, rPorta, rGBaf, rGPorta, rProductos] = await Promise.all([
      clienteIds.length ? admin.from('clientes').select('id,dni,nombre,apellido,telefono').in('id', clienteIds) : Promise.resolve({ data: [], error: null }),
      ids.length ? admin.from('operaciones_baf').select('operacion_id,plan,modalidad_plan').in('operacion_id', ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? admin.from('operaciones_porta').select('operacion_id,es_linea_nueva,gigas_acordados').in('operacion_id', ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? admin.from('gestion_baf').select('operacion_id,estado_baf_id').in('operacion_id', ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? admin.from('gestion_porta').select('operacion_id,estado_porta_id,estado_bboo_id,fecha_carga_stl,fecha_porta,sim,plan_cargado').in('operacion_id', ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? admin.from('operacion_productos').select('id,operacion_id,tipo_producto,plan_snapshot').in('operacion_id', ids).eq('activo', true) : Promise.resolve({ data: [], error: null }),
    ])
    for (const r of [rClientes, rBaf, rPorta, rGBaf, rGPorta, rProductos]) if (r.error) throw r.error
    const productosBaf = (rProductos.data ?? []).filter(p => p.tipo_producto === 'BAF')
    const productosMovil = (rProductos.data ?? []).filter(p => p.tipo_producto === 'PORTA' || p.tipo_producto === 'LINEA_NUEVA')
    const productosBafIds = productosBaf.map(p => p.id)
    const rGestionProductosBaf = productosBafIds.length
      ? await admin.from('gestion_producto_baf').select('producto_operacion_id,estado_baf_id').in('producto_operacion_id', productosBafIds)
      : { data: [], error: null }
    if (rGestionProductosBaf.error) throw rGestionProductosBaf.error
    const productosMovilIds = productosMovil.map(p => p.id)
    const rGestionMovil = productosMovilIds.length
      ? await admin.from('gestion_producto_movil').select('producto_operacion_id,estado_porta_id,estado_bboo_id,plan_cargado,sim,fecha_porta,fecha_carga_stl,legajo_enviado').in('producto_operacion_id', productosMovilIds)
      : { data: [], error: null }
    if (rGestionMovil.error) throw rGestionMovil.error
    const gestionMovil = new Map((rGestionMovil.data ?? []).map(g => [String(g.producto_operacion_id), g]))
    const productosMovilPorOperacion = new Map<string, typeof productosMovil>()
    for (const producto of productosMovil) {
      const clave = String(producto.operacion_id)
      if (!productosMovilPorOperacion.has(clave)) productosMovilPorOperacion.set(clave, [])
      productosMovilPorOperacion.get(clave)!.push(producto)
    }
    const gestionProductosBaf = new Map((rGestionProductosBaf.data ?? []).map(g => [String(g.producto_operacion_id), g]))
    const productosBafPorOperacion = new Map<string, typeof productosBaf>()
    for (const producto of productosBaf) {
      const clave = String(producto.operacion_id)
      if (!productosBafPorOperacion.has(clave)) productosBafPorOperacion.set(clave, [])
      productosBafPorOperacion.get(clave)!.push(producto)
    }
    const mapa = <T extends Record<string, unknown>>(filas: T[], clave: keyof T) =>
      new Map(filas.map(f => [String(f[clave]), f]))
    const clientes = mapa(rClientes.data ?? [], 'id')
    const baf = mapa(rBaf.data ?? [], 'operacion_id')
    const porta = mapa(rPorta.data ?? [], 'operacion_id')
    const gestionBaf = mapa(rGBaf.data ?? [], 'operacion_id')
    const gestionPorta = mapa(rGPorta.data ?? [], 'operacion_id')
    const idsEstadoBaf = [...new Set([
      ...(rGBaf.data ?? []).map(g => g.estado_baf_id),
      ...(rGestionProductosBaf.data ?? []).map(g => g.estado_baf_id),
    ].filter((v): v is number => v != null))]
    const idsEstadoPorta = [...new Set([
      ...(rGPorta.data ?? []).map(g => g.estado_porta_id),
      ...(rGestionMovil.data ?? []).map(g => g.estado_porta_id),
    ].filter((v): v is number => v != null))]
    const idsEstadoBboo = [...new Set([
      ...(rGPorta.data ?? []).map(g => g.estado_bboo_id),
      ...(rGestionMovil.data ?? []).map(g => g.estado_bboo_id),
    ].filter((v): v is number => v != null))]
    const [rEB, rEP, rEO] = await Promise.all([
      idsEstadoBaf.length ? admin.from('estados_baf').select('id,nombre').in('id', idsEstadoBaf) : Promise.resolve({ data: [], error: null }),
      idsEstadoPorta.length ? admin.from('estados_porta').select('id,nombre').in('id', idsEstadoPorta) : Promise.resolve({ data: [], error: null }),
      idsEstadoBboo.length ? admin.from('estados_bboo').select('id,nombre').in('id', idsEstadoBboo) : Promise.resolve({ data: [], error: null }),
    ])
    for (const r of [rEB, rEP, rEO]) if (r.error) throw r.error
    const estadosBaf = mapa(rEB.data ?? [], 'id')
    const estadosPorta = mapa(rEP.data ?? [], 'id')
    const estadosBboo = mapa(rEO.data ?? [], 'id')
    const registros = seleccionadas.map(({ operacion: o, tipos }) => {
      const id = String(o.id_operacion)
      const cliente = clientes.get(String(o.cliente_id))
      const b = baf.get(id)
      const p = porta.get(id)
      const gb = gestionBaf.get(id)
      const gp = gestionPorta.get(id)
      const tieneBaf = tipos.has('INTERNET')
      const tieneMovil = tipos.has('PORTABILIDAD') || tipos.has('LINEA_NUEVA')
      const nombre = [texto(cliente?.apellido), texto(cliente?.nombre)].filter(Boolean).join(', ')
      const productosDeBaf = productosBafPorOperacion.get(id) ?? []
      const planesMultiproducto = productosDeBaf.map(producto => producto.plan_snapshot)
      const estadosMultiproductoBaf = productosDeBaf.map(producto => {
        const gestion = gestionProductosBaf.get(String(producto.id))
        return gestion?.estado_baf_id == null ? '' : estadosBaf.get(String(gestion.estado_baf_id))?.nombre
      })
      const estadoBaf = unirValores(estadosMultiproductoBaf) ||
        (gb?.estado_baf_id == null ? '' : texto(estadosBaf.get(String(gb.estado_baf_id))?.nombre))
      const planBaf = unirValores(planesMultiproducto) || texto(b?.plan)
      const productosDeMovil = productosMovilPorOperacion.get(id) ?? []
      const gestionesMovil = productosDeMovil.map(producto => gestionMovil.get(String(producto.id))).filter(g => g != null)
      const estadoPorta = unirValores(gestionesMovil.map(g => g.estado_porta_id == null ? '' : estadosPorta.get(String(g.estado_porta_id))?.nombre)) ||
        (gp?.estado_porta_id == null ? '' : texto(estadosPorta.get(String(gp.estado_porta_id))?.nombre))
      const planMovil = unirValores(productosDeMovil.map(producto => {
        const gestion = gestionMovil.get(String(producto.id))
        return gestion?.plan_cargado || producto.plan_snapshot
      })) || texto(gp?.plan_cargado || p?.gigas_acordados)
      const simMovil = unirValores(gestionesMovil.map(g => g.sim)) || texto(gp?.sim)
      const fechaPortaMovil = gestionesMovil.find(g => g.fecha_porta)?.fecha_porta || gp?.fecha_porta
      const fechaStlMovil = gestionesMovil.find(g => g.fecha_carga_stl)?.fecha_carga_stl || gp?.fecha_carga_stl
      const legajoEnviado = gestionesMovil.some(g => g.legajo_enviado === true) ? 'SI' :
        gestionesMovil.some(g => g.legajo_enviado === false) ? 'NO' : ''
      const estadoBboo = unirValores(gestionesMovil.map(g => g.estado_bboo_id == null ? '' : estadosBboo.get(String(g.estado_bboo_id))?.nombre)) ||
        (gp?.estado_bboo_id == null ? '' : texto(estadosBboo.get(String(gp.estado_bboo_id))?.nombre))
      return {
        id_operacion: id,
        fecha_ingreso: fechaArgentina(o.fecha_hora, true),
        tipo: tipos.size === 1 ? (tipos.has('INTERNET') ? 'BAF' : tipos.has('LINEA_NUEVA') ? 'LINEA NUEVA' : 'PORTABILIDAD') : NEGOCIOS.filter(n => tipos.has(n)).join(' + '),
        negocios: NEGOCIOS.filter(n => tipos.has(n)).join(' + '),
        vendedor: texto(o.vendedor),
        origen_dato: texto(o.origen_dato),
        cliente: nombre,
        dni: texto(cliente?.dni),
        telefono: texto(cliente?.telefono),
        estado_venta: unirValores([tieneBaf ? estadoBaf : '', tieneMovil ? estadoPorta : '']),
        estado_bboo: tieneMovil ? estadoBboo : '',
        plan: unirValores([tieneBaf ? planBaf : '', tieneMovil ? planMovil : '']),
        sim: tieneMovil ? simMovil : '',
        legajo_enviado: tieneMovil ? legajoEnviado : '',
        fecha_porta: tipos.has('PORTABILIDAD') ? fechaArgentina(fechaPortaMovil) : '',
        fecha_carga_stl: tieneMovil ? fechaArgentina(fechaStlMovil) : '',
      }
    })
    return NextResponse.json({
      columnas: ['id_operacion','fecha_ingreso','tipo','negocios','vendedor','origen_dato',
        'cliente','dni','telefono','estado_venta','estado_bboo','plan','sim','legajo_enviado','fecha_porta','fecha_carga_stl'],
      registros,
      cantidad: registros.length,
      limite: LIMITE_VISTA_PREVIA,
      examinadas,
      siguienteOffset: offset,
      agotadas,
      busquedaParcial: !agotadas && examinadas >= MAX_OPERACIONES_EXAMINADAS,
    })
  } catch (error) {
    console.error('[ReportMaker preview]', error)
    return NextResponse.json({ error: 'No se pudo consultar la vista previa.' }, { status: 500 })
  }
}
