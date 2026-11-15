import EliminarPuntoVenta from '@/components/admin/EliminarPuntoVenta'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import AppHeader from '../../../components/AppHeader'
import { createClient } from '../../../utils/supabase/server'
import { createAdminClient } from '../../../utils/supabase/admin'


async function actualizarPuntoVenta(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, activo')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.activo || profile.rol !== 'ADMIN') {
    redirect('/ventas')
  }

  const id = String(formData.get('id') ?? '').trim()
  const nombre = String(formData.get('nombre') ?? '').trim()
  const razon_social = String(formData.get('razon_social') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const direccion = String(formData.get('direccion') ?? '').trim()
  const provincia = String(formData.get('provincia') ?? '').trim()
  const ciudad = String(formData.get('ciudad') ?? '').trim()
  const activo = formData.get('activo') === 'on'

  if (!id || !nombre) {
    throw new Error('El Nombre del PDV es obligatorio.')
  }

  const { data, error } = await supabase
    .from('puntos_venta')
    .update({
      nombre,
      razon_social: razon_social || null,
      email: email || null,
      direccion: direccion || null,
      provincia: provincia || null,
      ciudad: ciudad || null,
      activo,
    })
    .eq('id', id)
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(
      `No se pudo actualizar el Punto de Venta: ${error?.message ?? 'Registro no encontrado'}`
    )
  }

  revalidatePath('/admin/puntos-venta')
}




async function eliminarPuntoVenta(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, activo')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.activo || profile.rol !== 'ADMIN') {
    throw new Error('No tenés permisos para eliminar Puntos de Venta.')
  }

  const id = String(formData.get('id') ?? '').trim()

  if (!id) {
    throw new Error('No se identificó el Punto de Venta.')
  }

  const { data: pdv, error: errorPDV } = await supabase
    .from('puntos_venta')
    .select('id, nombre, activo')
    .eq('id', id)
    .single()

  if (errorPDV || !pdv) {
    throw new Error('No se encontró el Punto de Venta.')
  }

  if (pdv.activo) {
    throw new Error(
      'Primero debés desactivar el Punto de Venta.'
    )
  }

  const confirmacion = String(
    formData.get('confirmacion') ?? ''
  ).trim()

  if (confirmacion !== pdv.nombre) {
    throw new Error(
      'La confirmación no coincide con el nombre del Punto de Venta.'
    )
  }


  const { count: asesores, error: errorAsesores } = await supabase
    .from('asesores_pdv')
    .select('id', { count: 'exact', head: true })
    .eq('punto_venta_id', id)

  if (errorAsesores || asesores === null) {
    throw new Error('No se pudo verificar los asesores asociados.')
  }

  const { count: equivalencias, error: errorEquivalencias } = await supabase
    .from('equivalencias_pdv')
    .select('id', { count: 'exact', head: true })
    .eq('punto_venta_id', id)

  if (errorEquivalencias || equivalencias === null) {
    throw new Error('No se pudo verificar las equivalencias asociadas.')
  }

  if (asesores > 0 || equivalencias > 0) {
    throw new Error(
      'No se puede eliminar un PDV con asesores o equivalencias asociadas.'
    )
  }

  const { data, error } = await supabase
    .from('puntos_venta')
    .delete()
    .eq('id', id)
    .eq('activo', false)
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(
      `No se pudo eliminar el PDV: ${error?.message ?? 'Registro no encontrado'}`
    )
  }

  revalidatePath('/admin/puntos-venta')
}

async function crearPuntoVenta(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, activo')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.activo || profile.rol !== 'ADMIN') {
    throw new Error('No tenés permisos para crear Puntos de Venta.')
  }

  const nombre = String(formData.get('nombre') ?? '').trim()
  const razon_social = String(formData.get('razon_social') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const direccion = String(formData.get('direccion') ?? '').trim()
  const provincia = String(formData.get('provincia') ?? '').trim()
  const ciudad = String(formData.get('ciudad') ?? '').trim()

  if (!nombre) {
    throw new Error('El nombre del PDV es obligatorio.')
  }

  const { error } = await supabase
    .from('puntos_venta')
    .insert({
      nombre,
      razon_social: razon_social || null,
      email: email || null,
      direccion: direccion || null,
      provincia: provincia || null,
      ciudad: ciudad || null,
      activo: true,
    })

  if (error) {
    throw new Error(`No se pudo crear el PDV: ${error.message}`)
  }

  revalidatePath('/admin/puntos-venta')
}



