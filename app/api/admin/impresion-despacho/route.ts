import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { createAdminClient } from '../../../../utils/supabase/admin'
import { normalizarConfig } from '../../../../lib/impresionDespacho'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sesión no iniciada.' }, { status: 401 })
    const { data: perfil } = await supabase.from('profiles').select('rol,activo').eq('id', user.id).single()
    if (!perfil?.activo || perfil.rol !== 'ADMIN') return NextResponse.json({ error: 'Acceso restringido a ADMIN.' }, { status: 403 })
    const body = await request.json()
    if (!body || !['guardar', 'publicar'].includes(body.accion)) return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 })
    const admin = createAdminClient()
    const { data: actual, error: lecturaError } = await admin.from('configuracion_impresion_despacho')
      .select('borrador,version_publicada').eq('id', 1).single()
    if (lecturaError || !actual) throw new Error(lecturaError?.message || 'No existe configuración.')
    if (body.accion === 'guardar') {
      const configuracion = normalizarConfig(body.configuracion)
      const { error } = await admin.from('configuracion_impresion_despacho').update({
        borrador: configuracion, borrador_actualizado_por: user.id,
        borrador_actualizado_en: new Date().toISOString(),
      }).eq('id', 1)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, mensaje: 'Borrador guardado.' })
    }
    // La publicación y su historial se escriben juntos en una transacción SQL.
    const { data, error } = await admin.rpc('publicar_impresion_despacho', { p_usuario: user.id })
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, mensaje: 'Configuración publicada.', version: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error inesperado.' }, { status: 500 })
  }
}
