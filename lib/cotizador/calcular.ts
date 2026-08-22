export type TipoLinea =
  | 'LINEA NUEVA'
  | 'PERSONAL'
  | 'MOVISTAR'
  | 'TUENTI'

export type PromocionFlash = {
  id: number
  nombre: string
  origen: string
  porcentaje: number
  fecha_desde: string
  fecha_hasta: string
  activo: boolean
}

export type LineaEntrada = {
  id: number
  tipo: TipoLinea
  plan: string
  cantidad: number

  precioLista: number
  descuentoNormal: number
  beneficiosNormal: string | null
}

export type EntradaCotizacion = {
  lineas: LineaEntrada[]

  contrataBAF: boolean
  precioBAF: number

  clienteTieneBAF: boolean
  clienteTieneLineasClaro: boolean
  cantidadLineasActuales: number

  descuentoConexionFull: number

  convergencia2: number
  convergencia3: number

  /*
   * TV
   */
  contrataTV: boolean
  precioTV: number

  cantidadDecosAdicionales: number
  precioDecoAdicional: number

  /*
   * CLARO PAY
   */
  pagaClaroPay: boolean
  porcentajeClaroPay: number
  topeClaroPay: number

  promocionesFlash: PromocionFlash[]
}

export type LineaResultado = {
  id: number
  tipo: TipoLinea
  plan: string
  cantidad: number

  precioLista: number
  descuentoAplicado: number

  precioUnitario: number
  subtotal: number

  tipoDescuento:
    | 'CONEXION_FULL'
    | 'FLASH'
    | 'NORMAL'

  nombreFlash: string | null

  beneficioConexionFull: boolean

  beneficiosNormal: string | null
}

export type ResultadoCotizacion = {
  lineas: LineaResultado[]

  hayConexionFull: boolean
  hayConvergencia: boolean

  subtotalMoviles: number
  subtotalBAF: number

  /*
   * TV
   */
  subtotalTV: number
  cantidadDecosIncluidos: number
  cantidadDecosAdicionales: number
  subtotalDecosAdicionales: number
  cantidadDecosTotal: number

  subtotalAntesConvergencia: number

  descuentoConvergencia: number

  totalDespuesConvergencia: number

  descuentoClaroPay: number

  total: number
}

