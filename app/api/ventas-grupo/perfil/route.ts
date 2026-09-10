import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'

function extraerSigla(valor: unknown) {
  const token = String(valor ?? '').trim().split(/\s+/)[0]?.toUpperCase() || ''
  return /^[A-Z0-9]{2}$/.test(token) ? token : null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ sigla: null }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('vendedor, rol, activo')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.activo) return NextResponse.json({ sigla: null }, { status: 403 })
  return NextResponse.json({ sigla: extraerSigla(profile.vendedor), rol: profile.rol })
}
