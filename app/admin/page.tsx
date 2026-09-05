import { redirect } from 'next/navigation'

import { createClient } from '../../utils/supabase/server'

import AppHeader from '../../components/AppHeader'

export default async function AdminPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, rol, activo')
    .eq('id', user.id)
    .single()

  if (
    !profile ||
    !profile.activo ||
    profile.rol !== 'ADMIN'
  ) {
    redirect('/ventas')
  }

  const nombreUsuario =
    profile.nombre?.trim() ||
    user.email ||
    'Administrador'

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader
        rol={profile.rol}
        usuario={nombreUsuario}
        actual="ADMIN"
      />

      <div className="max-w-6xl mx-auto px-4 py-6 sm:p-8">
        {/* TARJETAS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

          {/* REGLAS COMERCIALES */}
          <a
            href="/admin/reglas"
            className="bg-gray-100 border border-gray-200 rounded-xl p-5 hover:bg-gray-200 hover:border-gray-300 hover:shadow-sm transition active:bg-red-600 active:border-red-600 active:[&>div]:text-white"
          >
            <div className="text-lg font-semibold text-gray-900">
              Reglas Comerciales
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Descuentos, convergencia, ClaroPay y límites comerciales.
            </div>
          </a>

          {/* PROMOCIONES FLASH */}
          <a
            href="/admin/flash"
            className="bg-gray-100 border border-gray-200 rounded-xl p-5 hover:bg-gray-200 hover:border-gray-300 hover:shadow-sm transition active:bg-red-600 active:border-red-600 active:[&>div]:text-white"
          >
            <div className="text-lg font-semibold text-gray-900">
              Promociones Flash
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Porcentaje, vigencia, fecha y hora de promociones temporales.
            </div>
          </a>

          {/* NOVEDADES */}
          <a
            href="/admin/novedades"
            className="bg-gray-100 border border-gray-200 rounded-xl p-5 hover:bg-gray-200 hover:border-gray-300 hover:shadow-sm transition active:bg-red-600 active:border-red-600 active:[&>div]:text-white"
          >
            <div className="text-lg font-semibold text-gray-900">
              Novedades / Beneficios
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Editá los tres cuadros informativos de la Propuesta.
            </div>
          </a>

          {/* PRODUCTOS */}
          <div className="bg-gray-100 border border-gray-200 rounded-xl p-5">
            <div className="text-lg font-semibold text-gray-900">
              Productos y Precios
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Los precios se administran desde la tabla maestra de Google Sheets.
            </div>
            <div className="text-xs text-gray-400 mt-3">
              Sin edición directa desde ADMIN.
            </div>
          </div>

          {/* ZONAS BAF */}
          <a
            href="/admin/zonas"
            className="bg-gray-100 border border-gray-200 rounded-xl p-5 hover:bg-gray-200 hover:border-gray-300 hover:shadow-sm transition active:bg-red-600 active:border-red-600 active:[&>div]:text-white"
          >
            <div className="text-lg font-semibold text-gray-900">
              Zonas BAF
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Alta, baja, edición, orden y activación de zonas del formulario BAF.
            </div>
          </a>

          {/* ESTADOS BAF */}
          <a
            href="/admin/estados-baf"
            className="bg-gray-100 border border-gray-200 rounded-xl p-5 hover:bg-gray-200 hover:border-gray-300 hover:shadow-sm transition active:bg-red-600 active:border-red-600 active:[&>div]:text-white"
          >
            <div className="text-lg font-semibold text-gray-900">
              Estados BAF
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Administrá los estados disponibles para la gestión de ventas BAF.
            </div>
          </a>

          {/* ESTADOS PORTA */}
          <a
            href="/admin/estados-porta"
            className="bg-gray-100 border border-gray-200 rounded-xl p-5 hover:bg-gray-200 hover:border-gray-300 hover:shadow-sm transition active:bg-red-600 active:border-red-600 active:[&>div]:text-white"
          >
            <div className="text-lg font-semibold text-gray-900">
              Estados PORTA
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Administrá los estados de gestión de Portabilidad y Línea Nueva.
            </div>
          </a>

          {/* ESTADOS BBOO */}
          <a
            href="/admin/estados-bboo"
            className="bg-gray-100 border border-gray-200 rounded-xl p-5 hover:bg-gray-200 hover:border-gray-300 hover:shadow-sm transition active:bg-red-600 active:border-red-600 active:[&>div]:text-white"
          >
            <div className="text-lg font-semibold text-gray-900">
              Estados BBOO
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Administrá los estados operativos de BBOO para Portabilidad y Línea Nueva.
            </div>
          </a>

          {/* PLANES PORTA / LÍNEA NUEVA */}
          <a
            href="/admin/planes-porta"
            className="bg-gray-100 border border-gray-200 rounded-xl p-5 hover:bg-gray-200 hover:border-gray-300 hover:shadow-sm transition active:bg-red-600 active:border-red-600 active:[&>div]:text-white"
          >
            <div className="text-lg font-semibold text-gray-900">
              Planes PORTA / Línea Nueva
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Administrá los planes disponibles para Portabilidad y Línea Nueva.
            </div>
          </a>

          {/* ADMINISTRADOR DE VISTAS */}
          <a
            href="/admin/vistas"
            className="bg-gray-100 border border-gray-200 rounded-xl p-5 hover:bg-gray-200 hover:border-gray-300 hover:shadow-sm transition active:bg-red-600 active:border-red-600 active:[&>div]:text-white"
          >
            <div className="text-lg font-semibold text-gray-900">
              Administrador de Vistas
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Configurá columnas, orden, ancho y etiquetas de Gestión de Ventas por rol.
            </div>
          </a>

          {/* MEDIOS DESPACHO CHIP */}
          <a
            href="/admin/medios-despacho-chip"
            className="bg-gray-100 border border-gray-200 rounded-xl p-5 hover:bg-gray-200 hover:border-gray-300 hover:shadow-sm transition active:bg-red-600 active:border-red-600 active:[&>div]:text-white"
          >
            <div className="text-lg font-semibold text-gray-900">
              Medios despacho CHIP
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Administrá los medios utilizados para el despacho de chips.
            </div>
          </a>

          {/* TIPOS DE CONSULTA */}
          <a
            href="/admin/tipos-consulta"
            className="bg-gray-100 border border-gray-200 rounded-xl p-5 hover:bg-gray-200 hover:border-gray-300 hover:shadow-sm transition active:bg-red-600 active:border-red-600 active:[&>div]:text-white"
          >
            <div className="text-lg font-semibold text-gray-900">
              Tipos de Consulta
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Administrá los tipos disponibles para nuevas consultas.
            </div>
          </a>

          {/* ESTADOS DE CONSULTA */}
          <a
            href="/admin/estados-consulta"
            className="bg-gray-100 border border-gray-200 rounded-xl p-5 hover:bg-gray-200 hover:border-gray-300 hover:shadow-sm transition active:bg-red-600 active:border-red-600 active:[&>div]:text-white"
          >
            <div className="text-lg font-semibold text-gray-900">
              Estados de Consulta
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Administrá estados de Deuda y Cobertura y su clasificación.
            </div>
          </a>

          {/* TIPOS DE PEDIDO */}
          <a
            href="/admin/tipos-pedido"
            className="bg-gray-100 border border-gray-200 rounded-xl p-5 hover:bg-gray-200 hover:border-gray-300 hover:shadow-sm transition active:bg-red-600 active:border-red-600 active:[&>div]:text-white"
          >
            <div className="text-lg font-semibold text-gray-900">
              Tipos de Pedido
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Administrá Acometida, Proyecto, Ampliación, Rellamado y futuros tipos.
            </div>
          </a>

          {/* ESTADOS DE PEDIDO */}
          <a
            href="/admin/estados-pedido"
            className="bg-gray-100 border border-gray-200 rounded-xl p-5 hover:bg-gray-200 hover:border-gray-300 hover:shadow-sm transition active:bg-red-600 active:border-red-600 active:[&>div]:text-white"
          >
            <div className="text-lg font-semibold text-gray-900">
              Estados de Pedido
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Administrá los estados utilizados en la gestión de pedidos.
            </div>
          </a>

          {/* USUARIOS */}
          <a
            href="/admin/usuarios"
            className="bg-gray-100 border border-gray-200 rounded-xl p-5 hover:bg-gray-200 hover:border-gray-300 hover:shadow-sm transition active:bg-red-600 active:border-red-600 active:[&>div]:text-white"
          >
            <div className="text-lg font-semibold text-gray-900">
              Usuarios
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Administrá vendedores, roles y accesos.
            </div>
          </a>

          {/* VOLVER AL COTIZADOR */}
          <a
            href="/cotizador"
            className="bg-gray-100 border border-gray-200 rounded-xl p-5 hover:bg-gray-200 hover:border-gray-300 hover:shadow-sm transition active:bg-red-600 active:border-red-600 active:[&>div]:text-white"
          >
            <div className="text-lg font-semibold text-gray-900">
              Volver al Cotizador
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Regresar a la pantalla comercial.
            </div>
          </a>

        </div>
      </div>
    </main>
  )
}
