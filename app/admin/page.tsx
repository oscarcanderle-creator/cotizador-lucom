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
            className="bg-white border border-gray-200 rounded-xl p-5 hover:border-red-300 hover:shadow-sm transition"
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
            className="bg-white border border-gray-200 rounded-xl p-5 hover:border-red-300 hover:shadow-sm transition"
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
            className="bg-white border border-gray-200 rounded-xl p-5 hover:border-red-300 hover:shadow-sm transition"
          >
            <div className="text-lg font-semibold text-gray-900">
              Novedades / Beneficios
            </div>

            <div className="text-sm text-gray-500 mt-2">
              Editá los tres cuadros informativos de la Propuesta.
            </div>
          </a>

          {/* PRODUCTOS */}

          <div className="bg-white border border-gray-200 rounded-xl p-5">

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
            className="bg-white border border-gray-200 rounded-xl p-5 hover:border-red-300 hover:shadow-sm transition"
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
            className="bg-white border border-gray-200 rounded-xl p-5 hover:border-red-300 hover:shadow-sm transition"
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
            className="bg-white border border-gray-200 rounded-xl p-5 hover:border-red-300 hover:shadow-sm transition"
          >
            <div className="text-lg font-semibold text-gray-900">
              Estados PORTA
            </div>

            <div className="text-sm text-gray-500 mt-2">
              Administrá los estados de gestión de Portabilidad y Línea Nueva.
            </div>
          </a>

          {/* MEDIOS DESPACHO CHIP */}

          <a
            href="/admin/medios-despacho-chip"
            className="bg-white border border-gray-200 rounded-xl p-5 hover:border-red-300 hover:shadow-sm transition"
          >
            <div className="text-lg font-semibold text-gray-900">
              Medios despacho CHIP
            </div>

            <div className="text-sm text-gray-500 mt-2">
              Administrá los medios utilizados para el despacho de chips.
            </div>
          </a>

          {/* USUARIOS */}

          <a
            href="/admin/usuarios"
            className="bg-white border border-gray-200 rounded-xl p-5 hover:border-red-300 hover:shadow-sm transition"
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
            className="bg-white border border-gray-200 rounded-xl p-5 hover:border-red-300 hover:shadow-sm transition"
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
