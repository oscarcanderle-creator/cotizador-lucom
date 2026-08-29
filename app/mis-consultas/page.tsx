import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import AppNav from '../../components/AppNav'

export default async function MisConsultasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('nombre, rol, activo').eq('id', user.id).single()
  if (!profile?.activo) redirect('/login')
  return <main className="min-h-screen bg-gray-50 p-4 sm:p-8"><div className="mx-auto max-w-6xl"><div className="mb-6 rounded-2xl border bg-white p-4"><AppNav rol={profile.rol} actual="MIS_CONSULTAS" variante="claro" /></div><h1 className="text-2xl font-bold text-gray-900">Mis Consultas</h1><p className="mt-2 text-gray-500">Próximo módulo: consultas BBOO y sus respuestas.</p></div></main>
}
