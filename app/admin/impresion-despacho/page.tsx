import { redirect } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'
import { createAdminClient } from '../../../utils/supabase/admin'
import AppHeader from '../../../components/AppHeader'
import EditorDespacho from './EditorDespacho'
import { normalizarConfig } from '../../../lib/impresionDespacho'

export default async function AdminImpresionDespacho() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: perfil } = await supabase.from('profiles').select('nombre,rol,activo').eq('id', user.id).single()
  if (!perfil?.activo || perfil.rol !== 'ADMIN') redirect('/ventas')
  const admin = createAdminClient()
  const { data, error } = await admin.from('configuracion_impresion_despacho')
    .select('borrador,publicado,version_publicada,publicado_en').eq('id', 1).single()
  if (error) throw new Error(`Configuración de despacho: ${error.message}. Verificá que ejecutaste el SQL.`)
  return <main className="min-h-screen bg-gray-50">
    <AppHeader rol={perfil.rol} usuario={perfil.nombre?.trim() || user.email || 'Administrador'} actual="ADMIN" />
    <EditorDespacho inicial={normalizarConfig(data.borrador)} publicada={normalizarConfig(data.publicado)} version={data.version_publicada} fechaPublicada={data.publicado_en} />
  </main>
}
