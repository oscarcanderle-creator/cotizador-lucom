import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { createClient } from '../../../utils/supabase/server'
import { createAdminClient } from '../../../utils/supabase/admin'
import AppHeader from '../../../components/AppHeader'

type RolUsuario = 'ADMIN' | 'SUPERVISOR' | 'VENDEDOR' | 'TERRENO' | 'BBOO'

async function validarAdmin() {
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
    redirect('/cotizador')
  }

  return {
    supabase,
    user,
    profile,
    adminClient: createAdminClient(),
  }
}

function validarRol(valor: string): RolUsuario {
  if (
    valor !== 'ADMIN' &&
    valor !== 'SUPERVISOR' &&
    valor !== 'VENDEDOR' &&
    valor !== 'TERRENO' &&
    valor !== 'BBOO'
  ) {
    throw new Error('Rol de usuario inválido.')
  }

  return valor
}

export default async function AdminUsuariosPage() {
  const {
    supabase,
    user,
    profile,
    adminClient,
  } = await validarAdmin()

  const {
    data: usuarios,
    error,
  } = await supabase
    .from('profiles')
    .select(
      'id, nombre, vendedor, rol, activo, puede_gestionar_ventas, debe_cambiar_password, created_at'
    )
    .order('nombre')

  if (error) {
    throw new Error(error.message)
  }

  /*
   * Traemos el email desde Supabase Auth.
   * La contraseña nunca se lee ni se muestra.
   */
  const {
    data: authData,
    error: errorAuthListado,
  } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })

  if (errorAuthListado) {
    throw new Error(errorAuthListado.message)
  }

  const emailPorId = new Map(
    authData.users.map((authUser) => [
      authUser.id,
      authUser.email ?? '',
    ])
  )

  /*
   * Para los usuarios inactivos consultamos si tienen actividad
   * operativa o histórica. La misma validación se repite dentro
   * de la Server Action antes de eliminar, para no depender de la UI.
   */
  const actividadPorId = new Map<string, boolean>()

  await Promise.all(
    (usuarios ?? [])
      .filter((usuario) => !usuario.activo)
      .map(async (usuario) => {
        const {
          data: tieneActividad,
          error: errorActividad,
        } = await adminClient.rpc(
          'usuario_tiene_actividad',
          { p_usuario_id: usuario.id }
        )

        if (errorActividad) {
          throw new Error(errorActividad.message)
        }

        actividadPorId.set(
          usuario.id,
          Boolean(tieneActividad)
        )
      })
  )

  /*
   * =====================================================
   * CREAR USUARIO
   * =====================================================
   */
  async function crearUsuario(
    formData: FormData
  ) {
    'use server'

    const { adminClient } =
      await validarAdmin()

    const nombre = String(
      formData.get('nombre') ?? ''
    ).trim()

    const vendedor = String(
      formData.get('vendedor') ?? ''
    ).trim()

    const email = String(
      formData.get('email') ?? ''
    )
      .trim()
      .toLowerCase()

    const password = String(
      formData.get('password') ?? ''
    )

    const rol =
      validarRol(
        String(formData.get('rol') ?? '')
      )

    const puedeGestionarVentas =
      formData.get('puede_gestionar_ventas') === 'on'

    if (
      !nombre ||
      !vendedor ||
      !email ||
      !password
    ) {
      throw new Error(
        'Nombre, Vendedor, email y contraseña son obligatorios.'
      )
    }

    if (password.length < 6) {
      throw new Error(
        'La contraseña debe tener al menos 6 caracteres.'
      )
    }

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
          vendedor,
          rol,
          puede_gestionar_ventas: puedeGestionarVentas,
        },
      })

    if (errorAuth) {
      throw new Error(errorAuth.message)
    }

    if (!nuevoUsuario.user) {
      throw new Error(
        'No se pudo crear el usuario.'
      )
    }

    const { error: errorPerfil } =
      await adminClient
        .from('profiles')
        .insert({
          id: nuevoUsuario.user.id,
          nombre,
          vendedor,
          rol,
          activo: true,
          puede_gestionar_ventas: puedeGestionarVentas,
          debe_cambiar_password: true,
        })

    /*
     * Si falla profiles, eliminamos Auth
     * para no dejar una cuenta incompleta.
     */
    if (errorPerfil) {
      await adminClient.auth.admin.deleteUser(
        nuevoUsuario.user.id
      )

      throw new Error(
        errorPerfil.message
      )
    }

    revalidatePath('/admin/usuarios')
    redirect('/admin/usuarios')
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

    const {
      user,
      adminClient,
    } = await validarAdmin()

    const id = String(
      formData.get('id') ?? ''
    )

    const email = String(
      formData.get('email') ?? ''
    )
      .trim()
      .toLowerCase()

    const vendedor = String(
      formData.get('vendedor') ?? ''
    ).trim()

    const rol =
      validarRol(
        String(formData.get('rol') ?? '')
      )

    const activo =
      formData.get('activo') === 'on'

    const puedeGestionarVentas =
      formData.get('puede_gestionar_ventas') === 'on'

    if (
      !id ||
      !email ||
      !vendedor
    ) {
      throw new Error(
        'Email y Vendedor son obligatorios.'
      )
    }

    /*
     * El nombre es permanente: se recupera desde profiles y nunca
     * se toma como dato editable del formulario.
     */
    const {
      data: usuarioActual,
      error: errorUsuarioActual,
    } = await adminClient
      .from('profiles')
      .select('id, nombre')
      .eq('id', id)
      .maybeSingle()

    if (errorUsuarioActual) {
      throw new Error(errorUsuarioActual.message)
    }

    if (!usuarioActual) {
      throw new Error('El usuario ya no existe.')
    }

    const nombre = String(usuarioActual.nombre ?? '').trim()

    if (!nombre) {
      throw new Error('El usuario no tiene un Nombre válido en profiles.')
    }

    /*
     * Protección contra perder el propio ADMIN.
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

    /*
     * Primero actualizamos Auth.
     * Incluimos también rol y habilitación de gestión para que
     * cualquier sincronización existente mantenga los mismos valores.
     */
    const { error: errorMetadata } =
      await adminClient.auth.admin.updateUserById(
        id,
        {
          email,
          email_confirm: true,
          user_metadata: {
            nombre,
            vendedor,
            rol,
            puede_gestionar_ventas: puedeGestionarVentas,
          },
        }
      )

    if (errorMetadata) {
      throw new Error(
        errorMetadata.message
      )
    }

    /*
     * Guardamos profiles al final.
     * De esta forma public.profiles queda como fuente definitiva
     * para permisos y configuración de la aplicación.
     */
    const { error: errorUpdate } =
      await adminClient
        .from('profiles')
        .update({
          nombre,
          vendedor,
          rol,
          activo,
          puede_gestionar_ventas: puedeGestionarVentas,
        })
        .eq('id', id)

    if (errorUpdate) {
      throw new Error(
        errorUpdate.message
      )
    }

    revalidatePath('/admin/usuarios')
    revalidatePath('/cotizador')
    revalidatePath('/ventas')
    redirect('/admin/usuarios')
  }

  /*
   * =====================================================
   * RESET ADMINISTRATIVO DE CONTRASEÑA
   * =====================================================
   *
   * El ADMIN asigna una contraseña temporal.
   * El perfil queda marcado para exigir cambio
   * en el siguiente inicio.
   */
  async function resetearPassword(
    formData: FormData
  ) {
    'use server'

    const {
      adminClient,
    } = await validarAdmin()

    const id = String(
      formData.get('id') ?? ''
    )

    const passwordTemporal = String(
      formData.get('password_temporal') ?? ''
    )

    if (!id) {
      throw new Error(
        'Usuario inválido.'
      )
    }

    if (passwordTemporal.length < 6) {
      throw new Error(
        'La contraseña temporal debe tener al menos 6 caracteres.'
      )
    }

    const {
      error: errorPassword,
    } =
      await adminClient.auth.admin.updateUserById(
        id,
        {
          password: passwordTemporal,
        }
      )

    if (errorPassword) {
      throw new Error(
        errorPassword.message
      )
    }

    const { error: errorPerfil } =
      await adminClient
        .from('profiles')
        .update({
          debe_cambiar_password: true,
        })
        .eq('id', id)

    if (errorPerfil) {
      throw new Error(
        errorPerfil.message
      )
    }

    revalidatePath('/admin/usuarios')
  }

  /*
   * =====================================================
   * ELIMINAR USUARIO
   * =====================================================
   *
   * Inactivar = suspensión temporal.
   * Eliminar = baja definitiva de Auth + profile.
   *
   * Solo puede eliminarse un usuario INACTIVO y sin
   * ninguna actividad operativa o histórica asociada.
   */
  async function eliminarUsuario(
    formData: FormData
  ) {
    'use server'

    const {
      user,
      adminClient,
    } = await validarAdmin()

    const id = String(
      formData.get('id') ?? ''
    )

    const confirmar = String(
      formData.get('confirmar') ?? ''
    )
      .trim()
      .toUpperCase()

    if (!id) {
      throw new Error(
        'Usuario inválido.'
      )
    }

    if (id === user.id) {
      throw new Error(
        'No podés eliminar el usuario administrador con el que estás conectado.'
      )
    }

    if (confirmar !== 'ELIMINAR') {
      throw new Error(
        'Escribí ELIMINAR para confirmar la baja definitiva.'
      )
    }

    /*
     * Validación obligatoria del estado actual del perfil.
     * No confiamos en el estado que mostró previamente la pantalla.
     */
    const {
      data: usuarioObjetivo,
      error: errorUsuarioObjetivo,
    } = await adminClient
      .from('profiles')
      .select('id, activo')
      .eq('id', id)
      .maybeSingle()

    if (errorUsuarioObjetivo) {
      throw new Error(
        errorUsuarioObjetivo.message
      )
    }

    if (!usuarioObjetivo) {
      throw new Error(
        'El usuario ya no existe.'
      )
    }

    if (usuarioObjetivo.activo) {
      throw new Error(
        'Solo se pueden eliminar definitivamente usuarios inactivos.'
      )
    }

    /*
     * La función de base de datos contempla todas las referencias
     * operativas e históricas definidas para profiles.id, incluso
     * aquellas cuyo FK usaría SET NULL.
     */
    const {
      data: tieneActividad,
      error: errorActividad,
    } = await adminClient.rpc(
      'usuario_tiene_actividad',
      { p_usuario_id: id }
    )

    if (errorActividad) {
      throw new Error(
        errorActividad.message
      )
    }

    if (tieneActividad) {
      throw new Error(
        'Este usuario tiene actividad o historial asociado y no puede eliminarse. Debe permanecer inactivo.'
      )
    }

    /*
     * Recién después de superar todas las validaciones eliminamos
     * la cuenta de Auth y luego aseguramos la baja de profiles.
     */
    const { error: errorDeleteAuth } =
      await adminClient.auth.admin.deleteUser(id)

    if (errorDeleteAuth) {
      throw new Error(
        errorDeleteAuth.message
      )
    }

    const { error: errorDeleteProfile } =
      await adminClient
        .from('profiles')
        .delete()
        .eq('id', id)

    if (errorDeleteProfile) {
      throw new Error(
        errorDeleteProfile.message
      )
    }

    revalidatePath('/admin/usuarios')
    redirect('/admin/usuarios')
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader
        rol={profile.rol}
        usuario={profile.nombre?.trim() || user.email || 'Administrador'}
        actual="ADMIN"
      />
      <div className="max-w-6xl mx-auto px-4 py-6 sm:p-8">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Usuarios
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Administrá usuarios, email de acceso, vendedor operativo, roles y accesos.
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
                Vendedor
              </label>

              <input
                type="text"
                name="vendedor"
                required
                placeholder="Nomenclatura exacta para Sheets"
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

                <option value="SUPERVISOR">
                  Supervisor
                </option>

                <option value="ADMIN">
                  Administrador
                </option>

                <option value="TERRENO">
                  Terreno
                </option>

                <option value="BBOO">
                  BBOO
                </option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 mt-4 text-sm text-gray-700">
            <input
              type="checkbox"
              name="puede_gestionar_ventas"
            />
            Habilitado para gestionar ventas
          </label>

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

        <div className="space-y-4">
          {usuarios &&
          usuarios.length > 0 ? (
            usuarios.map((usuario) => {
              const email =
                emailPorId.get(usuario.id) ?? ''

              return (
                <div
                  key={usuario.id}
                  className="bg-white border border-gray-200 rounded-xl p-4"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-2 mb-4">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {usuario.nombre}
                      </div>

                      <div className="text-sm text-gray-500">
                        {email || 'Email no disponible'}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span
                        className={
                          usuario.activo
                            ? 'px-2 py-1 rounded-full bg-green-50 text-green-700'
                            : 'px-2 py-1 rounded-full bg-gray-100 text-gray-500'
                        }
                      >
                        {usuario.activo
                          ? 'ACTIVO'
                          : 'INACTIVO'}
                      </span>

                      {usuario.puede_gestionar_ventas && (
                        <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                          GESTIONA VENTAS
                        </span>
                      )}

                      {usuario.debe_cambiar_password && (
                        <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700">
                          CAMBIO DE CLAVE PENDIENTE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* EDITAR / ACTIVAR */}
                  <form
                    action={actualizarUsuario}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1.4fr_1.4fr_160px_auto_auto_auto] gap-3 lg:items-end"
                  >
                    <input
                      type="hidden"
                      name="id"
                      value={usuario.id}
                    />

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Nombre
                      </label>

                      <input
                        type="text"
                        value={usuario.nombre ?? ''}
                        readOnly
                        aria-readonly="true"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Email / acceso
                      </label>

                      <input
                        type="email"
                        name="email"
                        defaultValue={email}
                        required
                        autoComplete="off"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Vendedor
                      </label>

                      <input
                        type="text"
                        name="vendedor"
                        defaultValue={
                          usuario.vendedor ?? ''
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

                        <option value="SUPERVISOR">
                          Supervisor
                        </option>

                        <option value="ADMIN">
                          Administrador
                        </option>

                        <option value="TERRENO">
                          Terreno
                        </option>

                        <option value="BBOO">
                          BBOO
                        </option>
                      </select>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-gray-700 lg:pb-2">
                      <input
                        type="checkbox"
                        name="activo"
                        defaultChecked={
                          usuario.activo
                        }
                      />

                      Activo
                    </label>

                    <label className="flex items-center gap-2 text-sm text-gray-700 lg:pb-2">
                      <input
                        type="checkbox"
                        name="puede_gestionar_ventas"
                        defaultChecked={
                          usuario.puede_gestionar_ventas
                        }
                      />

                      Gestiona ventas
                    </label>

                    <button
                      type="submit"
                      className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg"
                    >
                      Guardar
                    </button>
                  </form>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100">
                    {/* RESET PASSWORD */}
                    <form
                      action={resetearPassword}
                      className="flex flex-col sm:flex-row gap-2"
                    >
                      <input
                        type="hidden"
                        name="id"
                        value={usuario.id}
                      />

                      <input
                        type="password"
                        name="password_temporal"
                        minLength={6}
                        required
                        placeholder="Nueva contraseña temporal"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                      />

                      <button
                        type="submit"
                        className="border border-amber-300 text-amber-700 hover:bg-amber-50 font-medium px-4 py-2 rounded-lg"
                      >
                        Resetear contraseña
                      </button>
                    </form>

                    {/* ELIMINAR */}
                    {usuario.id === user.id ? (
                      <div className="text-xs text-gray-400 flex items-center">
                        Usuario administrador actualmente conectado. No puede eliminarse.
                      </div>
                    ) : usuario.activo ? (
                      <div className="text-xs text-gray-400 flex items-center">
                        Para eliminarlo definitivamente, primero debe quedar INACTIVO.
                      </div>
                    ) : actividadPorId.get(usuario.id) ? (
                      <div className="text-xs text-amber-700 flex items-center">
                        Tiene actividad o historial asociado. Debe conservarse INACTIVO.
                      </div>
                    ) : (
                      <form
                        action={eliminarUsuario}
                        className="flex flex-col sm:flex-row gap-2"
                      >
                        <input
                          type="hidden"
                          name="id"
                          value={usuario.id}
                        />

                        <input
                          type="text"
                          name="confirmar"
                          required
                          placeholder='Escribí ELIMINAR'
                          className="flex-1 border border-red-200 rounded-lg px-3 py-2 bg-white text-gray-900"
                        />

                        <button
                          type="submit"
                          className="border border-red-300 text-red-700 hover:bg-red-50 font-medium px-4 py-2 rounded-lg"
                        >
                          Eliminar usuario
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
              No hay usuarios registrados.
            </div>
          )}
        </div>

      </div>
    </main>
  )
}