async function darBajaAsesor(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, activo')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.activo || profile.rol !== 'ADMIN') {
    throw new Error('No tenés permisos para dar de baja asesores.')
  }

  const id = String(formData.get('id') ?? '').trim()
  const fecha_baja = String(formData.get('fecha_baja') ?? '').trim()

  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_baja)) {
    throw new Error('Indicá una fecha de baja válida.')
  }

  const { data: asesor, error: errorConsulta } = await supabase
    .from('asesores_pdv')
    .select('id, activo, fecha_alta')
    .eq('id', id)
    .single()

  if (errorConsulta || !asesor) {
    throw new Error('No se encontró el asesor.')
  }

  if (!asesor.activo) {
    throw new Error('El asesor ya está dado de baja.')
  }

  if (fecha_baja < asesor.fecha_alta) {
    throw new Error(
      'La fecha de baja no puede ser anterior a la fecha de alta.'
    )
  }

  const { data, error } = await supabase
    .from('asesores_pdv')
    .update({
      activo: false,
      fecha_baja,
    })
    .eq('id', id)
    .eq('activo', true)
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(
      `No se pudo dar de baja al asesor: ${error?.message ?? 'Registro no encontrado'}`
    )
  }

  revalidatePath('/admin/puntos-venta')
}

async function actualizarAsesor(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, activo')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.activo || profile.rol !== 'ADMIN') {
    throw new Error('No tenés permisos para modificar asesores.')
  }

  const id = String(formData.get('id') ?? '').trim()
  const entidad_asesor = String(formData.get('entidad_asesor') ?? '').trim()
  const nombre = String(formData.get('nombre') ?? '').trim()
  const dni = String(formData.get('dni') ?? '').trim()

  if (!id || !entidad_asesor || !nombre) {
    throw new Error('Completá el nombre y la entidad del asesor.')
  }

  const { data: asesorActual, error: errorConsulta } = await supabase
    .from('asesores_pdv')
    .select('id, activo')
    .eq('id', id)
    .single()

  if (errorConsulta || !asesorActual) {
    throw new Error('No se encontró el asesor.')
  }

  if (!asesorActual.activo) {
    throw new Error('No se puede modificar un asesor dado de baja.')
  }

  const { data, error } = await supabase
    .from('asesores_pdv')
    .update({
      entidad_asesor,
      nombre,
      dni: dni || null,
    })
    .eq('id', id)
    .eq('activo', true)
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(
      `No se pudo actualizar el asesor: ${error?.message ?? 'Registro no encontrado'}`
    )
  }

  revalidatePath('/admin/puntos-venta')
}

async function crearAsesor(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, activo')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.activo || profile.rol !== 'ADMIN') {
    redirect('/ventas')
  }

  const punto_venta_id = String(formData.get('punto_venta_id') ?? '').trim()
  const entidad_asesor = String(formData.get('entidad_asesor') ?? '').trim()
  const nombre = String(formData.get('nombre') ?? '').trim()
  const dni = String(formData.get('dni') ?? '').trim()
  const fecha_alta = String(formData.get('fecha_alta') ?? '').trim()

  if (!punto_venta_id || !entidad_asesor || !nombre) {
    throw new Error('Completá el PDV, la entidad asesor y el nombre.')
  }

  if (fecha_alta && !/^\d{4}-\d{2}-\d{2}$/.test(fecha_alta)) {
    throw new Error('La fecha de alta no es válida.')
  }

  const { error } = await supabase
    .from('asesores_pdv')
    .insert({
      punto_venta_id,
      entidad_asesor,
      nombre,
      dni: dni || null,
      activo: true,
      ...(fecha_alta ? { fecha_alta } : {}),
    })

  if (error) {
    throw new Error(`No se pudo crear el asesor: ${error.message}`)
  }

  revalidatePath('/admin/puntos-venta')
}

