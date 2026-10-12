import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { createAdminClient } from '../../../../utils/supabase/admin'
import { validarFiltros, cumpleFiltros } from '../../../../lib/reportmaker/filtros'
import { CAMPOS_VENTAS } from '../../../../lib/reportmaker/catalogo'
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
    const accesoGlobal =
  ['ADMIN', 'SUPER', 'SUPERVISOR'].includes(rol) ||
  (rol === 'VENDEDOR' && sigla === 'L1')

const accesoGrupo =
  ['VENDEDOR', 'TERRENO'].includes(rol) &&
  !!sigla &&
  !accesoGlobal
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
    const modoOpciones = body.modo === 'opciones'
    let filtros: ReturnType<typeof validarFiltros>
    try { filtros = validarFiltros(modoOpciones ? [] : body.filtros) }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Filtros inválidos.' }, { status: 400 }) }
    const admin = createAdminClient()
    type Operacion = {
      id_operacion: string; tipo: string; fecha_hora: string | null;
       vendedor: string | null; origen_dato: string | null; cliente_id: string | null; domicilio_id: string | null
    }
    let examinadas = 0
    const offsetInicial = Number(body.offset ?? 0)
    if (!Number.isSafeInteger(offsetInicial) || offsetInicial < 0 || offsetInicial > 100000) {
      return NextResponse.json({ error: 'Desplazamiento inválido.' }, { status: 400 })
    }
    let offset = offsetInicial
    let agotadas = false
    async function hidratar(seleccionadas: Array<{ operacion: Operacion; tipos: Set<Negocio> }>) {
    const ids = seleccionadas.map(s => s.operacion.id_operacion)
     const clienteIds = [...new Set(seleccionadas.map(s => s.operacion.cliente_id).filter((id): id is string => !!id))]
     const domicilioIds = [...new Set(seleccionadas.map(s => s.operacion.domicilio_id).filter((id): id is string => !!id))]
    // Hidratar únicamente el lote autorizado, antes de evaluar los filtros.
    const [rClientes, rDom, rBaf, rPorta, rGBaf, rGPorta, rProductos] = await Promise.all([
       clienteIds.length ? admin.from('clientes').select('id,dni,nombre,apellido,telefono').in('id', clienteIds) : Promise.resolve({ data: [], error: null }),
       domicilioIds.length ? admin.from('domicilios').select('id,calle_nro,piso,dpto,entre_calles,barrio,localidad,datos_extras').in('id', domicilioIds) : Promise.resolve({ data: [], error: null }),
      ids.length ? admin.from('operaciones_baf').select('operacion_id,plan,modalidad_plan').in('operacion_id', ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? admin.from('operaciones_porta').select('operacion_id,es_linea_nueva,gigas_acordados,compania_actual,numero_linea,tipo_sim,nim').in('operacion_id', ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? admin.from('gestion_baf').select('operacion_id,estado_baf_id,responsable_id,sds,fecha_instalacion,orden_trabajo').in('operacion_id', ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? admin.from('gestion_porta').select('operacion_id,estado_porta_id,estado_bboo_id,fecha_carga_stl,fecha_porta,sim,plan_cargado,responsable_id,bboo_id,medio_despacho_chip_id,pin_lnva_nro,sds,numero_seguimiento').in('operacion_id', ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? admin.from('operacion_productos').select('id,operacion_id,tipo_producto,plan_snapshot,responsable_id').in('operacion_id', ids).eq('activo', true) : Promise.resolve({ data: [], error: null }),
    ])
    for (const r of [rClientes, rDom, rBaf, rPorta, rGBaf, rGPorta, rProductos]) if (r.error) throw r.error
    const productosBaf = (rProductos.data ?? []).filter(p => p.tipo_producto === 'BAF')
    const productosMovil = (rProductos.data ?? []).filter(p => p.tipo_producto === 'PORTA' || p.tipo_producto === 'LINEA_NUEVA')
    const productosBafIds = productosBaf.map(p => p.id)
    const rGestionProductosBaf = productosBafIds.length
      ? await admin.from('gestion_producto_baf').select('producto_operacion_id,estado_baf_id,estado_claro,motivo_cierre,fecha_cierre,responsable_id,sds,orden_trabajo,fecha_instalacion').in('producto_operacion_id', productosBafIds)
      : { data: [], error: null }
    if (rGestionProductosBaf.error) throw rGestionProductosBaf.error
    const productosMovilIds = productosMovil.map(p => p.id)
    const rGestionMovil = productosMovilIds.length
      ? await admin.from('gestion_producto_movil').select('producto_operacion_id,estado_porta_id,estado_bboo_id,plan_cargado,sim,fecha_porta,fecha_carga_stl,legajo_enviado,responsable_id,bboo_id,sds,numero_seguimiento,medio_despacho_chip_id,pin_lnva_nro').in('producto_operacion_id', productosMovilIds)
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
     const domicilios = mapa(rDom.data ?? [], 'id')
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
     const perfilIds = [...new Set([
       ...(rProductos.data ?? []).map(p => p.responsable_id),
       ...(rGestionProductosBaf.data ?? []).map(g => g.responsable_id),
       ...(rGestionMovil.data ?? []).flatMap(g => [g.responsable_id, g.bboo_id]),
       ...(rGBaf.data ?? []).map(g => g.responsable_id),
       ...(rGPorta.data ?? []).flatMap(g => [g.responsable_id, g.bboo_id]),
     ].filter((id): id is string => !!id))]
     const medioIds = [...new Set([...(rGPorta.data ?? []).map(g => g.medio_despacho_chip_id), ...(rGestionMovil.data ?? []).map(g => g.medio_despacho_chip_id)].filter((id): id is number => id != null))]
     const [rPerfiles, rMedios] = await Promise.all([
       perfilIds.length ? admin.from('profiles').select('id,nombre,vendedor').in('id',perfilIds) : Promise.resolve({data:[],error:null}),
       medioIds.length ? admin.from('medios_despacho_chip').select('id,nombre').in('id',medioIds) : Promise.resolve({data:[],error:null}),
     ])
     for (const r of [rPerfiles,rMedios]) if (r.error) throw r.error
     const perfiles = mapa(rPerfiles.data ?? [], 'id')
     const medios = mapa(rMedios.data ?? [], 'id')
     const nombrePerfil = (id: unknown) => id == null ? '' : texto(perfiles.get(String(id))?.vendedor || perfiles.get(String(id))?.nombre)

    const registros = seleccionadas.map(({ operacion: o, tipos }) => {
      const id = String(o.id_operacion)
       const cliente = clientes.get(String(o.cliente_id))
       const domicilio = domicilios.get(String(o.domicilio_id))
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
       const gestionesDeBaf = productosDeBaf.map(producto => gestionProductosBaf.get(String(producto.id))).filter(g => g != null)
       const estadoClaro = unirValores(gestionesDeBaf.map(g => g.estado_claro))
       const motivoCierre = unirValores(gestionesDeBaf.map(g => g.motivo_cierre))
       const fechaCierre = unirValores(gestionesDeBaf.map(g => fechaArgentina(g.fecha_cierre)))
      const productosDeMovil = productosMovilPorOperacion.get(id) ?? []
      const gestionesMovil = productosDeMovil.map(producto => gestionMovil.get(String(producto.id))).filter(g => g != null)
      const estadoPorta = unirValores(gestionesMovil.map(g => g.estado_porta_id == null ? '' : estadosPorta.get(String(g.estado_porta_id))?.nombre)) ||
        (gp?.estado_porta_id == null ? '' : texto(estadosPorta.get(String(gp.estado_porta_id))?.nombre))
      const planMovil = unirValores(productosDeMovil.map(producto => {
        const gestion = gestionMovil.get(String(producto.id))
        return gestion?.plan_cargado || producto.plan_snapshot
      })) || texto(gp?.plan_cargado || p?.gigas_acordados)
       const simMovil = unirValores(gestionesMovil.map(g => g.sim)) || texto(gp?.sim)
       const responsablesProducto = [...productosDeBaf.map(p => p.responsable_id || gestionProductosBaf.get(String(p.id))?.responsable_id), ...productosDeMovil.map(p => p.responsable_id || gestionMovil.get(String(p.id))?.responsable_id)]
       const responsables = unirValores(responsablesProducto.map(id => nombrePerfil(id)).filter(Boolean))
       const responsableId = tieneBaf && !tieneMovil ? gb?.responsable_id : gp?.responsable_id || gb?.responsable_id
       const domicilioCompleto = [texto(domicilio?.calle_nro), domicilio?.piso ? `Piso ${domicilio.piso}` : '', domicilio?.dpto ? `Dpto ${domicilio.dpto}` : ''].filter(Boolean).join(' | ')
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
         responsable: responsables || nombrePerfil(responsableId),
         bboo: tieneMovil ? unirValores(gestionesMovil.map(g => nombrePerfil(g.bboo_id))) || nombrePerfil(gp?.bboo_id) : '',
         domicilio: domicilioCompleto,
         localidad: texto(domicilio?.localidad),
         barrio: texto(domicilio?.barrio),
         entre_calles: texto(domicilio?.entre_calles),
         observaciones: texto(domicilio?.datos_extras),
         numero_linea: tieneMovil ? texto(p?.numero_linea) : '',
         compania_actual: tieneMovil ? texto(p?.compania_actual) : '',
         tipo_sim: tieneMovil ? texto(p?.tipo_sim) : '',
         plan_acordado: tieneMovil ? texto(p?.gigas_acordados) : '',
         plan_cargado: tieneMovil ? unirValores(gestionesMovil.map(g => g.plan_cargado)) || texto(gp?.plan_cargado) : '',
         pin: tieneMovil ? unirValores(gestionesMovil.map(g => g.pin_lnva_nro)) || texto(gp?.pin_lnva_nro) : '',
         medio_despacho_chip: tieneMovil ? unirValores(gestionesMovil.map(g => medios.get(String(g.medio_despacho_chip_id))?.nombre)) || texto(medios.get(String(gp?.medio_despacho_chip_id))?.nombre) : '',
         numero_seguimiento: tieneMovil ? unirValores(gestionesMovil.map(g => g.numero_seguimiento)) || texto(gp?.numero_seguimiento) : '',
         sds: unirValores([tieneBaf ? unirValores(gestionesDeBaf.map(g => g.sds)) || gb?.sds : '', tieneMovil ? unirValores(gestionesMovil.map(g => g.sds)) || gp?.sds : '']),
         fecha_instalacion: tieneBaf ? unirValores(gestionesDeBaf.map(g => fechaArgentina(g.fecha_instalacion))) || fechaArgentina(gb?.fecha_instalacion) : '',
         orden_trabajo: tieneBaf ? unirValores(gestionesDeBaf.map(g => g.orden_trabajo)) || texto(gb?.orden_trabajo) : '',
         estado_vendedor: tieneMovil ? estadoPorta : '',
         estado_baf: tieneBaf ? estadoBaf : '',
         estado_claro: tieneBaf ? estadoClaro : '',
         motivo_cierre: tieneBaf ? motivoCierre : '',
         fecha_cierre: tieneBaf ? fechaCierre : '',
      }
    })
    return registros
    }
    const registros: Awaited<ReturnType<typeof hidratar>> = []
    const opciones: Record<string, Set<string>> = {}
    if (modoOpciones) {
      for (const campo of CAMPOS_VENTAS.map(c => c.id)) opciones[campo] = new Set()
    }
    while ((modoOpciones || registros.length < LIMITE_VISTA_PREVIA) &&
      examinadas < MAX_OPERACIONES_EXAMINADAS) {
      const cantidad = Math.min(TAMANO_LOTE, MAX_OPERACIONES_EXAMINADAS - examinadas)
      let consulta = admin.from('operaciones')
        .select('id_operacion,tipo,fecha_hora,vendedor,origen_dato,cliente_id,domicilio_id')
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
      const seleccionadas: Array<{ operacion: Operacion; tipos: Set<Negocio> }> = []
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
          }
        }
      }
      if (seleccionadas.length) {
        const hidratadas = await hidratar(seleccionadas)
        for (const registro of hidratadas) {
          if (modoOpciones) {
            for (const campo of Object.keys(opciones)) {
              const valor = texto(registro[campo as keyof typeof registro])
              if (valor) opciones[campo].add(valor)
            }
            continue
          }
          if (!cumpleFiltros(registro, filtros)) continue
          registros.push(registro)
          if (registros.length === LIMITE_VISTA_PREVIA) {
            // El siguiente lote comienza después de esta operación, no después de
            // todas las operaciones descargadas: evita perder coincidencias.
            const posicion = operaciones.findIndex(o => String(o.id_operacion) === registro.id_operacion)
            offset -= operaciones.length - posicion - 1
            break
          }
        }
      }
      if (!modoOpciones && registros.length >= LIMITE_VISTA_PREVIA) break
      if (operaciones.length < cantidad) { agotadas = true; break }
    }
    if (modoOpciones) {
      return NextResponse.json({
        opciones: Object.fromEntries(Object.entries(opciones).map(([campo, valores]) =>
          [campo, [...valores].sort((a, b) => a.localeCompare(b, 'es-AR', { sensitivity: 'base' }))])),
        examinadas, busquedaParcial: !agotadas,
      })
    }
    return NextResponse.json({
             columnas: CAMPOS_VENTAS.map(c => c.id),
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
