import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createClient } from '../../../../utils/supabase/server'
import { createAdminClient } from '../../../../utils/supabase/admin'

const CAMPOS_FECHA = new Set(['fecha_ingreso','fecha_carga_stl','fecha_porta','fecha_instalacion'])
const CAMPOS_NUMERO = new Set<string>()
const PRODUCTOS_VALIDOS = new Set(['BAF','PORTA','LN'])
const BASES_VALIDAS = new Set(['fecha_ingreso','fecha_carga_stl','fecha_porta'])

function tipoVisible(o:any){ return o.tipo==='PORTA' && o.operaciones_porta?.es_linea_nueva ? 'LN' : o.tipo }
function nombreCliente(c:any){ if(!c)return '-'; return [String(c.apellido??'').trim(),String(c.nombre??'').trim()].filter(Boolean).join(', ')||'-' }
function diaAR(v:any){ if(!v)return ''; if(/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return String(v); const d=new Date(v); if(Number.isNaN(d.getTime()))return ''; return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(d) }
function fechaExcel(v:any){ if(!v)return null; if(/^\d{4}-\d{2}-\d{2}$/.test(String(v))){ const [y,m,d]=String(v).split('-').map(Number); return new Date(Date.UTC(y,m-1,d,12,0,0)) } const d=new Date(v); return Number.isNaN(d.getTime())?null:d }

export async function POST(request: Request){
  try {
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user) return NextResponse.json({error:'No autenticado.'},{status:401})
    const {data:profile}=await supabase.from('profiles').select('rol, activo').eq('id',user.id).maybeSingle()
    if(!profile?.activo) return NextResponse.json({error:'Usuario inactivo.'},{status:403})
    const rol=String(profile.rol||'').toUpperCase()
    if(!['BBOO','SUPERVISOR','ADMIN'].includes(rol)) return NextResponse.json({error:'No tiene permisos para exportar ventas.'},{status:403})

    const body=await request.json().catch(()=>({}))
    const desde=String(body.desde??''); const hasta=String(body.hasta??'')
    const productos: string[] = Array.isArray(body.productos)
      ? Array.from(new Set<string>(body.productos.map((x: any) => String(x).toUpperCase())))
      : []
    const baseFecha=String(body.base_fecha??''); const formato=String(body.formato??'').toLowerCase(); const camposExportacion=String(body.campos_exportacion??'vista').toLowerCase()
    if(!/^\d{4}-\d{2}-\d{2}$/.test(desde)||!/^\d{4}-\d{2}-\d{2}$/.test(hasta)||desde>hasta) return NextResponse.json({error:'Rango de fechas inválido.'},{status:400})
    if(productos.length===0||productos.some((p:string)=>!PRODUCTOS_VALIDOS.has(p))) return NextResponse.json({error:'Selección de productos inválida.'},{status:400})
    if(!BASES_VALIDAS.has(baseFecha)) return NextResponse.json({error:'Base de fecha inválida.'},{status:400})
    if(productos.includes('BAF') && baseFecha!=='fecha_ingreso') return NextResponse.json({error:'Con BAF seleccionado solo puede usarse Fecha Ingreso.'},{status:400})
    if(productos.includes('LN') && baseFecha==='fecha_porta') return NextResponse.json({error:'Fecha Porta solo está disponible para PORTA sin Línea Nueva.'},{status:400})
    if(!['csv','xlsx'].includes(formato)) return NextResponse.json({error:'Formato inválido.'},{status:400})
    if(!['vista','todos'].includes(camposExportacion)) return NextResponse.json({error:'Selección de campos inválida.'},{status:400})

    const admin=createAdminClient()
    const {data:vista,error:errorVista}=await admin.from('vistas_gestion_ventas').select('campo,etiqueta,visible,orden,ancho').eq('rol',rol).order('orden',{ascending:true}).order('campo',{ascending:true})
    if(errorVista) throw errorVista
    const configuracion=(vista??[]).map((c:any)=>({campo:String(c.campo),etiqueta:String(c.etiqueta||c.campo),visible:Boolean(c.visible),orden:Number(c.orden)||0,ancho:Math.min(600,Math.max(60,Number(c.ancho)||140))}))
    const columnasVisibles=configuracion.filter((c:any)=>c.visible)
    if(columnasVisibles.length===0) return NextResponse.json({error:'La vista del rol no tiene columnas visibles.'},{status:400})
    const columnas=camposExportacion==='todos'?configuracion:columnasVisibles
    if(columnas.length===0) return NextResponse.json({error:'No hay campos disponibles para exportar.'},{status:400})

    const {data:ops,error:eOps}=await admin.from('operaciones').select('id_operacion,tipo,fecha_hora,vendedor,origen_dato,cliente_id,grupo_operacion').in('tipo',['BAF','PORTA']).order('fecha_hora',{ascending:false})
    if(eOps) throw eOps
    const operaciones=ops??[]; const ids=operaciones.map((o:any)=>o.id_operacion); const clienteIds=Array.from(new Set(operaciones.map((o:any)=>o.cliente_id).filter(Boolean)))
    const [rCli,rBaf,rPorta,rGBaf,rGPorta,rPerfiles,rMedios]=await Promise.all([
      clienteIds.length?admin.from('clientes').select('id,dni,tipo_documento,nombre,apellido,telefono').in('id',clienteIds):Promise.resolve({data:[],error:null}),
      ids.length?admin.from('operaciones_baf').select('operacion_id,plan,modalidad_plan').in('operacion_id',ids):Promise.resolve({data:[],error:null}),
      ids.length?admin.from('operaciones_porta').select('operacion_id,nim,es_linea_nueva,gigas_acordados,compania_actual,numero_linea,tipo_sim').in('operacion_id',ids):Promise.resolve({data:[],error:null}),
      ids.length?admin.from('gestion_baf').select('operacion_id,responsable_id,estado_baf_id,sds,fecha_instalacion,orden_trabajo').in('operacion_id',ids):Promise.resolve({data:[],error:null}),
      ids.length?admin.from('gestion_porta').select('operacion_id,responsable_id,estado_porta_id,estado_bboo_id,bboo_id,medio_despacho_chip_id,fecha_carga_stl,fecha_porta,pin_lnva_nro,sim,plan_cargado,sds,numero_seguimiento').in('operacion_id',ids):Promise.resolve({data:[],error:null}),
      admin.from('profiles').select('id,nombre,vendedor'), admin.from('medios_despacho_chip').select('id,nombre')
    ])
    for(const r of [rCli,rBaf,rPorta,rGBaf,rGPorta,rPerfiles,rMedios]) if((r as any).error) throw (r as any).error
    const idsEB=Array.from(new Set((rGBaf.data??[]).map((g:any)=>g.estado_baf_id).filter(Boolean))); const idsEP=Array.from(new Set((rGPorta.data??[]).map((g:any)=>g.estado_porta_id).filter(Boolean))); const idsEO=Array.from(new Set((rGPorta.data??[]).map((g:any)=>g.estado_bboo_id).filter(Boolean)))
    const [rEB,rEP,rEO]=await Promise.all([
      idsEB.length?admin.from('estados_baf').select('id,nombre').in('id',idsEB):Promise.resolve({data:[],error:null}),
      idsEP.length?admin.from('estados_porta').select('id,nombre').in('id',idsEP):Promise.resolve({data:[],error:null}),
      idsEO.length?admin.from('estados_bboo').select('id,nombre').in('id',idsEO):Promise.resolve({data:[],error:null})])
    for(const r of [rEB,rEP,rEO]) if((r as any).error) throw (r as any).error
    const map=(arr:any[],key='id')=>new Map(arr.map((x:any)=>[x[key],x])); const cli=map(rCli.data??[]), baf=map(rBaf.data??[],'operacion_id'), porta=map(rPorta.data??[],'operacion_id'), gb=map(rGBaf.data??[],'operacion_id'), gp=map(rGPorta.data??[],'operacion_id'), perfiles=map(rPerfiles.data??[]), medios=map(rMedios.data??[]), eb=map(rEB.data??[]), ep=map(rEP.data??[]), eo=map(rEO.data??[])
    const nombrePerfil=(id:any)=>{const p:any=perfiles.get(id); return p?.vendedor||p?.nombre||'-'}
    const completas=operaciones.map((o:any)=>{ const gB:any=gb.get(o.id_operacion), gP:any=gp.get(o.id_operacion); return {...o,cliente:cli.get(o.cliente_id)||null,operaciones_baf:baf.get(o.id_operacion)||null,operaciones_porta:porta.get(o.id_operacion)||null,gestion_baf:gB?{...gB,estado_nombre:(eb.get(gB.estado_baf_id) as any)?.nombre||null}:null,gestion_porta:gP?{...gP,estado_vendedor_nombre:(ep.get(gP.estado_porta_id) as any)?.nombre||null,estado_bboo_nombre:(eo.get(gP.estado_bboo_id) as any)?.nombre||null}:null} })
    const responsable=(o:any)=>nombrePerfil(o.tipo==='BAF'?o.gestion_baf?.responsable_id:o.gestion_porta?.responsable_id)==='-'?'Sin responsable':nombrePerfil(o.tipo==='BAF'?o.gestion_baf?.responsable_id:o.gestion_porta?.responsable_id)
    const valor=(o:any,c:string)=>{const p=o.operaciones_porta,g=o.gestion_porta,b=o.gestion_baf; switch(c){case'fecha_ingreso':return o.fecha_hora||null;case'tipo':return tipoVisible(o);case'vendedor':return o.vendedor||'-';case'responsable':return responsable(o);case'cliente':return nombreCliente(o.cliente);case'dni':return o.cliente?.dni||'-';case'telefono':return o.cliente?.telefono||'-';case'numero_linea':return o.tipo==='PORTA'?p?.numero_linea||'-':'-';case'compania_actual':return o.tipo==='PORTA'?p?.compania_actual||'-':'-';case'tipo_sim':return o.tipo==='PORTA'?(p?.tipo_sim==='ESIM'?'eSIM':p?.tipo_sim||'-'):'-';case'plan_acordado':return o.tipo==='PORTA'?p?.gigas_acordados||'-':'-';case'plan_cargado':return o.tipo==='PORTA'?g?.plan_cargado||'-':'-';case'estado_vendedor':return o.tipo==='PORTA'?g?.estado_vendedor_nombre||'Sin gestión':'-';case'estado_bboo':return o.tipo==='PORTA'?g?.estado_bboo_nombre||'Sin gestión':'-';case'estado_baf':return o.tipo==='BAF'?b?.estado_nombre||'Sin gestión':'-';case'bboo':return o.tipo==='PORTA'?nombrePerfil(g?.bboo_id):'-';case'fecha_carga_stl':return o.tipo==='PORTA'?g?.fecha_carga_stl||null:null;case'fecha_porta':return o.tipo==='PORTA'&&!p?.es_linea_nueva?g?.fecha_porta||null:null;case'medio_despacho_chip':return o.tipo==='PORTA'&&g?.medio_despacho_chip_id?(medios.get(g.medio_despacho_chip_id) as any)?.nombre||'-':'-';case'numero_seguimiento':return o.tipo==='PORTA'?g?.numero_seguimiento||'-':'-';case'pin':return o.tipo==='PORTA'?g?.pin_lnva_nro||'-':'-';case'sim_operativo':return o.tipo==='PORTA'?g?.sim||'-':'-';case'sds':return o.tipo==='BAF'?b?.sds||'-':g?.sds||'-';case'fecha_instalacion':return o.tipo==='BAF'?b?.fecha_instalacion||null:null;case'orden_trabajo':return o.tipo==='BAF'?b?.orden_trabajo||'-':'-';default:return'-'}}
    const filtradas=completas.filter((o:any)=>{ const t=tipoVisible(o); if(!productos.includes(t))return false; const fv=baseFecha==='fecha_ingreso'?o.fecha_hora:baseFecha==='fecha_carga_stl'?o.gestion_porta?.fecha_carga_stl:o.gestion_porta?.fecha_porta; const d=diaAR(fv); return d && d>=desde && d<=hasta })
    const criterios=columnasVisibles.slice(0,2).map((c:any)=>c.campo); const vacio=(v:any)=>v==null||String(v).trim()===''||String(v).trim()==='-'
    const comparar=(a:any,b:any,c:string)=>{const va=valor(a,c),vb=valor(b,c),ea=vacio(va),ebv=vacio(vb);if(ea&&ebv)return 0;if(ea)return 1;if(ebv)return-1;if(CAMPOS_FECHA.has(c)){const ta=new Date(String(va)).getTime(),tb=new Date(String(vb)).getTime();if(!Number.isNaN(ta)&&!Number.isNaN(tb))return tb-ta}if(CAMPOS_NUMERO.has(c)){const na=Number(va),nb=Number(vb);if(Number.isFinite(na)&&Number.isFinite(nb))return nb-na}return String(va).localeCompare(String(vb),'es',{sensitivity:'base',numeric:true})}
    filtradas.sort((a:any,b:any)=>{for(const c of criterios){const r=comparar(a,b,c);if(r)return r}return new Date(b.fecha_hora||0).getTime()-new Date(a.fecha_hora||0).getTime()})
    const nombreBase=`ventas_${desde}_${hasta}`

    if(formato==='csv'){
      const esc=(v:any)=>{const s=String(v??'');return /[",\n\r;]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
      const filas=[columnas.map((c:any)=>esc(c.etiqueta)).join(';'),...filtradas.map((o:any)=>columnas.map((c:any)=>{const v=valor(o,c.campo);return esc(CAMPOS_FECHA.has(c.campo)?diaAR(v):v??'')}).join(';'))]
      const contenido='\uFEFF'+filas.join('\r\n')
      return new Response(contenido,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${nombreBase}.csv"`}})
    }

    const wb=new ExcelJS.Workbook(); wb.creator='Cotizador Lucom'; const ws=wb.addWorksheet('Ventas',{views:[{state:'frozen',ySplit:1}]})
    ws.columns=columnas.map((c:any)=>({header:c.etiqueta,key:c.campo,width:Math.max(10,Math.min(80,Math.round(c.ancho/7)))}))
    for(const o of filtradas){const fila:any={};for(const c of columnas){const v=valor(o,c.campo);fila[c.campo]=CAMPOS_FECHA.has(c.campo)?fechaExcel(v):v==='-'?'':v}ws.addRow(fila)}
    ws.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,ws.rowCount),column:columnas.length}}
    ws.getRow(1).font={bold:true}; ws.getRow(1).alignment={vertical:'middle'}; ws.getRow(1).height=22
    for(const c of columnas){if(CAMPOS_FECHA.has(c.campo)){const col=ws.getColumn(c.campo);col.numFmt=c.campo==='fecha_ingreso'?'dd/mm/yyyy hh:mm':'dd/mm/yyyy'}}
    const buffer=await wb.xlsx.writeBuffer()
    return new Response(buffer as any,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="${nombreBase}.xlsx"`}})
  } catch(e:any){console.error('exportar ventas',e);return NextResponse.json({error:e?.message||'No se pudo generar la exportación.'},{status:500})}
}
