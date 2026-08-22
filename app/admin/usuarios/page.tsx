import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { createClient } from '../../../utils/supabase/server'
import { createAdminClient } from '../../../utils/supabase/admin'

export default async function AdminUsuariosPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, activo')
    .eq('id', user.id)
    .single()

  if (
    !profile ||
    !profile.activo ||
    profile.rol !== 'ADMIN'
  ) {
    redirect('/cotizador')
  }

  const {
    data: usuarios,
    error,
  } = await supabase
    .from('profiles')
    .select(
      'id, nombre, rol, activo, created_at'
    )
    .order('nombre')

  if (error) {
    throw new Error(error.message)
  }

  /*
   * =====================================================
   * CREAR USUARIO
   * =====================================================
   */

  async function crearUsuario(
    formData: FormData
  ) {
    'use server'

    const supabase =
      await createClient()

    /*
     * Verificar ADMIN
     */
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: admin } =
      await supabase
        .from('profiles')
        .select('rol, activo')
        .eq('id', user.id)
        .single()

    if (
      !admin ||
      !admin.activo ||
      admin.rol !== 'ADMIN'
    ) {
      redirect('/cotizador')
    }

    /*
     * Datos formulario
     */
    const nombre = String(
      formData.get('nombre') ?? ''
    ).trim()

    const email = String(
      formData.get('email') ?? ''
    )
      .trim()
      .toLowerCase()

    const password = String(
      formData.get('password') ?? ''
    )

    const rol = String(
      formData.get('rol') ?? ''
    )

    if (
      !nombre ||
      !email ||
      !password
    ) {
      throw new Error(
        'Nombre, email y contraseña son obligatorios.'
      )
    }

    if (password.length < 6) {
      throw new Error(
        'La contraseña debe tener al menos 6 caracteres.'
      )
    }

    if (
      rol !== 'ADMIN' &&
      rol !== 'VENDEDOR'
    ) {
      throw new Error(
        'Rol inválido.'
      )
    }

    /*
     * Cliente administrativo
     */
    const adminClient =
      createAdminClient()

    /*
     * Crear usuario en Supabase Auth
     */
    const {
      data: nuevoUsuario,
      error: errorAuth,
    } =
      await adminClient.auth.admin.createUser({
        email,
        password,

        email_confirm: true,

        user_metadata: {
          nombre,
        },
      })

    if (errorAuth) {
      throw new Error(
        errorAuth.message
      )
    }

    if (!nuevoUsuario.user) {
      throw new Error(
        'No se pudo crear el usuario.'
      )
    }

    /*
     * Crear perfil
     */
    const {
      error: errorPerfil,
    } = await adminClient
      .from('profiles')
      .insert({
        id:
          nuevoUsuario.user.id,

        nombre,

        rol,

        activo: true,
      })

    /*
     * Si falla profiles,
     * borramos el usuario de Auth
     * para no dejar una cuenta incompleta.
     */
    if (errorPerfil) {
      await adminClient
        .auth
        .admin
        .deleteUser(
          nuevoUsuario.user.id
        )

      throw new Error(
        errorPerfil.message
      )
    }

    revalidatePath(
      '/admin/usuarios'
    )
