'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  calcularCotizacion,
  TipoLinea,
  PromocionFlash,
} from '../../lib/cotizador/calcular'

import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'
import CerrarSesion from '../CerrarSesion'

type Producto = {
  id: number
  producto: string
  origen: string | null
  plan: string
  precio_lista: number
  descuento_normal: number | null
  precio_cliente: number | null
  beneficios: string | null
}

type NovedadPropuesta = {
  id: number
  titulo: string
  contenido: string
  activo: boolean
  orden: number
}

type Props = {
  productos: Producto[]
  reglas: Record<string, number>
  promocionesFlash: PromocionFlash[]
  novedades: NovedadPropuesta[]
  usuario: string
}

type LineaUI = {
  id: number
  tipo: TipoLinea
  plan: string
  cantidad: number
}

type DatosCliente = {
  nombre: string
  apellido: string
  dni: string
  telefono: string
  email: string
  companiaActual: string
  domicilio: string
  entreCalles: string
  localidad: string
  observacionesDomicilio: string
}

function dinero(valor: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(valor)
}

function nombreTipo(tipo: TipoLinea) {
  if (tipo === 'LINEA NUEVA') {
    return 'Línea Nueva'
  }

  return `Port. ${tipo}`
}

function fechaArgentina(fecha: Date) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(fecha)
}

function emailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export default function Cotizador({
  productos,
  reglas,
  promocionesFlash,
  novedades,
  usuario,
}: Props) {
  const propuestaRef = useRef<HTMLDivElement>(null)
  const [exportando, setExportando] = useState(false)

  /*
   * =====================================================
   * DATOS TEMPORALES DEL CLIENTE
   * =====================================================
   *
   * Estos datos viven solamente durante la cotización.
   * No se guardan en Supabase.
   */

  const [datosCliente, setDatosCliente] =
    useState<DatosCliente>({
      nombre: '',
      apellido: '',
      dni: '',
      telefono: '',
      email: '',
      companiaActual: '',
      domicilio: '',
      entreCalles: '',
      localidad: '',
      observacionesDomicilio: '',
    })

  const fechaEmision = useMemo(
    () => fechaArgentina(new Date()),
    []
  )

  const datosClienteCompletos =
    datosCliente.nombre.trim() !== '' &&
    datosCliente.apellido.trim() !== '' &&
    datosCliente.dni.trim() !== '' &&
    datosCliente.telefono.trim() !== '' &&
    emailValido(datosCliente.email) &&
    datosCliente.companiaActual.trim() !== '' &&
    datosCliente.domicilio.trim() !== '' &&
    datosCliente.entreCalles.trim() !== '' &&
    datosCliente.localidad.trim() !== '' &&
    datosCliente.observacionesDomicilio.trim() !== ''

  function actualizarDatoCliente(
    campo: keyof DatosCliente,
    valor: string
  ) {
    setDatosCliente((actual) => ({
      ...actual,
      [campo]: valor,
    }))
  }

  /*
   * =====================================================
   * CLIENTE CLARO
   * =====================================================
   */

  const [
    clienteTieneLineasClaro,
    setClienteTieneLineasClaro,
  ] = useState(false)

  const [
    cantidadLineasActuales,
    setCantidadLineasActuales,
  ] = useState(1)

  const [
    clienteTieneBAF,
    setClienteTieneBAF,
  ] = useState(false)

  /*
   * =====================================================
   * LÍNEAS NUEVAS
   * =====================================================
   */

  const [lineas, setLineas] =
    useState<LineaUI[]>([
      {
        id: 1,
        tipo: 'LINEA NUEVA',
        plan: '7 Gigas',
        cantidad: 1,
      },
    ])

  const [nextLineaId, setNextLineaId] =
    useState(2)

  /*
   * =====================================================
   * INTERNET / BAF
   * =====================================================
   */

  const [
    internetActivo,
    setInternetActivo,
  ] = useState(false)

  const [
    planInternet,
    setPlanInternet,
  ] = useState('200 MB')

  /*
   * =====================================================
   * TV
   * =====================================================
   */

  const [
    tvActivo,
    setTvActivo,
  ] = useState(false)

  const [
    cantidadDecosAdicionales,
    setCantidadDecosAdicionales,
  ] = useState(0)

  /*
   * =====================================================
   * CLARO PAY
   * =====================================================
   */

  const [
    pagaClaroPay,
    setPagaClaroPay,
  ] = useState(false)

  /*
   * =====================================================
   * LISTADOS DE PRODUCTOS
   * =====================================================
   */

  const planesMoviles = useMemo(() => {
    const unicos =
      new Map<string, Producto>()

    productos
      .filter(
        (p) =>
          p.producto ===
            'LINEA NUEVA' &&
          p.origen ===
            'LINEA NUEVA'
      )
      .forEach((p) => {
        unicos.set(p.plan, p)
      })

    return Array.from(
      unicos.values()
    )
  }, [productos])

  const planesInternet =
    useMemo(() => {
      return productos.filter(
        (p) =>
          p.producto ===
          'Internet Fibra optica'
      )
    }, [productos])

  /*
   * TV
   */

  const productoTV =
    useMemo(() => {
      return productos.find(
        (p) =>
          p.producto ===
          'CLARO TV'
      )
    }, [productos])

  const productoDeco =
    useMemo(() => {
      return productos.find(
        (p) =>
          p.producto ===
          'DECODIFICADOR TV ADICIONAL'
      )
    }, [productos])

  /*
   * PACKS INFORMATIVOS
   */

  const packsDatos =
    useMemo(() => {
      return productos.filter(
        (p) =>
          p.producto ===
          'PACK DATOS'
      )
    }, [productos])

  const packsTV =
    useMemo(() => {
      return productos.filter(
        (p) =>
          p.producto ===
          'PACK TV'
      )
    }, [productos])

  /*
   * =====================================================
   * REGLAS PARAMETRIZADAS
   * =====================================================
   */

  const descuentoConexionFull =
    reglas.COMBO_PORTA ?? 80

  const convergencia2 =
    reglas.CONVERGENCIA_2 ??
    4000

  const convergencia3 =
    reglas.CONVERGENCIA_3 ??
    5000

  const porcentajeClaroPay =
    reglas.CLARO_PAY ?? 15

  const topeClaroPay =
    reglas.CLARO_PAY_TOPE ??
    3000

  /*
   * =====================================================
   * MODIFICAR LÍNEAS
   * =====================================================
   */

  function actualizarLinea(
    id: number,
    campo: keyof LineaUI,
    valor: string | number
  ) {
    setLineas((actuales) =>
      actuales.map((linea) =>
        linea.id === id
          ? {
              ...linea,

              [campo]:
                campo === 'cantidad'
                  ? Math.max(
                      1,
                      Number(valor)
                    )
                  : valor,
            }
          : linea
      )
    )
  }

  function agregarLinea() {
    setLineas((actuales) => [
      ...actuales,

      {
        id: nextLineaId,
        tipo: 'LINEA NUEVA',
        plan: '7 Gigas',
        cantidad: 1,
      },
    ])

    setNextLineaId(
      (actual) => actual + 1
    )
  }

  function eliminarLinea(
    id: number
  ) {
    setLineas((actuales) =>
      actuales.filter(
        (linea) =>
          linea.id !== id
      )
    )
  }

  /*
   * =====================================================
   * PRODUCTO BAF SELECCIONADO
   * =====================================================
   */

  const productoInternet =
    useMemo(() => {
      if (!internetActivo) {
        return null
      }

      return productos.find(
        (p) =>
          p.producto ===
            'Internet Fibra optica' &&
          p.plan ===
            planInternet
      )
    }, [
      productos,
      internetActivo,
      planInternet,
    ])

  /*
   * =====================================================
   * DISPONIBILIDAD DE TV
   * =====================================================
   *
   * TV puede venderse cuando:
   *
   * - el cliente ya tiene BAF
   *   o
   * - está contratando BAF.
   */

  const puedeContratarTV =
    clienteTieneBAF ||
    internetActivo

  /*
   * Si desaparece la condición
   * necesaria para TV, quitamos
   * automáticamente TV y decos.
   */

  useEffect(() => {
    if (!puedeContratarTV) {
      setTvActivo(false)

      setCantidadDecosAdicionales(
        0
      )
    }
  }, [puedeContratarTV])

  /*
   * =====================================================
   * ARMAR LÍNEAS PARA EL MOTOR
   * =====================================================
   */

  const lineasMotor =
    useMemo(() => {
      return lineas.map(
        (linea) => {
          let producto:
            | Producto
            | undefined

          if (
            linea.tipo ===
            'LINEA NUEVA'
          ) {
            producto =
              productos.find(
                (p) =>
                  p.producto ===
                    'LINEA NUEVA' &&
                  p.origen ===
                    'LINEA NUEVA' &&
                  p.plan ===
                    linea.plan
              )
          } else {
            producto =
              productos.find(
                (p) =>
                  p.producto ===
                    'PORTABILIDAD' &&
                  p.origen ===
                    linea.tipo &&
                  p.plan ===
                    linea.plan
              )
          }

          return {
            id: linea.id,
            tipo: linea.tipo,
            plan: linea.plan,

            cantidad:
              linea.cantidad,

            precioLista:
              Number(
                producto
                  ?.precio_lista ??
                  0
              ),

            descuentoNormal:
              Number(
                producto
                  ?.descuento_normal ??
                  0
              ),

            beneficiosNormal:
              producto
                ?.beneficios ??
              null,
          }
        }
      )
    }, [
      lineas,
      productos,
    ])

  /*
   * =====================================================
   * MOTOR DE CÁLCULO
   * =====================================================
   */

  const resultado =
    calcularCotizacion({
      lineas:
        lineasMotor,

      contrataBAF:
        internetActivo,

      precioBAF:
        Number(
          productoInternet
            ?.precio_lista ??
            0
        ),

      clienteTieneBAF,

      clienteTieneLineasClaro,

      cantidadLineasActuales,

      descuentoConexionFull,

      convergencia2,

      convergencia3,

      /*
       * TV
       */

      contrataTV:
        tvActivo,

      precioTV:
        Number(
          productoTV
            ?.precio_lista ??
            0
        ),

      cantidadDecosAdicionales,

      precioDecoAdicional:
        Number(
          productoDeco
            ?.precio_lista ??
            0
        ),

      /*
       * CLARO PAY
       */

      pagaClaroPay,

      porcentajeClaroPay,

      topeClaroPay,

      promocionesFlash,
    })

  /*
   * =====================================================
   * EXPORTAR / COMPARTIR PROPUESTA
   * =====================================================
   */

  function validarExportacion() {
    if (datosClienteCompletos) return true

    window.alert(
      'Completá todos los datos obligatorios del cliente antes de generar la propuesta.'
    )
    return false
  }

  function nombreArchivo(extension: 'jpg' | 'pdf') {
    const cliente =
      `${datosCliente.apellido}-${datosCliente.nombre}`
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ-]/g, '')

    return `Propuesta-Claro-${cliente || 'Cliente'}-${fechaEmision.replace(/\//g, '-')}.${extension}`
  }

  async function imagenPropuesta() {
    if (!propuestaRef.current) {
      throw new Error('No se encontró la propuesta.')
    }

    return toPng(propuestaRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
    })
  }

  async function descargarJPG() {
    if (!validarExportacion()) return

    try {
      setExportando(true)
      const dataUrl = await imagenPropuesta()
      const enlace = document.createElement('a')
      enlace.download = nombreArchivo('jpg')
      enlace.href = dataUrl
      enlace.click()
    } catch (error) {
      console.error(error)
      window.alert('No se pudo generar el JPG de la propuesta.')
    } finally {
      setExportando(false)
    }
  }

  async function descargarPDF() {
    if (!validarExportacion()) return

    try {
      setExportando(true)
      const dataUrl = await imagenPropuesta()

      if (!propuestaRef.current) return

      const ancho = propuestaRef.current.offsetWidth
      const alto = propuestaRef.current.offsetHeight

      const pdf = new jsPDF({
        orientation: alto > ancho ? 'portrait' : 'landscape',
        unit: 'px',
        format: [ancho, alto],
        hotfixes: ['px_scaling'],
      })

      pdf.addImage(dataUrl, 'PNG', 0, 0, ancho, alto)
      pdf.save(nombreArchivo('pdf'))
    } catch (error) {
      console.error(error)
      window.alert('No se pudo generar el PDF de la propuesta.')
    } finally {
      setExportando(false)
    }
  }

