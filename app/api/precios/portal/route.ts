import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
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
      .eq('activo', true)
      .order('orden', { ascending: true })
      .order('id', { ascending: true })

    if (error) {
      console.error('Error obteniendo precios para Portal Lucom:', error)

      return NextResponse.json(
        {
          ok: false,
          error: 'No fue posible obtener la lista de precios.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        actualizado: new Date().toISOString(),
        productos: data ?? [],
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (error) {
    console.error('Error inesperado en /api/precios/portal:', error)

    return NextResponse.json(
      {
        ok: false,
        error: 'Error interno al obtener la lista de precios.',
      },
      { status: 500 }
    )
  }
}
