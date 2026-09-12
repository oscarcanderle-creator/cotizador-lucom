import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../utils/supabase/admin'

export const dynamic = 'force-dynamic'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  })
}

export async function GET() {
  try {
    const supabase = createAdminClient()

    const [
      { data: productos, error: errorProductos },
      { data: reglas, error: errorReglas },
      { data: modemsFwa, error: errorModemsFwa },
    ] = await Promise.all([
      supabase
        .from('productos')
        .select(`
          id,
          producto,
          origen,
          plan,
          precio_lista,
          descuento_normal,
          precio_cliente,
          beneficios,
          activo,
          orden
        `)
        .eq('negocio', 'MASIVO')
        .eq('activo', true)
        .order('orden', { ascending: true })
        .order('id', { ascending: true }),

      supabase
        .from('reglas_comerciales')
        .select(`
          codigo,
          nombre,
          tipo,
          valor,
          activo,
          updated_at
        `)
        .eq('negocio', 'MASIVO')
        .eq('activo', true)
        .order('id', { ascending: true }),

      supabase
        .from('catalogo_modems_fwa')
        .select('id,nombre,precio,max_cuotas_factura,activo,orden,updated_at')
        .eq('activo', true)
        .order('orden', { ascending: true })
        .order('id', { ascending: true }),
    ])

    if (errorProductos) {
      console.error(
        'Error obteniendo precios para Portal Lucom:',
        errorProductos
      )

      return NextResponse.json(
        {
          ok: false,
          error: 'No fue posible obtener la lista de precios.',
        },
        {
          status: 500,
          headers: CORS_HEADERS,
        }
      )
    }

    if (errorReglas) {
      console.error(
        'Error obteniendo reglas comerciales para Portal Lucom:',
        errorReglas
      )

      return NextResponse.json(
        {
          ok: false,
          error: 'No fue posible obtener las reglas comerciales.',
        },
        {
          status: 500,
          headers: CORS_HEADERS,
        }
      )
    }

    if (errorModemsFwa) {
      console.error('Error obteniendo Módem FWA para Portal Lucom:', errorModemsFwa)
      return NextResponse.json(
        { ok: false, error: 'No fue posible obtener el precio del Módem FWA.' },
        { status: 500, headers: CORS_HEADERS }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        actualizado: new Date().toISOString(),
        productos: productos ?? [],
        reglas: reglas ?? [],
        modems_fwa: modemsFwa ?? [],
      },
      {
        status: 200,
        headers: CORS_HEADERS,
      }
    )
  } catch (error) {
    console.error(
      'Error inesperado en /api/precios/portal:',
      error
    )

    return NextResponse.json(
      {
        ok: false,
        error: 'Error interno al obtener precios y reglas comerciales.',
      },
      {
        status: 500,
        headers: CORS_HEADERS,
      }
    )
  }
}
