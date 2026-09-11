import { NextRequest, NextResponse } from 'next/server'

import { enviarEmailGmail } from '../../../utils/google/gmail'
import { createAdminClient } from '../../../utils/supabase/admin'
import { createClient } from '../../../utils/supabase/server'

type Novedad = {
  tipo?: unknown
  titulo?: unknown
  texto?: unknown
  title?: unknown
  text?: unknown
}

type Body = {
  novedad?: Novedad
  soloYo?: unknown
  revisar?: unknown
  diagnostico?: unknown
  accion?: unknown
}

function textoSeguro(valor: unknown) {
  return typeof valor === 'string' ? valor.trim() : ''
}

function htmlATexto(valor: string) {
  return valor
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function validarAdmin() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      ),
    }
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('rol, activo, nombre')
    .eq('id', user.id)
    .single()

  if (
    error ||
    !profile ||
    !profile.activo ||
    profile.rol !== 'ADMIN'
  ) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: 'Sin permisos de administrador' },
        { status: 403 }
      ),
    }
  }

  return {
    ok: true as const,
    user,
    profile,
  }
}

async function obtenerEmailsUsuariosActivos() {
  const admin = createAdminClient()

  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id')
    .eq('activo', true)

  if (profilesError) {
    throw new Error(`No se pudieron leer los usuarios activos: ${profilesError.message}`)
  }

  const idsActivos = new Set(
    (profiles ?? []).map((p: { id: string }) => String(p.id))
  )

  const emails = new Set<string>()
  const porPagina = 1000
  let pagina = 1

  while (true) {
    const {
      data,
      error,
    } = await admin.auth.admin.listUsers({
      page: pagina,
      perPage: porPagina,
    })

    if (error) {
      throw new Error(`No se pudieron leer los correos de usuarios: ${error.message}`)
    }

    const usuarios = data?.users ?? []

    for (const usuario of usuarios) {
      if (!idsActivos.has(usuario.id)) continue

      const email = String(usuario.email ?? '')
        .trim()
        .toLowerCase()

      if (email) emails.add(email)
    }

    if (usuarios.length < porPagina) break
    pagina += 1
  }

  return [...emails]
}

async function enviarEnLotes(
  emails: string[],
  asunto: string,
  mensaje: string
) {
  const TAMANO_LOTE = 5
  let enviados = 0
  const fallidos: string[] = []

  for (let i = 0; i < emails.length; i += TAMANO_LOTE) {
    const lote = emails.slice(i, i + TAMANO_LOTE)

    const resultados = await Promise.allSettled(
      lote.map((destinatario) =>
        enviarEmailGmail({
          destinatario,
          asunto,
          mensaje,
        })
      )
    )

    resultados.forEach((resultado, indice) => {
      if (resultado.status === 'fulfilled') {
        enviados += 1
      } else {
        fallidos.push(lote[indice])
        console.error(
          '[NOVEDAD MAIL] Error al enviar a',
          lote[indice],
          resultado.reason
        )
      }
    })
  }

  return {
    enviados,
    fallidos,
  }
}