redirect(
  '/admin/usuarios'
)
  }

  /*
   * =====================================================
   * ACTUALIZAR USUARIO
   * =====================================================
   */

  async function actualizarUsuario(
    formData: FormData
  ) {
    'use server'

    const supabase =
      await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    /*
     * Volvemos a verificar
     * que sea ADMIN.
     */
    const { data: admin } =
      await supabase
        .from('profiles')
        .select('rol, activo')
        .eq('id', user.id)
        .single()

    if (
      !admin ||
      !admin.activo ||
      admin.rol !== 'ADMIN'
    ) {
      redirect('/cotizador')
    }

    const id = String(
      formData.get('id') ?? ''
    )

    const nombre = String(
      formData.get('nombre') ?? ''
    ).trim()

    const rol = String(
      formData.get('rol') ?? ''
    )

    const activo =
      formData.get('activo') === 'on'

    if (!id || !nombre) {
      throw new Error(
        'Nombre de usuario obligatorio.'
      )
    }

    if (
      rol !== 'ADMIN' &&
      rol !== 'VENDEDOR'
    ) {
      throw new Error(
        'Rol de usuario inválido.'
      )
    }

    /*
     * Protección contra perder
     * el propio acceso ADMIN.
     */
    if (
      id === user.id &&
      (
        rol !== 'ADMIN' ||
        !activo
      )
    ) {
      throw new Error(
        'No podés quitar tu propio acceso de administrador.'
      )
    }

    const {
      error: errorUpdate,
    } = await supabase
      .from('profiles')
      .update({
        nombre,
        rol,
        activo,
      })
      .eq('id', id)

    if (errorUpdate) {
      throw new Error(
        errorUpdate.message
      )
    }

    revalidatePath(
      '/admin/usuarios'
    )

    revalidatePath(
      '/cotizador'
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:p-8">

      <div className="max-w-5xl mx-auto">

        <div className="mb-6">

          <h1 className="text-3xl font-bold text-red-600">
            Claro
          </h1>

          <p className="text-gray-500 mt-1">
            Administración del Cotizador
          </p>

        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">

          <div>

            <h2 className="text-2xl font-semibold text-gray-900">
              Usuarios
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Administrá vendedores, roles y accesos al cotizador.
            </p>

          </div>

          <a
            href="/admin"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Volver al administrador
          </a>

        </div>

        {/* ==================================================
            NUEVO USUARIO
        ================================================== */}

        <form
          action={crearUsuario}
          className="bg-white border border-gray-200 rounded-xl p-5 mb-6"
        >

          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Nuevo usuario
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_160px] gap-3">

            <div>

              <label className="block text-xs text-gray-500 mb-1">
                Nombre
              </label>

              <input
                type="text"
                name="nombre"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
              />

            </div>

            <div>

              <label className="block text-xs text-gray-500 mb-1">
                Email
              </label>

              <input
                type="email"
                name="email"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
              />

            </div>

            <div>

              <label className="block text-xs text-gray-500 mb-1">
                Contraseña inicial
              </label>

              <input
                type="password"
                name="password"
                minLength={6}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
              />

            </div>

            <div>

              <label className="block text-xs text-gray-500 mb-1">
                Rol
              </label>

              <select
                name="rol"
                defaultValue="VENDEDOR"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
              >

                <option value="VENDEDOR">
                  Vendedor
                </option>

                <option value="ADMIN">
                  Administrador
                </option>

              </select>

            </div>

          </div>

          <div className="flex justify-end mt-4">

            <button
              type="submit"
              className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2 rounded-lg"
            >
              Crear usuario
            </button>

          </div>

        </form>

        {/* ==================================================
            USUARIOS EXISTENTES
        ================================================== */}

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

          {usuarios &&
          usuarios.length > 0 ? (

            usuarios.map(
              (usuario, index) => (

                <form
                  key={usuario.id}
                  action={
                    actualizarUsuario
                  }
                  className={
                    index === 0
                      ? 'p-4'
                      : 'p-4 border-t border-gray-100'
                  }
                >

                  <input
                    type="hidden"
                    name="id"
                    value={usuario.id}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_auto_auto] gap-3 sm:items-end">

                    <div>

                      <label className="block text-xs text-gray-500 mb-1">
                        Nombre
                      </label>

                      <input
                        type="text"
                        name="nombre"
                        defaultValue={
                          usuario.nombre ?? ''
                        }
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                      />

                    </div>

                    <div>

                      <label className="block text-xs text-gray-500 mb-1">
                        Rol
                      </label>

                      <select
                        name="rol"
                        defaultValue={
                          usuario.rol
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                      >

                        <option value="VENDEDOR">
                          Vendedor
                        </option>

                        <option value="ADMIN">
                          Administrador
                        </option>

                      </select>

                    </div>

                    <label className="flex items-center gap-2 text-sm text-gray-700 sm:pb-2">

                      <input
                        type="checkbox"
                        name="activo"
                        defaultChecked={
                          usuario.activo
                        }
                      />

                      Activo

                    </label>

                    <button
                      type="submit"
                      className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg"
                    >
                      Guardar
                    </button>

                  </div>

                  {usuario.id ===
                    user.id && (

                    <div className="text-xs text-gray-400 mt-2">
                      Usuario administrador actualmente conectado
                    </div>

                  )}

                </form>

              )
            )

          ) : (

            <div className="p-8 text-center text-gray-500">
              No hay usuarios registrados.
            </div>

          )}

        </div>

      </div>

    </main>
  )
}
