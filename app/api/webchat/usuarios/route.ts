import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { createAdminClient } from '../../../../utils/supabase/admin'

export const dynamic = 'force-dynamic'

type Perfil = {
  id: string
  nombre: string | null
  vendedor: string | null
  rol: string
  activo: boolean
  puede_gestionar_ventas: boolean | null
}

function puedeContactarATodos(perfil: Perfil) {
  return (
    perfil.rol === 'ADMIN' ||
    perfil.rol === 'SUPERVISOR' ||
    perfil.rol === 'BBOO' ||
    (perfil.rol === 'VENDEDOR' &&
      perfil.puede_gestionar_ventas === true)
  )
}

function esDestinatarioGeneral(perfil: Perfil) {
  return (
    perfil.rol === 'SUPERVISOR' ||
    perfil.rol === 'BBOO' ||
    (perfil.rol === 'VENDEDOR' &&
      perfil.puede_gestionar_ventas === true)
  )
}

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    const admin = createAdminClient()

    const { data: perfil, error: perfilError } = await admin
      .from('profiles')
      .select('id, nombre, vendedor, rol, activo, puede_gestionar_ventas')
      .eq('id', user.id)
      .single()

    if (perfilError || !perfil || perfil.activo !== true) {
      return NextResponse.json(
        { error: 'Usuario no habilitado' },
        { status: 403 }
      )
    }

    const { data: usuarios, error: usuariosError } = await admin
      .from('profiles')
      .select('id, nombre, vendedor, rol, activo, puede_gestionar_ventas')
      .eq('activo', true)
      .order('nombre', { ascending: true })

    if (usuariosError) {
      throw usuariosError
    }

    const accesoGeneral = puedeContactarATodos(perfil as Perfil)

    const contactos = ((usuarios ?? []) as Perfil[])
      .filter((destinatario) => destinatario.id !== user.id)
      .filter((destinatario) =>
        accesoGeneral || esDestinatarioGeneral(destinatario)
      )
      .map((destinatario) => ({
        id: destinatario.id,
        nombre: destinatario.nombre,
        vendedor: destinatario.vendedor,
        rol: destinatario.rol,
        es_gestor:
          destinatario.rol === 'VENDEDOR' &&
          destinatario.puede_gestionar_ventas === true,
      }))

    return NextResponse.json(
      { usuarios:contactos, usuario_id:user.id },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (error) {
    console.error('Error API Webchat usuarios:', error)

    return NextResponse.json(
      { error: 'No se pudieron obtener los contactos' },
      { status: 500 }
    )
  }
}
