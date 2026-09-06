import { readFile } from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'
import { createClient } from '../../../utils/supabase/server'

const ROLES_PORTAL = [
  'ADMIN',
  'BBOO',
  'SUPERVISOR',
  'TERRENO',
  'VENDEDOR',
]

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(
      new URL('/login', 'http://localhost:3000')
    )
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('rol, activo')
    .eq('id', user.id)
    .single()

  if (
    error ||
    !profile ||
    !profile.activo ||
    !ROLES_PORTAL.includes(profile.rol)
  ) {
    return new NextResponse('Acceso no autorizado', {
      status: 403,
    })
  }

  const filePath = path.join(
    process.cwd(),
    'app',
    'portal',
    'integrado',
    'index.html'
  )

  const html = await readFile(filePath, 'utf8')

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
