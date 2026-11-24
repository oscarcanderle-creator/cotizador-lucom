import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { createAdminClient } from '../../../../utils/supabase/admin'

const INDICADORES = [
  'BAF_INGRESADAS',
  'BAF_CARGADAS',
  'BAF_FINALIZADAS',
  'BAF_CANCELADAS',
  'PORTA_INGRESADAS',
  'PORTA_ACTIVAS',
  'LN_INGRESADAS',
  'LN_ACTIVAS',
  'FWA_INGRESADAS',
  'FWA_ACTIVAS',
] as const

const ALCANCE = 'CANAL'
const REFERENCIA = 'CALL LUCOM'

function mesValido(mes: unknown): mes is string {
  return typeof mes === 'string' &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(mes)
}

async function autorizar() {
  const supabase = await createClient()

  const { data: { user }, error } =
    await supabase.auth.getUser()

  if (error || !user) {
    return { user: null, status: 401 }
  }

  const { data: perfil } = await supabase
    .from('profiles')
    .select('rol,activo')
    .eq('id', user.id)
    .maybeSingle()

  if (
    !perfil?.activo ||
    !['ADMIN', 'SUPERVISOR'].includes(perfil.rol)
  ) {
    return { user: null, status: 403 }
  }

  return { user, status: 200 }
}

async function consultarObjetivos(mes: string) {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('dashboard_objetivos')
    .select('indicador,objetivo,actualizado_en')
    .eq('mes', mes + '-01')
    .eq('alcance', ALCANCE)
    .eq('referencia', REFERENCIA)

  if (error) throw error

  const objetivos: Record<string, number | null> =
    Object.fromEntries(
      INDICADORES.map(indicador => [indicador, null])
    )

  for (const fila of data ?? []) {
    if (INDICADORES.some(i => i === fila.indicador)) {
      objetivos[fila.indicador] = fila.objetivo
    }
  }

  const sumar = (a: string, b: string) => {
    const primero = objetivos[a]
    const segundo = objetivos[b]

    return primero !== null && segundo !== null
      ? primero + segundo
      : null
  }

  objetivos.TOTAL_MOVIL_INGRESADAS = sumar(
    'PORTA_INGRESADAS', 'LN_INGRESADAS'
  )

  objetivos.TOTAL_MOVIL_ACTIVAS = sumar(
    'PORTA_ACTIVAS', 'LN_ACTIVAS'
  )

  return {
    mes,
    alcance: ALCANCE,
    referencia: REFERENCIA,
    objetivos,
  }
}

export async function GET(request: Request) {
  try {
    const auth = await autorizar()

    if (!auth.user) {
      return NextResponse.json(
        { error: 'Acceso no autorizado.' },
        { status: auth.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes')

    if (!mesValido(mes)) {
      return NextResponse.json(
        { error: 'Mes inválido.' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      await consultarObjetivos(mes)
    )

  } catch (error) {
    console.error('Consulta objetivos Dashboard', error)

    return NextResponse.json(
      { error: 'No se pudieron consultar los objetivos.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await autorizar()

    if (!auth.user) {
      return NextResponse.json(
        { error: 'Acceso no autorizado.' },
        { status: auth.status }
      )
    }

    const usuario = auth.user.id
    const body = await request.json()
    const mes = body?.mes
    const objetivos = body?.objetivos

    if (
      !mesValido(mes) ||
      !objetivos ||
      typeof objetivos !== 'object' ||
      Array.isArray(objetivos)
    ) {
      return NextResponse.json(
        { error: 'Datos inválidos.' },
        { status: 400 }
      )
    }

    const entradas = Object.entries(objetivos)

    if (
      entradas.some(([indicador, valor]) =>
        !INDICADORES.some(i => i === indicador) ||
        typeof valor !== 'number' ||
        !Number.isSafeInteger(valor) ||
        valor < 0 ||
        valor > 2147483647
      )
    ) {
      return NextResponse.json(
        { error: 'Uno o más objetivos son inválidos.' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    const { data: existentes, error: errorConsulta } =
      await admin
        .from('dashboard_objetivos')
        .select('indicador,objetivo,creado_por')
        .eq('mes', mes + '-01')
        .eq('alcance', ALCANCE)
        .eq('referencia', REFERENCIA)

    if (errorConsulta) throw errorConsulta

    const anteriores = new Map(
      (existentes ?? []).map(fila =>
        [fila.indicador, fila]
      )
    )

    const filas = entradas
      .filter(([indicador, valor]) =>
        anteriores.get(indicador)?.objetivo !== valor
      )
      .map(([indicador, valor]) => ({
        mes: mes + '-01',
        alcance: ALCANCE,
        referencia: REFERENCIA,
        indicador,
        objetivo: valor as number,
        creado_por:
          anteriores.get(indicador)?.creado_por ?? usuario,
        actualizado_por: usuario,
        actualizado_en: new Date().toISOString(),
      }))

    if (filas.length) {
      const { error } = await admin
        .from('dashboard_objetivos')
        .upsert(filas, {
          onConflict: 'mes,alcance,referencia,indicador',
        })

      if (error) throw error
    }

    return NextResponse.json(
      await consultarObjetivos(mes)
    )

  } catch (error) {
    console.error('Guardar objetivos Dashboard', error)

    return NextResponse.json(
      { error: 'No se pudieron guardar los objetivos.' },
      { status: 500 }
    )
  }
}
