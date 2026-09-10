import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { createAdminClient } from '../../../../utils/supabase/admin'

function extraerSigla(valor: unknown) {
  const token = String(valor ?? '').trim().split(/\s+/)[0]?.toUpperCase() || ''
  return /^[A-Z0-9]{2}$/.test(token) ? token : null
}

function filtrosValidos(valor: any) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return false
  const avanzados = Array.isArray(valor.avanzados) ? valor.avanzados : []
  if (avanzados.length > 4) return false
  return avanzados.every((filtro: any) => filtro && typeof filtro === 'object' &&
    typeof filtro.campo === 'string' && typeof filtro.condicion === 'string' &&
    typeof (filtro.valor ?? '') === 'string' && typeof (filtro.valor2 ?? '') === 'string' &&
    ['AND','OR'].includes(String(filtro.conector ?? 'AND')))
}

async function usuarioGrupo() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, autorizado: false }
  const { data: profile } = await supabase.from('profiles').select('vendedor,rol,activo').eq('id',user.id).maybeSingle()
  const sigla = extraerSigla(profile?.vendedor)
  const autorizado = profile?.activo === true && ['VENDEDOR','TERRENO'].includes(String(profile.rol)) && !!sigla && sigla !== 'L1'
  return { user, autorizado }
}

export async function POST(request: Request) {
  const { user, autorizado } = await usuarioGrupo()
  if (!user) return NextResponse.json({error:'No autenticado.'},{status:401})
  if (!autorizado) return NextResponse.json({error:'No tiene permisos para usar Ventas del Grupo.'},{status:403})
  const body = await request.json().catch(()=>null)
  const nombre = String(body?.nombre ?? '').trim()
  const filtros = body?.filtros
  if (!nombre || nombre.length > 60) return NextResponse.json({error:'El nombre debe tener entre 1 y 60 caracteres.'},{status:400})
  if (!filtrosValidos(filtros)) return NextResponse.json({error:'La configuración de filtros no es válida.'},{status:400})
  const tieneFiltro = Boolean(String(filtros.tipo??'').trim() || String(filtros.vendedor??'').trim() || String(filtros.responsable??'').trim() || String(filtros.estado??'').trim() || (Array.isArray(filtros.avanzados)&&filtros.avanzados.length))
  if (!tieneFiltro) return NextResponse.json({error:'Aplicá al menos un filtro antes de guardar la bandeja.'},{status:400})
  const admin=createAdminClient()
  const {data,error}=await admin.from('bandejas_gestion_ventas').insert({usuario_id:user.id,nombre,filtros}).select('id,nombre,filtros').single()
  if(error){ if(error.code==='23505') return NextResponse.json({error:'Ya tenés una bandeja con ese nombre.'},{status:409}); return NextResponse.json({error:`No se pudo guardar la bandeja: ${error.message}`},{status:500}) }
  return NextResponse.json({bandeja:data})
}

export async function DELETE(request: Request) {
  const { user, autorizado } = await usuarioGrupo()
  if (!user) return NextResponse.json({error:'No autenticado.'},{status:401})
  if (!autorizado) return NextResponse.json({error:'No tiene permisos para usar Ventas del Grupo.'},{status:403})
  const body=await request.json().catch(()=>null); const id=String(body?.id??'').trim()
  if(!id) return NextResponse.json({error:'Falta identificar la bandeja.'},{status:400})
  const admin=createAdminClient(); const {error}=await admin.from('bandejas_gestion_ventas').delete().eq('id',id).eq('usuario_id',user.id)
  if(error) return NextResponse.json({error:`No se pudo eliminar la bandeja: ${error.message}`},{status:500})
  return NextResponse.json({ok:true})
}
