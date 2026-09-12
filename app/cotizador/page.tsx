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

    .select('nombre, rol, activo, puede_gestionar_ventas')

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

      'id, negocio, producto, origen, plan, catalogo_plan_id, precio_lista, descuento_normal, precio_cliente, beneficios'

    )

    .eq('activo', true)

    .order('fila_origen')

  if (errorProductos) {

    throw new Error(

      errorProductos.message

    )

  }

  /*
   * PRECIOS MAESTROS DE PLANES MÓVILES
   *
   * Para PORTABILIDAD / LÍNEA NUEVA el precio de lista
   * se obtiene del catálogo maestro por catalogo_plan_id.
   * El precio redundante de productos queda solo como
   * compatibilidad transitoria.
   */

  const {
    data: catalogoPlanesPorta,
    error: errorCatalogoPlanesPorta,
  } = await supabase
    .from('catalogo_planes_porta')
    .select('id, precio_lista')
    .eq('activo', true)

  if (errorCatalogoPlanesPorta) {
    throw new Error(
      errorCatalogoPlanesPorta.message
    )
  }

  const preciosMovilesMaestros =
    new Map<number, number>(
      (catalogoPlanesPorta ?? []).map(
        (plan) => [
          Number(plan.id),
          Number(plan.precio_lista ?? 0),
        ]
      )
    )

  const productosCotizador =
    (productos ?? []).map((producto) => {
      if (
        (producto.producto === 'PORTABILIDAD' ||
          producto.producto === 'LINEA NUEVA') &&
        producto.catalogo_plan_id !== null &&
        producto.catalogo_plan_id !== undefined
      ) {
        const precioMaestro =
          preciosMovilesMaestros.get(
            Number(producto.catalogo_plan_id)
          )

        if (precioMaestro !== undefined) {
          return {
            ...producto,
            precio_lista: precioMaestro,
          }
        }
      }

      return producto
    })

  const { data: modemsFwa, error: errorModemsFwa } = await supabase
    .from('catalogo_modems_fwa')
    .select('id,nombre,precio,max_cuotas_factura')
    .eq('activo', true)
    .order('orden', { ascending: true })
    .order('id', { ascending: true })
    .limit(1)

  if (errorModemsFwa) {
    throw new Error(errorModemsFwa.message)
  }

  const modemFwa = modemsFwa?.[0] ?? null

  /*

   * REGLAS COMERCIALES

   */

  const {

    data: reglas,

    error: errorReglas,

  } = await supabase

    .from('reglas_comerciales')

    .select('negocio, codigo, valor')

    .eq('activo', true)

  if (errorReglas) {

    throw new Error(

      errorReglas.message

    )

  }

  const reglasPorNegocio: Record<
    'MASIVO' | 'PYME',
    Record<string, number>
  > = {
    MASIVO: {},
    PYME: {},
  }

  for (const regla of reglas ?? []) {
    const negocioRegla =
      regla.negocio === 'PYME'
        ? 'PYME'
        : 'MASIVO'

    reglasPorNegocio[negocioRegla][regla.codigo] =
      Number(regla.valor)
  }

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

    .eq('negocio', 'MASIVO')

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

      productos={productosCotizador}

      reglas={reglasPorNegocio}

      promocionesFlash={

        promocionesFlash ?? []

      }

      novedades={novedades ?? []}

      usuario={vendedor}

      rol={profile.rol}

      puedeGestionarVentas={profile.puede_gestionar_ventas === true}

      modemFwa={modemFwa ? {
        id: Number(modemFwa.id),
        nombre: String(modemFwa.nombre),
        precio: Number(modemFwa.precio ?? 0),
        maxCuotasFactura: Number(modemFwa.max_cuotas_factura ?? 24),
      } : null}

    />

  )

}