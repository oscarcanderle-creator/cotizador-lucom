import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { createAdminClient } from '../../../../utils/supabase/admin'
import { CAMPOS_VENTAS } from '../../../../lib/reportmaker/catalogo'
import { validarFiltros } from '../../../../lib/reportmaker/filtros'

const NEGOCIOS = new Set(['INTERNET', 'PORTABILIDAD', 'LINEA_NUEVA'])
const CAMPOS = new Set(CAMPOS_VENTAS.map(c => c.id))

async function autorizar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, autorizado: false }
  const { data: perfil } = await supabase.from('profiles')
    .select('rol,activo,vendedor').eq('id', user.id).maybeSingle()
  const rol = String(perfil?.rol ?? '').toUpperCase()
  const sigla = String(perfil?.vendedor ?? '').trim().split(/\s+/)[0]?.toUpperCase() || ''
  const autorizado = perfil?.activo === true && (
    ['ADMIN', 'SUPER', 'SUPERVISOR', 'BBOO'].includes(rol) ||
    (['VENDEDOR', 'TERRENO'].includes(rol) && /^[A-Z0-9]{2}$/.test(sigla))
  )
  return { user, autorizado }
}

function validarConfiguracion(valor: unknown) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error('Configuración inválida.')
  const c = valor as Record<string, unknown>
  if (!Array.isArray(c.negocios) || c.negocios.length === 0 ||
      c.negocios.some(n => typeof n !== 'string' || !NEGOCIOS.has(n))) throw new Error('Negocios inválidos.')
  if (!Array.isArray(c.columnas) || c.columnas.length > CAMPOS.size ||
      c.columnas.some(v => typeof v !== 'string' || !CAMPOS.has(v))) throw new Error('Columnas inválidas.')
  if (typeof c.todosCampos !== 'boolean') throw new Error('Selección de columnas inválida.')
  if (!c.todosCampos && !c.columnas.length) throw new Error('Seleccioná al menos una columna.')
  const fechaValida = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !Number.isNaN(new Date(`${v}T12:00:00Z`).getTime()) && new Date(`${v}T12:00:00Z`).toISOString().slice(0,10) === v
  if (!fechaValida(c.desde) || !fechaValida(c.hasta) || String(c.desde) > String(c.hasta)) throw new Error('Período inválido.')
  validarFiltros(c.filtros)
  return { negocios: c.negocios, columnas: c.columnas, todosCampos: c.todosCampos,
    desde: c.desde, hasta: c.hasta, filtros: c.filtros }
}

export async function GET() {
  const { user, autorizado } = await autorizar()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  if (!autorizado) return NextResponse.json({ error: 'Sin permisos.' }, { status: 403 })
  const { data, error } = await createAdminClient().from('bandejas_reportmaker')
    .select('id,nombre,configuracion').eq('usuario_id', user.id).order('nombre')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bandejas: data ?? [] })
}

export async function POST(request: Request) {
  const { user, autorizado } = await autorizar()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  if (!autorizado) return NextResponse.json({ error: 'Sin permisos.' }, { status: 403 })
  const body = await request.json().catch(() => null)
  const nombre = String(body?.nombre ?? '').trim()
  if (!nombre || nombre.length > 60) return NextResponse.json({ error: 'Nombre de 1 a 60 caracteres.' }, { status: 400 })
  let configuracion
  try { configuracion = validarConfiguracion(body?.configuracion) }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Configuración inválida.' }, { status: 400 }) }
  const { data, error } = await createAdminClient().from('bandejas_reportmaker')
    .insert({ usuario_id: user.id, nombre, configuracion })
    .select('id,nombre,configuracion').single()
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'Ya tenés una bandeja con ese nombre.' : error.message }, { status: error.code === '23505' ? 409 : 500 })
  return NextResponse.json({ bandeja: data })
}

export async function DELETE(request: Request) {
  const { user, autorizado } = await autorizar()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  if (!autorizado) return NextResponse.json({ error: 'Sin permisos.' }, { status: 403 })
  const body = await request.json().catch(() => null)
  const id = String(body?.id ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })
  const { error } = await createAdminClient().from('bandejas_reportmaker')
    .delete().eq('id', id).eq('usuario_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
