import { redirect } from 'next/navigation'

import { createClient } from '../../utils/supabase/server'

import Cotizador from './Cotizador'

export default async function CotizadorPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  /*
   * PERFIL DEL USUARIO
   */
  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, rol, activo')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.activo) {
    redirect('/login')
  }

  /*
   * PRODUCTOS
   */
  const {
    data: productos,
    error: errorProductos,
  } = await supabase
    .from('productos')
    .select(
      'id, producto, origen, plan, precio_lista, descuento_normal, precio_cliente, beneficios'
    )
    .eq('activo', true)
    .order('fila_origen')

  if (errorProductos) {
    throw new Error(
      errorProductos.message
    )
  }

  /*
   * REGLAS COMERCIALES
   */
  const {
    data: reglas,
    error: errorReglas,
  } = await supabase
    .from('reglas_comerciales')
    .select('codigo, valor')
    .eq('activo', true)

  if (errorReglas) {
    throw new Error(
      errorReglas.message
    )
  }

  const reglasMap =
    Object.fromEntries(
      (reglas ?? []).map(
        (regla) => [
          regla.codigo,
          Number(regla.valor),
        ]
      )
    )

  /*
   * PROMOCIONES FLASH
   */
  const {
    data: promocionesFlash,
    error: errorFlash,
  } = await supabase
    .from('promociones_flash')
    .select(
      'id, nombre, origen, porcentaje, fecha_desde, fecha_hasta, activo'
    )
    .eq('activo', true)
    .order('fecha_desde', {
      ascending: false,
    })

  if (errorFlash) {
    throw new Error(
      errorFlash.message
    )
  }

  /*
   * NOVEDADES / BENEFICIOS
   *
   * Solo traemos las que están activas
   * y respetamos el orden definido
   * desde ADMIN.
   */
  const {
    data: novedades,
    error: errorNovedades,
  } = await supabase
    .from('novedades_propuesta')
    .select(
      'id, titulo, contenido, activo, orden'
    )
    .eq('activo', true)
    .order('orden')

  if (errorNovedades) {
    throw new Error(
      errorNovedades.message
    )
  }

  /*
   * VENDEDOR
   */
  const vendedor =
    profile.nombre?.trim() ||
    user.email ||
    'Vendedor'

  return (
    <Cotizador
      productos={productos ?? []}
      reglas={reglasMap}
      promocionesFlash={
        promocionesFlash ?? []
      }
      novedades={novedades ?? []}
      usuario={vendedor}
    />
  )
}