async function compartirPropuesta() {
  if (!validarExportacion()) {
    return
  }

  const telefono =
    datosCliente.telefono.replace(/\D/g, '')

  const texto =
    `Hola ${datosCliente.nombre}, te envío la Propuesta Comercial Claro por ${dinero(resultado.total)}. ` +
    `Es válida únicamente durante el día ${fechaEmision}. ` +
    'Por favor revisá los productos, beneficios e importes detallados. ' +
    'Si estás de acuerdo, respondé OK a este mensaje.'

  const urlWhatsApp =
    `https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`

  window.open(
    urlWhatsApp,
    '_blank',
    'noopener,noreferrer'
  )
}  
  /*
   * =====================================================
   * INTERFAZ
   * =====================================================
   */

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 overflow-x-hidden">

      {/* CABECERA */}

      <header className="bg-white border-b border-gray-200 px-3 sm:px-5 py-2">

        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-4">

          <div>

            <div className="text-2xl font-bold text-red-600">
              Claro
            </div>

            <div className="text-sm text-gray-500">
              Cotizador Comercial
            </div>

          </div>

<div className="flex items-center gap-3 text-sm">

  <span className="text-gray-500">
    {usuario}
  </span>

  <span className="text-gray-300">
    ·
  </span>

  <CerrarSesion />

