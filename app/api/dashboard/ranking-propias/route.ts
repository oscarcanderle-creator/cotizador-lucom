import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { createAdminClient } from '../../../../utils/supabase/admin'

const LOTE = 500
function siglaVendedor(valor: unknown): string | null {
  const token = String(valor ?? '').trim().split(/\s+/)[0]?.toUpperCase() || ''
  return /^[A-Z0-9]{2}$/.test(token) ? token : null
}
function fechaArgentina(valor: string | null): string | null {
  if (!valor) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.valueOf())) return null
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(fecha)
  const tomar = (tipo: string) => partes.find(p => p.type === tipo)?.value ?? ''
  return `${tomar('year')}-${tomar('month')}-${tomar('day')}`
}
function fechaValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const fecha = new Date(`${valor}T12:00:00Z`)
  return !Number.isNaN(fecha.valueOf()) && fecha.toISOString().slice(0, 10) === valor
}
function esFwa(plan: string | null): boolean {
  return /\bFWA\b/i.test(String(plan ?? ''))
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    const { data: perfil } = await supabase.from('profiles').select('rol,activo').eq('id', user.id).maybeSingle()
    if (!perfil?.activo || !['ADMIN','SUPERVISOR'].includes(perfil.rol)) return NextResponse.json({ error: 'Sin permisos.' }, { status: 403 })
    const { searchParams } = new URL(request.url)
    const desde = searchParams.get('desde') ?? ''
    const hasta = searchParams.get('hasta') ?? ''
    const grupo = searchParams.get('grupo') ?? ''
    const vendedor = searchParams.get('vendedor') ?? ''
    if (!fechaValida(desde) || !fechaValida(hasta) || desde > hasta) return NextResponse.json({ error: 'Período inválido.' }, { status: 400 })
    const admin = createAdminClient()
    const operaciones = new Map<string,string>()
    const conteos = new Map<string,{ vendedor:string; porta:number; ln:number; baf:number }>()
    if (grupo && grupo !== 'L1') return NextResponse.json({ desde,hasta,filas:[] })
    for (let offset=0;;offset+=LOTE) {
      const {data,error}=await admin.from('operaciones').select('id_operacion,vendedor').ilike('vendedor','L1 %').order('id_operacion').range(offset,offset+LOTE-1)
      if(error) throw error
      for(const o of data??[]) {
        const nombre=String(o.vendedor??'').trim()
        if(siglaVendedor(nombre)==='L1' && (!vendedor || vendedor===nombre)) operaciones.set(o.id_operacion,nombre)
      }
      if(!data || data.length<LOTE) break
    }
    const {data:estados,error:errorEstados}=await admin.from('estados_bboo').select('id,nombre')
    if(errorEstados) throw errorEstados
    const nombres=new Map((estados??[]).map(e=>[String(e.id),String(e.nombre??'').trim().toUpperCase()]))
    const ids=[...operaciones.keys()]
    for(let pos=0;pos<ids.length;pos+=100) {
      for(let offset=0;;offset+=LOTE) {
        const {data:productos,error}=await admin.from('operacion_productos').select('id,operacion_id,tipo_producto,plan_snapshot').in('operacion_id',ids.slice(pos,pos+100)).in('tipo_producto',['PORTA','LINEA_NUEVA']).eq('activo',true).order('id').range(offset,offset+LOTE-1)
        if(error) throw error
        if(!productos?.length) break
        const pids=productos.map(p=>p.id)
        const [g,d]=await Promise.all([
          admin.from('gestion_producto_movil').select('producto_operacion_id,estado_bboo_id,fecha_porta,fecha_carga_stl,plan_cargado').in('producto_operacion_id',pids),
          admin.from('operacion_producto_movil').select('producto_operacion_id,es_fwa').in('producto_operacion_id',pids)
        ])
        if(g.error) throw g.error
        if(d.error) throw d.error
        const gestiones=new Map((g.data??[]).map(x=>[String(x.producto_operacion_id),x]))
        const detalles=new Map((d.data??[]).map(x=>[String(x.producto_operacion_id),x]))
        for(const p of productos) {
          const gestion=gestiones.get(String(p.id))
          const nombre=operaciones.get(p.operacion_id)
          if(!gestion || !nombre) continue
          if(detalles.get(String(p.id))?.es_fwa===true || esFwa(p.plan_snapshot) || esFwa(gestion.plan_cargado)) continue
          const estado=nombres.get(String(gestion.estado_bboo_id))??''
          const porta=p.tipo_producto==='PORTA'
          if(porta ? estado!=='ACTIVA NRO PORTADO' : !estado.includes('LINEA NUEVA ACTIVA')) continue
          const fecha=fechaArgentina(porta?gestion.fecha_porta:gestion.fecha_carga_stl)
          if(!fecha || fecha<desde || fecha>hasta) continue
          const fila=conteos.get(nombre)??{vendedor:nombre,porta:0,ln:0,baf:0}
          if(porta) fila.porta++
          else fila.ln++
          conteos.set(nombre,fila)
        }
        if(productos.length<LOTE) break
      }
    }
    const {data:estadosBaf,error:errorBaf}=await admin.from('estados_baf').select('id,codigo')
    if(errorBaf) throw errorBaf
    const codigosBaf=new Map((estadosBaf??[]).map(e=>[String(e.id),String(e.codigo??'').trim().toUpperCase()]))
    for(let pos=0;pos<ids.length;pos+=100) {
      for(let offset=0;;offset+=LOTE) {
        const {data:productos,error}=await admin.from('operacion_productos').select('id,operacion_id').in('operacion_id',ids.slice(pos,pos+100)).eq('tipo_producto','BAF').eq('activo',true).order('id').range(offset,offset+LOTE-1)
        if(error) throw error
        if(!productos?.length) break
        const {data:gestiones,error:errorGestion}=await admin.from('gestion_producto_baf').select('producto_operacion_id,sds,fecha_gestion,estado_baf_id').in('producto_operacion_id',productos.map(p=>p.id))
        if(errorGestion) throw errorGestion
        const porProducto=new Map((gestiones??[]).map(g=>[String(g.producto_operacion_id),g]))
        for(const p of productos) {
          const g=porProducto.get(String(p.id))
          const nombre=operaciones.get(p.operacion_id)
          if(!g || !nombre || !g.sds?.trim() || codigosBaf.get(String(g.estado_baf_id))!=='CARGADO') continue
          const fecha=fechaArgentina(g.fecha_gestion)
          if(!fecha || fecha<desde || fecha>hasta) continue
          const fila=conteos.get(nombre)??{vendedor:nombre,porta:0,ln:0,baf:0}
          fila.baf++
          conteos.set(nombre,fila)
        }
        if(productos.length<LOTE) break
      }
    }
    return NextResponse.json({desde,hasta,filas:[...conteos.values()]})
  } catch(error) {
    console.error('Ranking propias Call',error)
    return NextResponse.json({error:'No se pudo consultar el ranking de ventas propias.'},{status:500})
  }
}