export async function POST(request: NextRequest) {
  const validacion = await validarAdmin()
  if (!validacion.ok) return validacion.response

  let body: Body

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'JSON inválido' },
      { status: 400 }
    )
  }

  // Compatibilidad con el botón viejo "Revisar configuración".
  // Si el frontend manda revisar/accion sin una novedad, devolvemos el estado
  // de la integración actual en vez de fallar.
  const accion = textoSeguro(body.accion).toLowerCase()
  const soloRevisar =
    body.revisar === true ||
    body.diagnostico === true ||
    accion === 'revisar' ||
    accion === 'config' ||
    accion === 'configuracion'

  console.log('[NOVEDAD MAIL] solicitud', {
    revisar: soloRevisar,
    soloYo: body.soloYo === true,
    tieneNovedad: !!body.novedad,
    usuario: validacion.user.email || '(sin email)',
  })

  if (soloRevisar && !body.novedad) {
    let cantidad = 0

    try {
      cantidad = (await obtenerEmailsUsuariosActivos()).length
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : 'No se pudo revisar la configuración.',
        },
        { status: 500 }
      )
    }

    console.log(`[NOVEDAD MAIL] revisión OK: ${cantidad} usuarios activos con correo`)

    return NextResponse.json({
      ok: true,
      configurado: true,
      diagnostico: {
        estado: 'OK',
        destinatarios: cantidad,
      },
      destinatarios: cantidad,
      aviso: `Configuración OK. ${cantidad} usuario${cantidad === 1 ? '' : 's'} activo${cantidad === 1 ? '' : 's'} con correo.`,
    })
  }

  const novedad = body.novedad ?? {}
  const titulo =
    textoSeguro(novedad.titulo) ||
    textoSeguro(novedad.title) ||
    'Novedad del Portal Lucom'

  const tipo = textoSeguro(novedad.tipo)
  const texto = htmlATexto(
    textoSeguro(novedad.texto) ||
      textoSeguro(novedad.text)
  )

  if (!texto && titulo === 'Novedad del Portal Lucom') {
    return NextResponse.json(
      {
        ok: false,
        enviados: 0,
        aviso: 'La novedad está vacía.',
      },
      { status: 400 }
    )
  }

  const asunto = tipo
    ? `Portal Lucom - ${tipo}: ${titulo}`
    : `Portal Lucom - ${titulo}`

  const mensaje = [
    'NOVEDAD DEL PORTAL LUCOM',
    '',
    titulo,
    texto ? '' : null,
    texto || null,
    '',
    'Ingresá a la Plataforma Lucom para ver la información actualizada.',
  ]
    .filter((linea): linea is string => linea !== null)
    .join('\n')

  const soloYo = body.soloYo === true

  let destinatarios: string[]

  if (soloYo) {
    const email = String(validacion.user.email ?? '')
      .trim()
      .toLowerCase()

    if (!email) {
      return NextResponse.json(
        {
          ok: false,
          enviados: 0,
          aviso: 'Tu usuario no tiene una dirección de correo asociada.',
        },
        { status: 400 }
      )
    }

    destinatarios = [email]
    console.log('[NOVEDAD MAIL] PRUEBA: envío solo al ADMIN conectado:', email)
  } else {
    try {
      destinatarios = await obtenerEmailsUsuariosActivos()
      console.log(`[NOVEDAD MAIL] MASIVO: ${destinatarios.length} destinatarios activos`)
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          enviados: 0,
          aviso:
            error instanceof Error
              ? error.message
              : 'No se pudieron obtener los destinatarios.',
        },
        { status: 500 }
      )
    }
  }

  if (destinatarios.length === 0) {
    return NextResponse.json({
      ok: true,
      enviados: 0,
      fallidos: 0,
      aviso: 'No hay usuarios activos con correo para notificar.',
    })
  }

  console.log('[NOVEDAD MAIL] enviando', {
    modo: soloYo ? 'PRUEBA' : 'MASIVO',
    destinatarios: destinatarios.length,
    asunto,
  })

  const resultado = await enviarEnLotes(
    destinatarios,
    asunto,
    mensaje
  )

  const fallidos = resultado.fallidos.length

  console.log('[NOVEDAD MAIL] resultado', {
    modo: soloYo ? 'PRUEBA' : 'MASIVO',
    enviados: resultado.enviados,
    fallidos,
  })

  return NextResponse.json({
    ok: fallidos === 0,
    enviados: resultado.enviados,
    fallidos,
    total: destinatarios.length,
    destino: soloYo ? destinatarios[0] : undefined,
    aviso: soloYo
      ? resultado.enviados === 1
        ? 'Prueba enviada correctamente a tu correo.'
        : 'No se pudo enviar la prueba.'
      : fallidos === 0
        ? `Novedad enviada por correo a ${resultado.enviados} usuario${resultado.enviados === 1 ? '' : 's'}.`
        : `Se enviaron ${resultado.enviados} correos y fallaron ${fallidos}.`,
  })
}