export function calcularCotizacion(
  entrada: EntradaCotizacion
): ResultadoCotizacion {
  const {
    lineas,

    contrataBAF,
    precioBAF,

    clienteTieneBAF,
    clienteTieneLineasClaro,
    cantidadLineasActuales,

    descuentoConexionFull,

    convergencia2,
    convergencia3,

    contrataTV,
    precioTV,

    cantidadDecosAdicionales,
    precioDecoAdicional,

    pagaClaroPay,
    porcentajeClaroPay,
    topeClaroPay,

    promocionesFlash,
  } = entrada

  const ahora = new Date()

  /*
   * =====================================================
   * LÍNEAS MÓVILES NUEVAS
   * =====================================================
   */

  const cantidadMovilesNuevas =
    lineas.reduce(
      (total, linea) =>
        total + linea.cantidad,
      0
    )

  const hayLineasNuevas =
    cantidadMovilesNuevas > 0

  /*
   * =====================================================
   * CONEXIÓN FULL / COMBO
   * =====================================================
   *
   * CASO 1
   *
   * Cliente que NO tiene productos Claro:
   *
   * Internet nuevo
   * +
   * Portabilidad y/o Línea Nueva
   *
   *
   * CASO 2
   *
   * Cliente que YA tiene Internet Claro:
   *
   * Portabilidad y/o Línea Nueva
   *
   *
   * BENEFICIO:
   *
   * 80% sobre las nuevas líneas
   * +
   * 10 GB x 12 meses
   *
   *
   * IMPORTANTE:
   *
   * Cliente que ya tiene línea Claro
   * y agrega Internet:
   *
   * tiene Convergencia
   * pero NO Conexión Full sobre
   * la línea que ya poseía.
   */

  const clienteNoClaro =
    !clienteTieneBAF &&
    !clienteTieneLineasClaro

  const conexionFullClienteNuevo =
    clienteNoClaro &&
    contrataBAF &&
    hayLineasNuevas

  const conexionFullClienteConBAF =
    clienteTieneBAF &&
    hayLineasNuevas

  const hayConexionFull =
    conexionFullClienteNuevo ||
    conexionFullClienteConBAF

  /*
   * =====================================================
   * CALCULAR CADA LÍNEA
   * =====================================================
   */

  const lineasResultado: LineaResultado[] =
    lineas.map((linea) => {
      let descuentoAplicado =
        linea.descuentoNormal

      let tipoDescuento:
        | 'CONEXION_FULL'
        | 'FLASH'
        | 'NORMAL' = 'NORMAL'

      let nombreFlash: string | null =
        null

      /*
       * PRIORIDAD:
       *
       * CONEXIÓN FULL
       * >
       * FLASH
       * >
       * NORMAL
       */

      if (hayConexionFull) {
        descuentoAplicado =
          descuentoConexionFull

        tipoDescuento =
          'CONEXION_FULL'
      } else {
        const flashVigente =
          promocionesFlash.find(
            (promo) => {
              if (!promo.activo) {
                return false
              }

              if (
                promo.origen !==
                linea.tipo
              ) {
                return false
              }

              const desde =
                new Date(
                  promo.fecha_desde
                )

              const hasta =
                new Date(
                  promo.fecha_hasta
                )

              return (
                ahora >= desde &&
                ahora <= hasta
              )
            }
          )

        if (flashVigente) {
          descuentoAplicado =
            Number(
              flashVigente.porcentaje
            )

          tipoDescuento =
            'FLASH'

          nombreFlash =
            flashVigente.nombre
        }
      }

      const precioUnitario =
        linea.precioLista *
        (1 -
          descuentoAplicado / 100)

      const subtotal =
        precioUnitario *
        linea.cantidad

      return {
        id: linea.id,
        tipo: linea.tipo,
        plan: linea.plan,
        cantidad: linea.cantidad,

        precioLista:
          linea.precioLista,

        descuentoAplicado,

        precioUnitario,
        subtotal,

        tipoDescuento,

        nombreFlash,

        beneficioConexionFull:
          tipoDescuento ===
          'CONEXION_FULL',

        beneficiosNormal:
          linea.beneficiosNormal,
      }
    })

  /*
   * =====================================================
   * SUBTOTAL MÓVILES
   * =====================================================
   */

  const subtotalMoviles =
    lineasResultado.reduce(
      (total, linea) =>
        total + linea.subtotal,
      0
    )

  /*
   * =====================================================
   * INTERNET / BAF
   * =====================================================
   */

  const subtotalBAF =
    contrataBAF
      ? precioBAF
      : 0

  /*
   * =====================================================
   * CLARO TV
   * =====================================================
   *
   * TV puede contratarse solamente si:
   *
   * - el cliente ya tiene BAF
   *   o
   * - está contratando BAF.
   *
   * La interfaz también impedirá
   * seleccionar una combinación inválida.
   */

  const puedeContratarTV =
    clienteTieneBAF ||
    contrataBAF

  const tvValido =
    contrataTV &&
    puedeContratarTV

  const subtotalTV =
    tvValido
      ? precioTV
      : 0

  /*
   * CLARO TV incluye siempre
   * UN DECODIFICADOR SIN CARGO.
   */

  const cantidadDecosIncluidos =
    tvValido
      ? 1
      : 0

  /*
   * Máximo:
   *
   * 1 deco incluido
   * +
   * 2 adicionales
   *
   * = 3 decos.
   *
   * Aunque la interfaz también
   * limite el selector, el motor
   * vuelve a validar el máximo.
   */

  const decosAdicionalesValidos =
    tvValido
      ? Math.min(
          2,
          Math.max(
            0,
            cantidadDecosAdicionales
          )
        )
      : 0

  const subtotalDecosAdicionales =
    decosAdicionalesValidos *
    precioDecoAdicional

  const cantidadDecosTotal =
    cantidadDecosIncluidos +
    decosAdicionalesValidos

  /*
   * =====================================================
   * SUBTOTAL GENERAL
   * =====================================================
   */

  const subtotalAntesConvergencia =
    subtotalMoviles +
    subtotalBAF +
    subtotalTV +
    subtotalDecosAdicionales

  /*
   * =====================================================
   * CONVERGENCIA
   * =====================================================
   *
   * La Convergencia se determina por
   * coexistencia de servicios:
   *
   * INTERNET / BAF
   * +
   * LÍNEAS MÓVILES
   *
   * TV NO crea por sí mismo
   * una condición de Convergencia.
   */

  const movilesExistentes =
    clienteTieneLineasClaro
      ? Math.max(
          1,
          cantidadLineasActuales
        )
      : 0

  const totalMoviles =
    movilesExistentes +
    cantidadMovilesNuevas

  let totalBAF = 0

  if (clienteTieneBAF) {
    totalBAF += 1
  }

  if (contrataBAF) {
    totalBAF += 1
  }

  const hayConvergencia =
    totalMoviles > 0 &&
    totalBAF > 0

  const cantidadServicios =
    totalMoviles +
    totalBAF

  let descuentoConvergencia = 0

  if (hayConvergencia) {
    descuentoConvergencia =
      cantidadServicios >= 3
        ? convergencia3
        : convergencia2
  }

  /*
   * Convergencia se descuenta
   * una sola vez sobre el total.
   */

  const totalDespuesConvergencia =
    Math.max(
      0,
      subtotalAntesConvergencia -
        descuentoConvergencia
    )

  /*
   * =====================================================
   * CLARO PAY
   * =====================================================
   *
   * Se aplica después de Convergencia.
   *
   * TV y decos forman parte
   * del total sobre el cual
   * se calcula Claro Pay.
   */

  const calculoClaroPay =
    totalDespuesConvergencia *
    (porcentajeClaroPay / 100)

  const descuentoClaroPay =
    pagaClaroPay
      ? Math.min(
          calculoClaroPay,
          topeClaroPay
        )
      : 0

  /*
   * =====================================================
   * TOTAL FINAL
   * =====================================================
   */

  const total =
    Math.max(
      0,
      totalDespuesConvergencia -
        descuentoClaroPay
    )

  return {
    lineas:
      lineasResultado,

    hayConexionFull,
    hayConvergencia,

    subtotalMoviles,
    subtotalBAF,

    subtotalTV,

    cantidadDecosIncluidos,

    cantidadDecosAdicionales:
      decosAdicionalesValidos,

    subtotalDecosAdicionales,

    cantidadDecosTotal,

    subtotalAntesConvergencia,

    descuentoConvergencia,

    totalDespuesConvergencia,

    descuentoClaroPay,

    total,
  }
}