</div>

        </div>

      </header>

      <div className="max-w-7xl mx-auto px-3 py-3 sm:px-5 sm:py-4 grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-4 lg:gap-5">

        {/* ==================================================
            PANEL IZQUIERDO
        ================================================== */}

        <section>

          {/* MASIVO / PYME */}

          <div className="grid grid-cols-2 gap-2 mb-3">

            <button className="bg-red-600 text-white font-semibold rounded-lg py-2">
              MASIVO
            </button>

            <button className="bg-white border border-gray-300 text-gray-500 font-semibold rounded-lg py-2">
              PYME
            </button>

          </div>

          {/* ==================================================
              DATOS DEL CLIENTE
          ================================================== */}

          <div className="mb-4">

            <div className="flex items-start justify-between gap-3 mb-2">

              <div>
                <h2 className="text-lg font-semibold">
                  Datos del Cliente
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  Obligatorios para generar y compartir la propuesta.
                </p>
              </div>

              <div className="text-right text-sm">

                <div className="text-gray-500">
                  Vendedor
                </div>

                <div className="font-semibold text-gray-800">
                  {usuario}
                </div>

              </div>

            </div>

            <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 sm:p-4">

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">

                <div>
                  <label className="block text-sm text-gray-500 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={datosCliente.nombre}
                    onChange={(e) =>
                      actualizarDatoCliente(
                        'nombre',
                        e.target.value
                      )
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-500 mb-1">
                    Apellido *
                  </label>
                  <input
                    type="text"
                    value={datosCliente.apellido}
                    onChange={(e) =>
                      actualizarDatoCliente(
                        'apellido',
                        e.target.value
                      )
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-500 mb-1">
                    DNI *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={datosCliente.dni}
                    onChange={(e) =>
                      actualizarDatoCliente(
                        'dni',
                        e.target.value
                      )
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-500 mb-1">
                    Teléfono *
                  </label>
                  <input
                    type="tel"
                    value={datosCliente.telefono}
                    onChange={(e) =>
                      actualizarDatoCliente(
                        'telefono',
                        e.target.value
                      )
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-4 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">
                    Domicilio *
                  </label>
                  <input
                    type="text"
                    value={datosCliente.domicilio}
                    onChange={(e) =>
                      actualizarDatoCliente(
                        'domicilio',
                        e.target.value
                      )
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-500 mb-1">
                    Entre calles *
                  </label>
                  <input
                    type="text"
                    value={datosCliente.entreCalles}
                    onChange={(e) =>
                      actualizarDatoCliente(
                        'entreCalles',
                        e.target.value
                      )
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                  />
                </div>

                <div className="">
                  <label className="block text-sm text-gray-500 mb-1">
                    Localidad *
                  </label>
                  <input
                    type="text"
                    value={datosCliente.localidad}
                    onChange={(e) =>
                      actualizarDatoCliente(
                        'localidad',
                        e.target.value
                      )
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                  />
                </div>

                </div>

                <div className="sm:col-span-2 lg:col-span-2">
                  <label className="block text-sm text-gray-500 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={datosCliente.email}
                    onChange={(e) =>
                      actualizarDatoCliente(
                        'email',
                        e.target.value
                      )
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                  />

                  {datosCliente.email.trim() !== '' &&
                    !emailValido(datosCliente.email) && (
                    <div className="text-xs text-red-600 mt-1">
                      Ingresá una dirección de email válida.
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2 lg:col-span-2">
                  <label className="block text-sm text-gray-500 mb-1">
                    Compañía Actual *
                  </label>
                  <input
                    type="text"
                    value={datosCliente.companiaActual}
                    onChange={(e) =>
                      actualizarDatoCliente(
                        'companiaActual',
                        e.target.value
                      )
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-4">
                  <label className="block text-sm text-gray-500 mb-1">
                    Observaciones del domicilio *
                  </label>
                  <textarea
                    rows={2}
                    value={
                      datosCliente.observacionesDomicilio
                    }
                    onChange={(e) =>
                      actualizarDatoCliente(
                        'observacionesDomicilio',
                        e.target.value
                      )
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 resize-y"
                  />
                </div>

              </div>

              <div className="border-t border-gray-100 mt-3 pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs sm:text-sm">

                <div>
                  <span className="text-gray-500">
                    Fecha de emisión:{' '}
                  </span>
                  <strong>{fechaEmision}</strong>
                </div>

                <div>
                  <span className="text-gray-500">
                    Vigencia:{' '}
                  </span>
                  <strong>
                    solo durante el día de emisión
                  </strong>
                </div>

              </div>

              <div
                className={
                  datosClienteCompletos
                    ? 'mt-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs sm:text-sm text-green-700'
                    : 'mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs sm:text-sm text-amber-700'
                }
              >
                {datosClienteCompletos
                  ? 'Datos completos. La propuesta quedará habilitada para exportación.'
                  : 'Completá todos los campos obligatorios para habilitar la exportación.'}
              </div>

            </div>

          </div>

          {/* CLIENTE CLARO */}

          <div className="mb-3">

            <h2 className="text-base font-semibold mb-2">
              Cliente Claro
            </h2>

            <div className="bg-white border border-gray-200 rounded-xl px-3 py-2">

              <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-2">

                <label className="flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={clienteTieneLineasClaro}
                    onChange={(e) =>
                      setClienteTieneLineasClaro(
                        e.target.checked
                      )
                    }
                    className="w-4 h-4"
                  />
                  Tiene Líneas Mov.?
                </label>

                {clienteTieneLineasClaro && (
                  <label className="flex items-center gap-2 text-xs text-gray-500">
                    Cant.
                    <input
                      type="number"
                      min="1"
                      value={cantidadLineasActuales}
                      onChange={(e) =>
                        setCantidadLineasActuales(
                          Math.max(
                            1,
                            Number(e.target.value)
                          )
                        )
                      }
                      className="w-16 border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-900"
                    />
                  </label>
                )}

                <label className="flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={clienteTieneBAF}
                    onChange={(e) =>
                      setClienteTieneBAF(
                        e.target.checked
                      )
                    }
                    className="w-4 h-4"
                  />
                  Tiene BAF?
                </label>

              </div>

            </div>

          </div>

          {/* ==================================================
              LÍNEAS MÓVILES
          ================================================== */}

          <div className="flex items-center justify-between mb-2">

            <h2 className="text-lg font-semibold">
              Líneas Móviles
            </h2>

            <button
              type="button"

              onClick={
                agregarLinea
              }

              className="text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg text-sm font-medium"
            >
              + Agregar línea
            </button>

          </div>

          <div className="space-y-2">

            {lineas.length === 0 && (

              <div className="bg-white border border-gray-200 rounded-xl p-6 text-gray-400 italic">
                Sin líneas móviles configuradas
              </div>

            )}

            {lineas.map(
              (linea) => (

                <div
                  key={linea.id}

                  className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4"
                >

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_155px_1fr_auto] gap-2 sm:gap-3 items-end">

                    {/* PLAN */}

                    <div>

                      <label className="block text-sm text-gray-500 mb-1">
                        Plan
                      </label>

                      <select
                        value={
                          linea.plan
                        }

                        onChange={(e) =>
                          actualizarLinea(
                            linea.id,

                            'plan',

                            e.target.value
                          )
                        }

                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                      >

                        {planesMoviles.map(
                          (p) => (

                            <option
                              key={p.id}
                              value={p.plan}
                            >
                              {p.plan}
                              {' - '}
                              {dinero(
                                Number(
                                  p.precio_lista
                                )
                              )}
                            </option>

                          )
                        )}

                      </select>

                    </div>

                    {/* CANTIDAD */}

<div>

  <label className="block text-sm text-gray-500 mb-1">
    Cant.
  </label>

  <div className="flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden">

    <button
      type="button"
      onClick={() =>
        actualizarLinea(
          linea.id,
          'cantidad',
          Math.max(
            1,
            linea.cantidad - 1
          )
        )
      }
      className="w-10 h-10 text-lg font-semibold text-gray-600 hover:bg-gray-100 active:bg-gray-200"
    >
      −
    </button>

    <input
      type="number"
      inputMode="numeric"
      min="1"
      value={linea.cantidad}
      onChange={(e) =>
        actualizarLinea(
          linea.id,
          'cantidad',
          Math.max(
            1,
            Number(e.target.value)
          )
        )
      }
      className="w-12 h-10 text-center border-x border-gray-200 bg-white text-gray-900 font-semibold outline-none"
    />

    <button
      type="button"
      onClick={() =>
        actualizarLinea(
          linea.id,
          'cantidad',
          linea.cantidad + 1
        )
      }
      className="w-10 h-10 text-lg font-semibold text-gray-600 hover:bg-gray-100 active:bg-gray-200"
    >
      +
    </button>

  </div>

</div>


                    {/* TIPO */}

                    <div>

                      <label className="block text-sm text-gray-500 mb-1">
                        Tipo
                      </label>

                      <select
                        value={
                          linea.tipo
                        }

                        onChange={(e) =>
                          actualizarLinea(
                            linea.id,

                            'tipo',

                            e.target
                              .value as TipoLinea
                          )
                        }

                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                      >

                        <option value="LINEA NUEVA">
                          Línea nueva
                        </option>

                        <option value="PERSONAL">
                          Port. Personal
                        </option>

                        <option value="MOVISTAR">
                          Port. Movistar
                        </option>

                        <option value="TUENTI">
                          Port. Tuenti
                        </option>

                      </select>

                    </div>

                    {/* ELIMINAR */}

                    <button
                      type="button"

                      onClick={() =>
                        eliminarLinea(
                          linea.id
                        )
                      }

                      className="h-10 w-full sm:w-auto px-4 border border-gray-300 rounded-lg text-gray-500 hover:text-red-600 hover:border-red-300"
                    >
                      ×
                    </button>

                  </div>

                </div>

              )
            )}

          </div>

          {/* ==================================================
              INTERNET / BAF
          ================================================== */}

          <div className="mt-4">

            <div className="flex items-center gap-2 mb-2">

              <input
                type="checkbox"

                checked={
                  internetActivo
                }

                onChange={(e) =>
                  setInternetActivo(
                    e.target.checked
                  )
                }

                className="w-5 h-5"
              />

              <h2 className="text-lg font-semibold">
                Internet WiFi
              </h2>

            </div>

            {internetActivo && (

              <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">

                <label className="block text-sm text-gray-500 mb-1">
                  Plan de Internet
                </label>

                <select
                  value={
                    planInternet
                  }

                  onChange={(e) =>
                    setPlanInternet(
                      e.target.value
                    )
                  }

                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                >

                  {planesInternet.map(
                    (p) => (

                      <option
                        key={p.id}
                        value={p.plan}
                      >
                        {p.plan}
                        {' - '}
                        {dinero(
                          Number(
                            p.precio_lista
                          )
                        )}
                      </option>

                    )
                  )}

                </select>

              </div>

            )}

          </div>

          {/* ==================================================
              CLARO TV
          ================================================== */}

          <div className="mt-4">

            <div className="flex items-center justify-between mb-2">

              <div>

                <h2 className="text-lg font-semibold">
                  Claro TV
                </h2>

                {!puedeContratarTV && (

                  <div className="text-sm text-gray-400 mt-1">
                    Requiere servicio Internet 2Play instalado.
                  </div>

                )}

              </div>

              <input
                type="checkbox"

                disabled={
                  !puedeContratarTV
                }

                checked={
                  tvActivo
                }

                onChange={(e) =>
                  setTvActivo(
                    e.target.checked
                  )
                }

                className="w-5 h-5 disabled:opacity-40"
              />

            </div>

            {tvActivo &&
              puedeContratarTV && (

              <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">

                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4">

                  <div>

                    <div className="font-medium">
                      {productoTV?.plan ??
                        'TV FULL HD'}
                    </div>

                    <div className="text-sm text-gray-500 mt-1">
                      Incluye 1 decodificador sin cargo
                    </div>

                  </div>

                  <div className="font-semibold">
                    {dinero(
                      Number(
                        productoTV
                          ?.precio_lista ??
                          0
                      )
                    )}
                  </div>

                </div>

                <div className="mt-4">

                  <label className="block text-sm text-gray-500 mb-1">
                    Decodificadores adicionales
                  </label>

                  <select
                    value={
                      cantidadDecosAdicionales
                    }

                    onChange={(e) =>
                      setCantidadDecosAdicionales(
                        Number(
                          e.target.value
                        )
                      )
                    }

                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                  >

                    <option value="0">
                      0 adicionales
                    </option>

                    <option value="1">
                      1 adicional
                    </option>

                    <option value="2">
                      2 adicionales
                    </option>

                  </select>

                  <div className="text-sm text-gray-500 mt-2">
                    Cada deco adicional:{' '}
                    <strong>
                      {dinero(
                        Number(
                          productoDeco
                            ?.precio_lista ??
                            0
                        )
                      )}
                    </strong>
                  </div>

                  <div className="text-xs text-gray-400 mt-1">
                    Máximo: 3 decodificadores por servicio.
                  </div>

                </div>

              </div>

            )}

          </div>

          {/* CLARO PAY */}

          <div className="mt-4">

            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">

              <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                <input
                  type="checkbox"
                  checked={pagaClaroPay}
                  onChange={(e) =>
                    setPagaClaroPay(
                      e.target.checked
                    )
                  }
                  className="w-4 h-4"
                />

                ClaroPay ({porcentajeClaroPay}% Desc.)
              </label>

            </div>

          </div>

          {/* PACKS INFORMATIVOS */}

          <div className="mt-4">

            <div className="flex items-baseline justify-between gap-3 mb-1">
              <h2 className="text-base font-semibold">
                Packs · Información
              </h2>

              <span className="text-xs text-gray-400">
                Autogestión
              </span>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-3">

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">

                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                    Datos
                  </div>

                  {packsDatos.map((pack) => (
                    <div
                      key={pack.id}
                      className="flex flex-wrap justify-between gap-2 gap-3 text-xs sm:text-sm py-0.5"
                    >
                      <span>{pack.plan}</span>
                      <span className="font-semibold">
                        {dinero(Number(pack.precio_lista))}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="sm:border-l sm:border-gray-200 sm:pl-4">
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                    TV
                  </div>

                  {packsTV.map((pack) => (
                    <div
                      key={pack.id}
                      className="flex flex-wrap justify-between gap-2 gap-3 text-xs sm:text-sm py-0.5"
                    >
                      <span>{pack.plan}</span>
                      <span className="font-semibold">
                        {dinero(Number(pack.precio_lista))}
                      </span>
                    </div>
                  ))}
                </div>

              </div>

              <div className="border-t border-gray-100 mt-1 pt-1 text-[10px] text-gray-400">
                Valores informativos · No se suman a la propuesta.
              </div>

            </div>

          </div>

        </section>

        {/* ==================================================
            PRESUPUESTO
        ================================================== */}

        <aside className="bg-white border border-gray-200 rounded-2xl p-3 sm:p-4 shadow-sm h-fit lg:sticky lg:top-3">

          <div ref={propuestaRef}>

          <div className="border-b border-gray-200 pb-2 mb-3">
            <div className="text-xl sm:text-2xl font-bold text-red-600">
              Claro
            </div>
            <h2 className="text-lg sm:text-lg font-bold mt-0.5">
              Propuesta Comercial
            </h2>
<div className="text-xs sm:text-sm font-bold text-gray-900 mt-0.5">
  Lucom Agente Oficial Claro
</div>
          </div>

          {/* DATOS DEL CLIENTE */}

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-3">

            <div className="text-[11px] font-semibold text-gray-500 mb-2">
              DATOS DEL CLIENTE
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-xs sm:text-sm">

              <div>
                <span className="text-gray-500">
                  Cliente:{' '}
                </span>
                <span className="font-medium">
                  {datosCliente.nombre || '—'}{' '}
                  {datosCliente.apellido || ''}
                </span>
              </div>

              <div>
                <span className="text-gray-500">
                  DNI:{' '}
                </span>
                <span>
                  {datosCliente.dni || '—'}
                </span>
              </div>

              <div>
                <span className="text-gray-500">
                  Teléfono:{' '}
                </span>
                <span>
                  {datosCliente.telefono || '—'}
                </span>
              </div>

              <div>
                <span className="text-gray-500">
                  Email:{' '}
                </span>
                <span>
                  {datosCliente.email || '—'}
                </span>
              </div>

              <div>
                <span className="text-gray-500">
                  Compañía Actual:{' '}
                </span>
                <span>
                  {datosCliente.companiaActual || '—'}
                </span>
              </div>

              <div>
                <span className="text-gray-500">
                  Domicilio:{' '}
                </span>
                <span>
                  {datosCliente.domicilio || '—'}
                </span>
              </div>

              <div>
                <span className="text-gray-500">
                  Entre calles:{' '}
                </span>
                <span>
                  {datosCliente.entreCalles || '—'}
                </span>
              </div>

              <div>
                <span className="text-gray-500">
                  Localidad:{' '}
                </span>
                <span>
                  {datosCliente.localidad || '—'}
                </span>
              </div>

              <div>
                <span className="text-gray-500">
                  Obs. domicilio:{' '}
                </span>
                <span>
                  {datosCliente.observacionesDomicilio || '—'}
                </span>
              </div>

              <div className="sm:col-span-2 border-t border-gray-200 pt-1 mt-1">
                <span className="text-gray-500">
                  Vendedor:{' '}
                </span>
                <span className="font-medium">
                  {usuario}
                </span>
              </div>

              <div>
                <span className="text-gray-500">
                  Emisión:{' '}
                </span>
                <span>
                  {fechaEmision}
                </span>
              </div>

              <div>
                <span className="text-gray-500">
                  Vigencia:{' '}
                </span>
                <span className="font-medium">
                {fechaEmision}
                </span>
              </div>

            </div>

          </div>

          {/* MÓVILES */}

          {resultado.lineas.length >
            0 && (

            <>

              <div className="text-[11px] font-semibold text-gray-500 mb-2">
                LÍNEAS MÓVILES
              </div>

              <div className="space-y-2">

                {resultado.lineas.map(
                  (linea) => (

                    <div
                      key={linea.id}

                      className="bg-gray-50 rounded-lg p-3"
                    >

                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4">

                        <div>

                          <span className="font-medium">
                            {linea.cantidad}x{' '}
                            {linea.plan}
                          </span>

                          <span className="ml-2 text-red-600">
                            {nombreTipo(
                              linea.tipo
                            )}
                          </span>

                        </div>

                        <div className="font-semibold">
                          {dinero(
                            linea.subtotal
                          )}
                        </div>

                      </div>

                      <div className="text-xs sm:text-sm mt-1">

                        <span className="line-through text-gray-400">
                          {dinero(
                            linea.precioLista
                          )}
                        </span>

                        <span className="ml-2 text-red-600">
                          -
                          {
                            linea.descuentoAplicado
                          }
                          %
                        </span>

                        <span className="ml-2">
                          {dinero(
                            linea.precioUnitario
                          )}
                          {' por línea'}
                        </span>

                      </div>

                      {linea.tipoDescuento ===
                        'CONEXION_FULL' && (

                        <div className="text-xs sm:text-sm text-green-600 mt-1">
                          Conexión Full · 10 GB de regalo x 12 meses
                        </div>

                      )}

                      {linea.tipoDescuento ===
                        'FLASH' && (

                        <div className="text-xs sm:text-sm text-amber-600 mt-1">
                          ⚡{' '}
                          {linea.nombreFlash ??
                            'Promo Flash'}
                        </div>

                      )}

                      {linea.tipoDescuento ===
                        'NORMAL' &&
                        linea.beneficiosNormal && (

                        <div className="text-xs sm:text-sm text-red-600 mt-1">
                          🎁{' '}
                          {
                            linea.beneficiosNormal
                          }
                        </div>

                      )}

                    </div>

                  )
                )}

              </div>

              <div className="bg-gray-100 rounded-lg px-3 py-2 mt-2 flex flex-wrap justify-between gap-2 text-sm font-semibold">

                <span>
                  Subtotal Móvil
                </span>

                <span>
                  {dinero(
                    resultado
                      .subtotalMoviles
                  )}
                </span>

              </div>

            </>

          )}

{/* INTERNET */}

{productoInternet && (

  <>

    <div className="text-[11px] font-semibold text-gray-500 mt-4 mb-2">
      INTERNET WIFI
    </div>

    <div className="bg-gray-50 rounded-lg p-3">

      <div className="flex flex-wrap justify-between gap-2">

        <span>
          {productoInternet.plan}
        </span>

        <span className="font-semibold">
          {dinero(
            resultado.subtotalBAF
          )}
        </span>

      </div>

      <div className="text-xs sm:text-sm text-amber-600 mt-1">
        🎁 Instalación + 1er mes GRATIS
      </div>

      <div className="text-xs sm:text-sm text-gray-700 mt-1">
      ☎️ Incluye Línea Fija c/8000 Minutos libres
      </div>

    </div>

    <div className="bg-gray-100 rounded-lg px-3 py-2 mt-2 flex flex-wrap justify-between gap-2 text-sm font-semibold">

      <span>
        Subtotal Internet
      </span>

      <span>
        {dinero(
          resultado.subtotalBAF
        )}
      </span>

    </div>

  </>

)}
          {/* TV */}

          {resultado.subtotalTV >
            0 && (

            <>

              <div className="text-[11px] font-semibold text-gray-500 mt-4 mb-2">
                CLARO TV
              </div>

              <div className="bg-gray-50 rounded-lg p-3">

                <div className="flex flex-wrap justify-between gap-2">

                  <span>
                    TV FULL HD
                  </span>

                  <span className="font-semibold">
                    {dinero(
                      resultado
                        .subtotalTV
                    )}
                  </span>

                </div>

                <div className="text-xs sm:text-sm text-green-600 mt-1">
                  ✓ 1 decodificador incluido sin cargo
                </div>

                {resultado
                  .cantidadDecosAdicionales >
                  0 && (

                  <div className="flex flex-wrap justify-between gap-2 mt-3 text-sm">

                    <span>
                      {
                        resultado
                          .cantidadDecosAdicionales
                      }{' '}
                      deco(s) adicional(es)
                    </span>

                    <span>
                      {dinero(
                        resultado
                          .subtotalDecosAdicionales
                      )}
                    </span>

                  </div>

                )}

                <div className="text-xs text-gray-400 mt-2">
                  Total de decos:{' '}
                  {
                    resultado
                      .cantidadDecosTotal
                  }
                </div>

              </div>

            </>

          )}

          {/* CONEXIÓN FULL */}

          {resultado
            .hayConexionFull && (

            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-green-700 text-xs sm:text-sm">
              Beneficios de Conexión Full aplicados.
            </div>

          )}

          {/* TOTALES */}

          <div className="border-t border-gray-200 mt-4 pt-3">

            <div className="flex flex-wrap justify-between gap-2 text-gray-600">

              <span>
                Subtotal
              </span>

              <span>
                {dinero(
                  resultado
                    .subtotalAntesConvergencia
                )}
              </span>

            </div>

            {resultado
              .hayConvergencia && (

              <div className="flex flex-wrap justify-between gap-2 text-green-600 mt-2">

                <span>
                  Descuento Convergente
                </span>

                <span>
                  -
                  {dinero(
                    resultado
                      .descuentoConvergencia
                  )}
                </span>

              </div>

            )}

            {resultado
              .hayConvergencia && (

              <div className="flex flex-wrap justify-between gap-2 text-gray-600 mt-2">

                <span>
                  Subtotal con Convergencia
                </span>

                <span>
                  {dinero(
                    resultado
                      .totalDespuesConvergencia
                  )}
                </span>

              </div>

            )}

            {pagaClaroPay && (

              <div className="mt-4">

                <div className="flex flex-wrap justify-between gap-2 text-green-600">

                  <span>
                    Claro Pay{' '}
                    {
                      porcentajeClaroPay
                    }
                    %
                  </span>

                  <span>
                    -
                    {dinero(
                      resultado
                        .descuentoClaroPay
                    )}
                  </span>

                </div>

                {resultado
                  .descuentoClaroPay >=
                  topeClaroPay && (

                  <div className="text-xs text-gray-400 mt-1">
                    Tope máximo aplicado:{' '}
                    {dinero(
                      topeClaroPay
                    )}
                  </div>

                )}

              </div>

            )}

            <div className="bg-red-600 text-white rounded-lg px-4 py-3 mt-3 flex justify-between items-center gap-3">

              <span className="text-lg font-bold">
                Total
              </span>

              <span className="text-lg font-bold">
                {dinero(
                  resultado.total
                )}
              </span>

            </div>

          </div>

          {/* NOVEDADES / BENEFICIOS */}

          {novedades.length > 0 && (

            <div className="mt-3 space-y-2">

              {novedades.map((novedad) => (

                <div
                  key={novedad.id}
                  className="border border-red-200 bg-red-50 rounded-lg px-3 py-2"
                >

                  <div className="text-sm font-semibold text-red-700">
                    {novedad.titulo}
                  </div>

                  <div className="text-xs sm:text-sm text-gray-700 mt-0.5 leading-snug whitespace-pre-line">
                    {novedad.contenido}
                  </div>

                </div>

              ))}

            </div>

          )}

          <div className="mt-5 border border-gray-200 bg-gray-50 rounded-lg p-3 text-xs leading-relaxed text-gray-600">
            <strong className="text-gray-800">
              Conformidad:
            </strong>{' '}
            La respuesta “OK” a esta propuesta implica conformidad con los productos, beneficios e importes detallados.
            La propuesta es válida únicamente durante el día de emisión.
          </div>

          </div>

          <div className="border-t border-gray-100 mt-3 pt-3">

            <div className="grid grid-cols-3 gap-2">

              <button
                type="button"
                onClick={descargarJPG}
                disabled={!datosClienteCompletos || exportando}
                className="rounded-md bg-red-600 text-white font-medium text-xs sm:text-sm px-2 sm:px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {exportando ? 'Generando...' : 'JPG'}
              </button>

              <button
                type="button"
                onClick={descargarPDF}
                disabled={!datosClienteCompletos || exportando}
                className="rounded-md bg-white border border-gray-300 text-gray-800 font-medium text-xs sm:text-sm px-2 sm:px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                PDF
              </button>

              <button
                type="button"
                onClick={compartirPropuesta}
                disabled={!datosClienteCompletos || exportando}
                className="rounded-md bg-green-600 text-white font-medium text-xs sm:text-sm px-2 sm:px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Compartir
              </button>

            </div>

            {!datosClienteCompletos && (
              <div className="text-xs text-amber-700 mt-2">
                Completá todos los datos obligatorios para habilitar la exportación.
              </div>
            )}

          </div>

        </aside>

      </div>

    </main>
  )
}