export default async function PuntosVentaPage() {
  const supabaseAuth = await createClient()

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('nombre, rol, activo')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.activo || profile.rol !== 'ADMIN') {
    redirect('/ventas')
  }

  const supabase = createAdminClient()

  const { data: puntosVenta, error } = await supabase
    .from('puntos_venta')
    .select('id, nombre, razon_social, email, direccion, ciudad, provincia, activo')
    .order('nombre', { ascending: true })

  if (error) {
    throw new Error(`No se pudieron cargar los Puntos de Venta: ${error.message}`)
  }

  const { data: asesores, error: errorAsesores } = await supabase
    .from('asesores_pdv')
    .select('id, punto_venta_id, entidad_asesor, nombre, dni, activo, fecha_alta, fecha_baja')

  if (errorAsesores) {
    throw new Error(`No se pudieron cargar los asesores: ${errorAsesores.message}`)
  }


  const { data: equivalenciasPDV, error: errorEquivalenciasPDV } =
    await supabase
      .from('equivalencias_pdv')
      .select('punto_venta_id')

  if (errorEquivalenciasPDV) {
    throw new Error(
      `No se pudieron consultar las equivalencias: ${errorEquivalenciasPDV.message}`
    )
  }

  const nombreUsuario = profile.nombre?.trim() || user.email || 'Administrador'

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader rol={profile.rol} usuario={nombreUsuario} actual="ADMIN" />

      <div className="mx-auto max-w-6xl px-4 py-6 sm:p-8">
        <a
          href="/admin"
          className="text-sm font-semibold text-red-600 hover:text-red-700"
        >
          ← Volver a ADMIN
        </a>

        <h1 className="mt-4 text-2xl font-bold text-gray-900">
          Administración de Puntos de Venta
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          Establecimientos y asesores registrados en PGL.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">Puntos de Venta</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {puntosVenta?.length ?? 0}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">PDV activos</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {(puntosVenta ?? []).filter(pdv => pdv.activo).length}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">Asesores registrados</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {asesores?.length ?? 0}
            </div>
          </div>
        </div>

        <section className="mt-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Administración de establecimientos
          </h2>

          {(puntosVenta ?? []).map(pdv => {
            const cantidadAsesores = (asesores ?? []).filter(
              asesor => asesor.punto_venta_id === pdv.id
            ).length

const cantidadEquivalencias = (equivalenciasPDV ?? []).filter(
  equivalencia => equivalencia.punto_venta_id === pdv.id
).length

const puedeEliminar =
  !pdv.activo &&
  cantidadAsesores === 0 &&
  cantidadEquivalencias === 0

            return (
              <div key={pdv.id}>
                <form
                  action={actualizarPuntoVenta}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <input type="hidden" name="id" value={pdv.id} />

                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold text-gray-900">
                    {pdv.nombre}
                  </h3>
                  <span className="text-sm text-gray-500">
                    {cantidadAsesores} asesores registrados
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Nombre del PDV
                    <input
                      name="nombre"
                      defaultValue={pdv.nombre}
                      required
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                    />
                  </label>

                  <label className="block text-sm font-medium text-gray-700">
                    Razón social
                    <input
                      name="razon_social"
                      defaultValue={pdv.razon_social ?? ''}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                    />
                  </label>

                  <label className="block text-sm font-medium text-gray-700">
                    Correo electrónico
                    <input
                      name="email"
                      type="email"
                      defaultValue={pdv.email ?? ''}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                    />
                  </label>

                  <label className="block text-sm font-medium text-gray-700">
                    Dirección
                    <input
                      name="direccion"
                      defaultValue={pdv.direccion ?? ''}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                    />
                  </label>

                  <label className="block text-sm font-medium text-gray-700">
                    Provincia
                    <input
                      name="provincia"
                      defaultValue={pdv.provincia ?? ''}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                    />
                  </label>

                  <label className="block text-sm font-medium text-gray-700">
                    Ciudad
                    <input
                      name="ciudad"
                      defaultValue={pdv.ciudad ?? ''}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                    />
                  </label>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      name="activo"
                      defaultChecked={Boolean(pdv.activo)}
                      className="h-4 w-4"
                    />
                    PDV activo
                  </label>

                  <button
                    type="submit"
                    className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    Guardar cambios
                  </button>
                </div>
              </form>

              {puedeEliminar && (
                <EliminarPuntoVenta
                  id={pdv.id}
                  nombre={pdv.nombre}
                  eliminar={eliminarPuntoVenta}
                />
              )}
            </div>
            )
          })}

          {(puntosVenta ?? []).length === 0 && (
            <p className="rounded-xl border bg-white p-6 text-sm text-gray-500">
              No hay Puntos de Venta registrados.
            </p>
          )}
        </section>

        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            Alta de Punto de Venta
          </h2>

          <p className="mb-5 text-sm text-gray-500">
            Incorporá un nuevo establecimiento a la red comercial.
            Los códigos de Claro se administrarán en Equivalencias Claro.
          </p>

          <form action={crearPuntoVenta} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-gray-700">
              Nombre del PDV *
              <input
                name="nombre"
                required
                placeholder="Nombre del establecimiento"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Razón social
              <input
                name="razon_social"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Email
              <input
                name="email"
                type="email"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Dirección
              <input
                name="direccion"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Provincia
              <input
                name="provincia"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Ciudad
              <input
                name="ciudad"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
              />
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Agregar Punto de Venta
              </button>
            </div>
          </form>
        </section>


        <section className="mt-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Administración de asesores por PDV
          </h2>

          {(puntosVenta ?? []).map(pdv => {
            const asesoresDelPDV = (asesores ?? []).filter(
              asesor => asesor.punto_venta_id === pdv.id
            )

            return (
              <div
                key={pdv.id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-gray-900">
                    {pdv.nombre}
                  </h3>
                  <span className="text-sm text-gray-500">
                    {asesoresDelPDV.length} asesores registrados
                  </span>
                </div>

                {asesoresDelPDV.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No hay asesores registrados en este establecimiento.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b bg-gray-50 text-gray-600">
                        <tr>
                          <th className="p-3">Asesor</th>
                          <th className="p-3">Entidad asesor</th>
                          <th className="p-3">DNI</th>
                          <th className="p-3">Fecha alta</th>
                          <th className="p-3">Fecha baja</th>
                          <th className="p-3">Estado</th>
                          <th className="p-3">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {asesoresDelPDV.map(asesor => {
                          const formularioId = `editar-asesor-${asesor.id}`

                          return (
                            <tr key={asesor.id} className="border-b last:border-0">
                              <td className="p-3">
                                <form
                                  id={formularioId}
                                  action={actualizarAsesor}
                                >
                                  <input
                                    type="hidden"
                                    name="id"
                                    value={asesor.id}
                                  />
                                </form>
                                <input
                                  form={formularioId}
                                  name="nombre"
                                  required
                                  defaultValue={asesor.nombre}
                                  disabled={!asesor.activo}
                                  aria-label="Nombre del asesor"
                                  className="w-full min-w-40 rounded-lg border border-gray-300 px-2 py-2 text-gray-900 disabled:bg-gray-100"
                                />
                              </td>

                              <td className="p-3">
                                <input
                                  form={formularioId}
                                  name="entidad_asesor"
                                  required
                                  defaultValue={asesor.entidad_asesor}
                                  disabled={!asesor.activo}
                                  aria-label="Entidad asesor"
                                  className="w-full min-w-28 rounded-lg border border-gray-300 px-2 py-2 text-gray-900 disabled:bg-gray-100"
                                />
                              </td>

                              <td className="p-3">
                                <input
                                  form={formularioId}
                                  name="dni"
                                  inputMode="numeric"
                                  defaultValue={asesor.dni ?? ''}
                                  disabled={!asesor.activo}
                                  aria-label="DNI del asesor"
                                  className="w-full min-w-28 rounded-lg border border-gray-300 px-2 py-2 text-gray-900 disabled:bg-gray-100"
                                />
                              </td>

                              <td className="p-3">
                                {asesor.fecha_alta}
                              </td>

                              <td className="p-3">
                                {asesor.fecha_baja || '—'}
                              </td>

                              <td className="p-3">
                                {asesor.activo ? 'Activo' : 'Inactivo'}
                              </td>

                              <td className="p-3">
                                <button
                                  form={formularioId}
                                  type="submit"
                                  disabled={!asesor.activo}
                                  className="whitespace-nowrap rounded-lg bg-red-600 px-3 py-2 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                                >
                                  Guardar cambios
                                </button>

                                {asesor.activo && (
                                  <form
                                    action={darBajaAsesor}
                                    className="mt-3 flex flex-col gap-2"
                                  >
                                    <input
                                      type="hidden"
                                      name="id"
                                      value={asesor.id}
                                    />

                                    <label className="text-xs text-gray-600">
                                      Fecha de baja
                                      <input
                                        type="date"
                                        name="fecha_baja"
                                        required
                                        min={asesor.fecha_alta}
                                        defaultValue={new Date().toLocaleDateString(
                                          'en-CA',
                                          {
                                            timeZone: 'America/Argentina/Buenos_Aires',
                                          }
                                        )}
                                        className="mt-1 block rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
                                      />
                                    </label>

                                    <button
                                      type="submit"
                                      className="rounded-lg border border-red-600 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                                    >
                                      Dar de baja
                                    </button>
                                  </form>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </section>

        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Alta de asesor
          </h2>

          <p className="mt-1 mb-5 text-sm text-gray-500">
            Incorporá un asesor a un Punto de Venta. Para trasladar un asesor,
            registrá primero su baja en el establecimiento anterior.
          </p>

          <form action={crearAsesor} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-gray-700">
              Punto de Venta
              <select
                name="punto_venta_id"
                required
                defaultValue=""
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
              >
                <option value="" disabled>Seleccionar PDV</option>
                {(puntosVenta ?? []).filter(pdv => pdv.activo).map(pdv => (
                  <option key={pdv.id} value={pdv.id}>
                    {pdv.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Entidad asesor
              <input
                name="entidad_asesor"
                required
                placeholder="Ej.: 400389"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Nombre del asesor
              <input
                name="nombre"
                required
                placeholder="Nombre y apellido"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              DNI
              <input
                name="dni"
                inputMode="numeric"
                placeholder="Número de documento"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Fecha de alta
              <input
                name="fecha_alta"
                type="date"
                required
                defaultValue={new Date().toLocaleDateString('en-CA', {
                  timeZone: 'America/Argentina/Buenos_Aires'
                })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
              />
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 md:w-auto"
              >
                Agregar asesor
              </button>
            </div>
          </form>
        </section>

      </div>
    </main>
  )
}
