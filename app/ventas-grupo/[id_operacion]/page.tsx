import { notFound, redirect } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'
import { createAdminClient } from '../../../utils/supabase/admin'
import AppHeader from '../../../components/AppHeader'

type Params = Promise<{ id_operacion: string }>

function extraerSigla(valor: unknown) {
  const token = String(valor ?? '').trim().split(/\s+/)[0]?.toUpperCase() || ''
  return /^[A-Z0-9]{2}$/.test(token) ? token : null
}

function mostrar(valor: unknown) {
  if (valor === null || valor === undefined || valor === '') return '-'
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No'
  return String(valor)
}

function fechaArgentina(fecha: string | null) {
  if (!fecha) return '-'
  const d = new Date(fecha)
  if (Number.isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('es-AR', { timeZone:'America/Argentina/Buenos_Aires', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(d)
}

function fechaSimple(fecha: string | null) {
  if (!fecha) return '-'
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) { const [a,m,d]=fecha.split('-'); return `${d}/${m}/${a}` }
  return fechaArgentina(fecha)
}

function Campo({label,value,ancho=false}:{label:string;value:unknown;ancho?:boolean}) {
  return <div className={ancho?'sm:col-span-2':''}><div className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</div><div className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">{mostrar(value)}</div></div>
}

function nombrePerfil(p:any){ return p?.vendedor || p?.nombre || '-' }

export default async function DetalleVentaGrupo({ params }:{ params:Params }) {
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  if(!user) redirect('/login')
  const {data:profile}=await supabase.from('profiles').select('nombre,vendedor,rol,activo,puede_gestionar_ventas').eq('id',user.id).maybeSingle()
  if(!profile?.activo) redirect('/login')
  const sigla=extraerSigla(profile.vendedor)
  if(!['VENDEDOR','TERRENO'].includes(String(profile.rol)) || !sigla || sigla==='L1') redirect('/ventas')

  const {id_operacion}=await params
  const id=decodeURIComponent(id_operacion)
  const admin=createAdminClient()
  const {data:operacion,error}=await admin.from('operaciones').select(`
    id_operacion, grupo_operacion, tipo, fecha_hora, vendedor, origen_dato, cliente_id, domicilio_id,
    cliente:clientes (dni,tipo_documento,nombre,apellido,fecha_nacimiento,email,telefono,telefono_alternativo),
    domicilio:domicilios (calle_nro,piso,dpto,entre_calles,barrio,localidad,coordenadas,datos_extras),
    operaciones_baf (tipo_domicilio,plan,tv,cantidad_decos,zona,horario_contacto,convergente,linea_convergente,modalidad_plan),
    operaciones_porta (nim,es_linea_nueva,gigas_acordados,tipo_sim,compania_actual,prepago_pospago,observaciones,numero_linea),
    gestion_baf (responsable_id,fecha_gestion,prospector,detalle_lead,cia_celular,sds,orden_trabajo,linea_fija,fecha_instalacion,ciclo_cuenta,motivo_estado,estado_baf_id),
    gestion_porta (responsable_id,bboo_id,fecha_carga_stl,sim,plan_cargado,sds,spn,pin_lnva_nro,documentacion_dni,medio_despacho_chip_id,fecha_porta,numero_seguimiento,observaciones_gestion,estado_porta_id,estado_bboo_id)
  `).eq('id_operacion',id).maybeSingle()
  if(error) throw new Error(`No se pudo cargar la venta: ${error.message}`)
  if(!operacion) notFound()
  const op:any=operacion
  if(extraerSigla(op.vendedor)!==sigla) notFound()

  const {data:productos,error:eProd}=await admin.from('operacion_productos').select('id,tipo_producto,orden,producto_snapshot,origen_snapshot,plan_snapshot,precio_lista_snapshot,descuento_snapshot,precio_cliente_snapshot,beneficios_snapshot,responsable_id').eq('operacion_id',id).eq('activo',true).order('orden')
  if(eProd) throw new Error(`No se pudieron cargar los productos: ${eProd.message}`)
  const productosLista:any[]=productos??[]
  const ids=productosLista.map(p=>p.id)
  const [rBaf,rMov,rGBaf,rGMov,rProfiles,rEB,rEP,rEO,rMedios,rContexto]=await Promise.all([
    ids.length?admin.from('operacion_producto_baf').select('*').in('producto_operacion_id',ids):Promise.resolve({data:[],error:null}),
    ids.length?admin.from('operacion_producto_movil').select('*').in('producto_operacion_id',ids):Promise.resolve({data:[],error:null}),
    ids.length?admin.from('gestion_producto_baf').select('*').in('producto_operacion_id',ids):Promise.resolve({data:[],error:null}),
    ids.length?admin.from('gestion_producto_movil').select('*').in('producto_operacion_id',ids):Promise.resolve({data:[],error:null}),
    admin.from('profiles').select('id,nombre,vendedor'),
    admin.from('estados_baf').select('id,nombre'), admin.from('estados_porta').select('id,nombre'), admin.from('estados_bboo').select('id,nombre'),
    admin.from('medios_despacho_chip').select('id,nombre'),
    admin.from('operacion_contexto_comercial').select('*').eq('operacion_id',id).maybeSingle(),
  ])
  for(const r of [rBaf,rMov,rGBaf,rGMov,rProfiles,rEB,rEP,rEO,rMedios]) if((r as any).error) throw (r as any).error
  const map=(arr:any[],key='id')=>new Map(arr.map(x=>[x[key],x]))
  const baf=map(rBaf.data??[],'producto_operacion_id'), mov=map(rMov.data??[],'producto_operacion_id'), gb=map(rGBaf.data??[],'producto_operacion_id'), gm=map(rGMov.data??[],'producto_operacion_id')
  const perfiles=map(rProfiles.data??[]), eb=map(rEB.data??[]), ep=map(rEP.data??[]), eo=map(rEO.data??[]), medios=map(rMedios.data??[])
  const contexto:any=(rContexto as any).data??null
  const cliente:any=op.cliente, dom:any=op.domicilio

  return <main className="min-h-screen bg-gray-50">
    <AppHeader rol={profile.rol} usuario={profile.nombre?.trim()||user.email||'Usuario'} actual="VENTAS_GRUPO" puedeGestionarVentas={profile.puede_gestionar_ventas===true}/>
    <div className="mx-auto max-w-5xl p-4 sm:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold text-gray-900">Venta del Grupo</h1><p className="mt-1 font-mono text-xs text-gray-500">{op.id_operacion}</p></div><a href="/ventas-grupo" className="text-sm font-semibold text-gray-600 hover:text-gray-900">Volver a Ventas del Grupo</a></div>
      <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"><b>Solo lectura.</b> Esta sección permite consultar la operación, pero no modificar su gestión.</div>
      <div className="space-y-5">
        <section className="rounded-2xl border border-gray-200 bg-white p-5"><h2 className="mb-4 text-lg font-semibold">Operación</h2><div className="grid gap-5 sm:grid-cols-2"><Campo label="Fecha / Hora" value={fechaArgentina(op.fecha_hora)}/><Campo label="Vendedor" value={op.vendedor}/><Campo label="Origen del dato" value={op.origen_dato}/><Campo label="Grupo" value={sigla}/></div></section>
        <section className="rounded-2xl border border-gray-200 bg-white p-5"><h2 className="mb-4 text-lg font-semibold">Cliente</h2><div className="grid gap-5 sm:grid-cols-2"><Campo label="Apellido y Nombre" value={[cliente?.apellido,cliente?.nombre].filter(Boolean).join(', ')}/><Campo label="Documento" value={`${cliente?.tipo_documento||''} ${cliente?.dni||''}`.trim()}/><Campo label="Fecha de nacimiento" value={fechaSimple(cliente?.fecha_nacimiento)}/><Campo label="Correo electrónico" value={cliente?.email}/><Campo label="Teléfono" value={cliente?.telefono}/><Campo label="Teléfono alternativo" value={cliente?.telefono_alternativo}/></div></section>
        <section className="rounded-2xl border border-gray-200 bg-white p-5"><h2 className="mb-4 text-lg font-semibold">Domicilio</h2><div className="grid gap-5 sm:grid-cols-2"><Campo label="Calle / Número" value={dom?.calle_nro}/><Campo label="Piso / Dpto" value={[dom?.piso,dom?.dpto].filter(Boolean).join(' / ')}/><Campo label="Entre calles" value={dom?.entre_calles}/><Campo label="Barrio" value={dom?.barrio}/><Campo label="Localidad" value={dom?.localidad}/><Campo label="Coordenadas" value={dom?.coordenadas}/><Campo label="Datos extras" value={dom?.datos_extras} ancho/></div></section>
        {contexto?.es_conexion_full && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="mb-4 text-lg font-semibold">Conexión Full</h2><div className="grid gap-5 sm:grid-cols-2"><Campo label="Modalidad" value={contexto.modalidad_conexion_full}/><Campo label="Referencia habilitante" value={contexto.referencia_habilitante||contexto.tipo_referencia_habilitante}/><Campo label="Cantidad de servicios" value={contexto.cantidad_servicios}/><Campo label="Descuento convergencia" value={contexto.descuento_convergencia}/></div></section>}
        {productosLista.length>0 ? productosLista.map((p:any)=>{const esBaf=p.tipo_producto==='BAF'; const d:any=esBaf?baf.get(p.id):mov.get(p.id); const g:any=esBaf?gb.get(p.id):gm.get(p.id); const responsable:any=perfiles.get(p.responsable_id||g?.responsable_id); const bboo:any=!esBaf?perfiles.get(g?.bboo_id):null; const estado=esBaf?(eb.get(g?.estado_baf_id) as any)?.nombre:(ep.get(g?.estado_porta_id) as any)?.nombre; const estadoBboo=!esBaf?(eo.get(g?.estado_bboo_id) as any)?.nombre:null; return <section key={p.id} className="rounded-2xl border border-gray-200 bg-white p-5"><h2 className="mb-4 text-lg font-semibold">{p.tipo_producto==='LINEA_NUEVA'?'Línea Nueva':p.tipo_producto} · {p.plan_snapshot||p.producto_snapshot||'-'}</h2><div className="grid gap-5 sm:grid-cols-2"><Campo label="Responsable" value={nombrePerfil(responsable)}/><Campo label="Estado" value={estado||'Sin gestión'}/>{esBaf?<><Campo label="SDS" value={g?.sds}/><Campo label="OT" value={g?.orden_trabajo}/><Campo label="Fecha instalación" value={fechaSimple(g?.fecha_instalacion)}/><Campo label="Línea fija" value={g?.linea_fija}/><Campo label="Modalidad" value={d?.modalidad_plan}/><Campo label="TV" value={d?.tv}/></>:<><Campo label="NIM / Línea" value={d?.nim||d?.numero_linea}/><Campo label="Compañía actual" value={d?.compania_actual}/><Campo label="Tipo SIM" value={d?.tipo_sim}/><Campo label="SIM operativo" value={g?.sim}/><Campo label="SDS" value={g?.sds}/><Campo label="Plan cargado" value={g?.plan_cargado}/><Campo label="Estado BBOO" value={estadoBboo||'Sin gestión'}/><Campo label="BBOO asignado" value={nombrePerfil(bboo)}/><Campo label="Fecha Carga STL" value={fechaSimple(g?.fecha_carga_stl)}/><Campo label="Fecha Porta" value={fechaSimple(g?.fecha_porta)}/><Campo label="Medio despacho" value={(medios.get(g?.medio_despacho_chip_id) as any)?.nombre}/><Campo label="Seguimiento" value={g?.numero_seguimiento}/><Campo label="Observaciones" value={g?.observaciones_gestion} ancho/></>}</div></section>}) : <section className="rounded-2xl border border-gray-200 bg-white p-5"><h2 className="mb-4 text-lg font-semibold">Producto</h2><div className="grid gap-5 sm:grid-cols-2">{op.tipo==='BAF'?<><Campo label="Tipo" value="BAF"/><Campo label="Plan" value={op.operaciones_baf?.plan}/><Campo label="Modalidad" value={op.operaciones_baf?.modalidad_plan}/><Campo label="Estado" value={(eb.get(op.gestion_baf?.estado_baf_id) as any)?.nombre||'Sin gestión'}/><Campo label="SDS" value={op.gestion_baf?.sds}/><Campo label="OT" value={op.gestion_baf?.orden_trabajo}/></>:<><Campo label="Tipo" value={op.operaciones_porta?.es_linea_nueva?'LN':'PORTA'}/><Campo label="NIM" value={op.operaciones_porta?.nim}/><Campo label="Plan" value={op.operaciones_porta?.gigas_acordados}/><Campo label="Compañía" value={op.operaciones_porta?.compania_actual}/><Campo label="Estado" value={(ep.get(op.gestion_porta?.estado_porta_id) as any)?.nombre||'Sin gestión'}/><Campo label="Estado BBOO" value={(eo.get(op.gestion_porta?.estado_bboo_id) as any)?.nombre||'Sin gestión'}/><Campo label="SIM" value={op.gestion_porta?.sim}/><Campo label="SDS" value={op.gestion_porta?.sds}/></>}</div></section>}
      </div>
    </div>
  </main>
}
