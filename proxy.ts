import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const RUTAS_PUBLICAS = [
  '/login',
  '/recuperar-password',
  '/cambiar-password',
]

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })

          response = NextResponse.next({
            request,
          })

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return response
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, activo, debe_cambiar_password')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.activo) {
    return response
  }

  const pathname = request.nextUrl.pathname

  if (RUTAS_PUBLICAS.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`)
  )) {
    return response
  }

  const esCadeteria = profile.rol === 'CADETERIA'
  const esRutaCadeteria =
    pathname === '/cadeteria' ||
    pathname.startsWith('/cadeteria/')

  if (esCadeteria && !esRutaCadeteria) {
    const url = request.nextUrl.clone()
    url.pathname = '/cadeteria'
    return NextResponse.redirect(url)
  }

  if (!esCadeteria && esRutaCadeteria) {
    const url = request.nextUrl.clone()
    url.pathname = '/ventas'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
