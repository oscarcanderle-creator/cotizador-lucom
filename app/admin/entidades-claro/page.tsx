import { redirect } from 'next/navigation'
import AppHeader from '../../../components/AppHeader'
import { createClient } from '../../../utils/supabase/server'
import { createAdminClient } from '../../../utils/supabase/admin'
import EntidadesClaroClient from './EntidadesClaroClient'

export const dynamic = 'force-dynamic'

export default async function EntidadesClaroPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, rol, activo')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.activo || profile.rol !== 'ADMIN') {
    redirect('/ventas')
  }

  const admin = createAdminClient()

  const { data: entidades, error } = await admin
    .from('entidades_claro')
    .select(`
      id,
      nombre,
      tipo,
      dni,
      activo,
      profile_id,
      punto_venta_id,
      asesor_pdv_id,
      fecha_alta,
      fecha_baja,
      entidades_claro_codigos (
        id,
        tipo_codigo,
        codigo,
        activo,
        vigente_desde,
        vigente_hasta
      )
    `)
    .order('nombre')

  if (error) {
    throw new Error(
      'No se pudo consultar el Maestro de Entidades Claro.'
    )
  }

  const { data: usuarios, error: errorUsuarios } = await admin
    .from('profiles')
    .select('id, nombre, vendedor')

  if (errorUsuarios) {
    throw new Error('No se pudieron consultar los usuarios PGL.')
  }

  const usuariosMap = new Map(
    (usuarios ?? []).map(u => [
      u.id,
      u.vendedor || u.nombre || ''
    ])
  )

  const { data: puntosVenta, error: errorPDV } = await admin
    .from('puntos_venta')
    .select('id, nombre')

  if (errorPDV) {
    throw new Error('No se pudieron consultar los Puntos de Venta.')
  }

  const puntosVentaMap = new Map(
    (puntosVenta ?? []).map(p => [p.id, p.nombre])
  )

  const registros = (entidades ?? []).map(e => ({
    punto_venta_nombre: e.punto_venta_id
      ? puntosVentaMap.get(e.punto_venta_id) ?? ''
      : '',
    ...e,
    usuario_pgl: e.profile_id
      ? usuariosMap.get(e.profile_id) ?? ''
      : ''
  }))

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader
        rol={profile.rol}
        usuario={profile.nombre?.trim() || user.email || 'Administrador'}
        actual="ADMIN"
      />

      <div className="max-w-7xl mx-auto px-4 py-6 sm:p-8">
        <EntidadesClaroClient entidades={registros} />
      </div>
    </main>
  )
}
