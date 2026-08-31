import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '../../../../utils/supabase/server'
import AppHeader from '../../../../components/AppHeader'

type Params = Promise<{ id: string }>
type SearchParams = Promise<{ ok?: string; error?: string }>

function mostrar(v: unknown) {
  if (v === null || v === undefined || v === '') return '-'
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  return String(v)
}

function fechaArgentina(fecha: string | null) {
  if (!fecha) return '-'
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(fecha))
}

function normalizar(valor: FormDataEntryValue | null) {
  const texto = String(valor ?? '').trim()
  return texto || null
}

function validarTelefono(valor: string) {
  return /^[1-46-9][0-9]{9}$/.test(valor)
}

function validarTelefonoOpcional(valor: string) {
  return !valor || validarTelefono(valor)
}

function Campo({
  label,
  value,
  ancho = false,
}: {
  label: string
  value: unknown
  ancho?: boolean
}) {
  return (
    <div className={ancho ? 'sm:col-span-2' : ''}>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </div>
      <div className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">
        {mostrar(value)}
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-red-500'

export default async function SuperPedidoDetalle({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre,rol,activo')
    .eq('id', user.id)
    .single()

  if (!profile?.activo) redirect('/login')
  if (!['ADMIN', 'SUPERVISOR'].includes(profile.rol)) redirect('/ventas')

  const { id } = await params
  const pedidoId = Number(id)
  if (!Number.isInteger(pedidoId)) notFound()

  const sp = await searchParams

  async function guardarGestion(formData: FormData) {
    'use server'

    const supabaseAction = await createClient()
    const {
      data: { user: actionUser },
    } = await supabaseAction.auth.getUser()

    if (!actionUser) redirect('/login')

    const { data: actionProfile } = await supabaseAction
      .from('profiles')
      .select('rol,activo')
      .eq('id', actionUser.id)
      .single()

    if (!actionProfile?.activo) redirect('/login')
    if (!['ADMIN', 'SUPERVISOR'].includes(actionProfile.rol)) redirect('/ventas')

    const telefono = String(formData.get('telefono') ?? '').replace(/\D/g, '')
    const telefonoAdm = String(formData.get('telefono_adm') ?? '').replace(/\D/g, '')
    const telefonoEnc = String(formData.get('telefono_enc') ?? '').replace(/\D/g, '')

    if (!validarTelefono(telefono)) {
      redirect(
        `/super/pedidos/${pedidoId}?error=${encodeURIComponent(
          'El teléfono debe tener exactamente 10 dígitos y no puede comenzar con 0 ni 5.'
        )}`
      )
    }

    if (
      !validarTelefonoOpcional(telefonoAdm) ||
      !validarTelefonoOpcional(telefonoEnc)
    ) {
      redirect(
        `/super/pedidos/${pedidoId}?error=${encodeURIComponent(
          'Los teléfonos de Administrador y Encargado, si se informan, deben tener 10 dígitos y no comenzar con 0 ni 5.'
        )}`
      )
    }

    const estadoRaw = String(formData.get('estado_pedido_id') ?? '').trim()

    const { error: rpcError } = await supabaseAction.rpc('gestionar_pedido_completo', {
      p_pedido_id: pedidoId,
      p_dni: normalizar(formData.get('dni')),
      p_telefono: telefono,
      p_domicilio: normalizar(formData.get('domicilio')),
      p_tipo_domicilio: normalizar(formData.get('tipo_domicilio')),
      p_nombre_edificio: normalizar(formData.get('nombre_edificio')),
      p_cant_unidades_f: normalizar(formData.get('cant_unidades_f')),
      p_cant_pisos: normalizar(formData.get('cant_pisos')),
      p_cant_torres: normalizar(formData.get('cant_torres')),
      p_administrador: normalizar(formData.get('administrador')),
      p_telefono_adm: telefonoAdm || null,
      p_correo_adm: normalizar(formData.get('correo_adm')),
      p_encargado: normalizar(formData.get('encargado')),
      p_telefono_enc: telefonoEnc || null,
      p_correo_enc: normalizar(formData.get('correo_enc')),
      p_observaciones_vendedor: normalizar(formData.get('observaciones_vendedor')),
      p_permisos_acceso: normalizar(formData.get('permisos_acceso')),
      p_planos: normalizar(formData.get('planos')),
      p_cant_preventas: normalizar(formData.get('cant_preventas')),
      p_wo: normalizar(formData.get('wo')),
      p_observaciones_gestion: normalizar(formData.get('observaciones_gestion')),
      p_fecha_ok: normalizar(formData.get('fecha_ok')),
      p_estado_pedido_id: estadoRaw ? Number(estadoRaw) : null,
    })

    if (rpcError) {
      redirect(
        `/super/pedidos/${pedidoId}?error=${encodeURIComponent(rpcError.message)}`
      )
    }

    revalidatePath(`/super/pedidos/${pedidoId}`)
    revalidatePath('/super/pedidos')
    redirect(`/super/pedidos/${pedidoId}?ok=1`)
  }

  async function tomarPedido() {
    'use server'

    const supabaseAction = await createClient()
    const {
      data: { user: actionUser },
    } = await supabaseAction.auth.getUser()

    if (!actionUser) redirect('/login')

    const { data: actionProfile } = await supabaseAction
      .from('profiles')
      .select('rol,activo')
      .eq('id', actionUser.id)
      .single()

    if (!actionProfile?.activo) redirect('/login')
    if (!['ADMIN', 'SUPERVISOR'].includes(actionProfile.rol)) redirect('/ventas')

    const { error: rpcError } = await supabaseAction.rpc('tomar_pedido', {
      p_pedido_id: pedidoId,
    })

    if (rpcError) {
      redirect(
        `/super/pedidos/${pedidoId}?error=${encodeURIComponent(rpcError.message)}`
      )
    }

    revalidatePath(`/super/pedidos/${pedidoId}`)
    revalidatePath('/super/pedidos')
    redirect(`/super/pedidos/${pedidoId}?ok=tomado`)
  }

  const { data: p, error } = await supabase
    .from('pedidos')
    .select(`
      id,codigo,marca_temporal,tipo_pedido_id,vendedor_id,responsable_id,dni,telefono,
      domicilio,tipo_domicilio,nombre_edificio,cant_unidades_f,cant_pisos,cant_torres,
      administrador,telefono_adm,correo_adm,encargado,telefono_enc,correo_enc,
      observaciones_vendedor,permisos_acceso,planos,cant_preventas,wo,
      observaciones_gestion,fecha_ok,fecha_gestion,estado_pedido_id,created_at,updated_at
    `)
    .eq('id', pedidoId)
    .maybeSingle()

  if (error) throw new Error(`No se pudo cargar el Pedido: ${error.message}`)
  if (!p) notFound()

  const [
    { data: tipo },
    { data: estados },
    { data: perfiles },
    { data: historialGeneral, error: hgError },
    { data: historialEstados, error: heError },
  ] = await Promise.all([
    supabase
      .from('tipos_pedido')
      .select('id,codigo,nombre')
      .eq('id', p.tipo_pedido_id)
      .maybeSingle(),
    supabase
      .from('estados_pedido')
      .select('id,codigo,nombre,tipo_estado,activo,tipo_pedido_id')
      .order('orden'),
    supabase.from('profiles').select('id,nombre,vendedor'),
    supabase
      .from('historial_pedidos')
      .select('*')
      .eq('pedido_id', pedidoId)
      .order('created_at', { ascending: false }),
    supabase
      .from('historial_estados_pedidos')
      .select('*')
      .eq('pedido_id', pedidoId)
      .order('created_at', { ascending: false }),
  ])

  if (hgError) {
    throw new Error(`No se pudo cargar el historial del Pedido: ${hgError.message}`)
  }
  if (heError) {
    throw new Error(`No se pudo cargar el historial de estados: ${heError.message}`)
  }

  const perfilMap = new Map((perfiles ?? []).map((x: any) => [String(x.id), x]))
  const estadoMap = new Map((estados ?? []).map((x: any) => [String(x.id), x]))

  const perfil = (id: string | null) => {
    if (!id) return 'Sin asignar'
    const x: any = perfilMap.get(String(id))
    return x?.vendedor || x?.nombre || 'Usuario no disponible'
  }

  const estado = (id: number | null) =>
    id ? (estadoMap.get(String(id)) as any)?.nombre || `Estado ${id}` : '-'

  const estadosDisponibles = (estados ?? []).filter(
    (e: any) =>
      Number(e.tipo_pedido_id) === Number(p.tipo_pedido_id) &&
      (e.activo || Number(e.id) === Number(p.estado_pedido_id))
  )

  const esRellamado = tipo?.codigo === 'RELLAMADO_VENTA_GESTION'

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader
        rol={profile.rol}
        usuario={profile.nombre?.trim() || user.email || 'Usuario'}
        actual="SUPER"
      />

      <div className="mx-auto max-w-6xl p-4 sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Detalle de Pedido</h1>
            <p className="mt-1 text-sm text-gray-500">
              {p.codigo || `Pedido #${p.id}`} · {tipo?.nombre || '-'}
            </p>
          </div>

          <a
            href="/super/pedidos"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Volver a Pedidos
          </a>
        </div>

        {sp.ok ? (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {sp.ok === 'tomado'
              ? 'Pedido asignado correctamente.'
              : 'Gestión guardada correctamente.'}
          </div>
        ) : null}

        {sp.error ? (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {sp.error}
          </div>
        ) : null}

        <div className="space-y-5">
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Pedido</h2>
              <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                SUPER · gestión habilitada
              </span>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Campo label="Fecha / Hora" value={fechaArgentina(p.marca_temporal)} />
              <Campo label="Tipo" value={tipo?.nombre} />
              <Campo label="Vendedor" value={perfil(p.vendedor_id)} />
              <Campo label="Responsable" value={perfil(p.responsable_id)} />
            </div>

            {!p.responsable_id ? (
              <form action={tomarPedido} className="mt-5 border-t border-gray-100 pt-4">
                <button
                  type="submit"
                  className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                >
                  Tomar Pedido
                </button>
              </form>
            ) : null}
          </section>

          <form action={guardarGestion} className="space-y-5">
            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Datos del Pedido
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">DNI</span>
                  <input name="dni" defaultValue={p.dni || ''} className={inputClass} />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">
                    Teléfono *
                  </span>
                  <input
                    required
                    name="telefono"
                    inputMode="numeric"
                    maxLength={10}
                    defaultValue={p.telefono || ''}
                    className={inputClass}
                  />
                </label>

                {!esRellamado ? (
                  <>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Tipo domicilio
                      </span>
                      <select
                        name="tipo_domicilio"
                        defaultValue={p.tipo_domicilio || ''}
                        className={inputClass}
                      >
                        <option value="">Seleccionar...</option>
                        <option value="CASA">Casa</option>
                        <option value="EDIFICIO">Edificio</option>
                        <option value="BARRIO_CERRADO">Barrio Cerrado</option>
                        <option value="BARRIO_ABIERTO">Barrio Abierto</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Domicilio
                      </span>
                      <input
                        name="domicilio"
                        defaultValue={p.domicilio || ''}
                        className={inputClass}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Nombre edificio
                      </span>
                      <input
                        name="nombre_edificio"
                        defaultValue={p.nombre_edificio || ''}
                        className={inputClass}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Cant. unidades F
                      </span>
                      <input
                        name="cant_unidades_f"
                        defaultValue={p.cant_unidades_f || ''}
                        className={inputClass}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Cant. pisos
                      </span>
                      <input
                        name="cant_pisos"
                        defaultValue={p.cant_pisos || ''}
                        className={inputClass}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Cant. torres
                      </span>
                      <input
                        name="cant_torres"
                        defaultValue={p.cant_torres || ''}
                        className={inputClass}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Administrador
                      </span>
                      <input
                        name="administrador"
                        defaultValue={p.administrador || ''}
                        className={inputClass}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Teléfono administrador
                      </span>
                      <input
                        name="telefono_adm"
                        inputMode="numeric"
                        maxLength={10}
                        defaultValue={p.telefono_adm || ''}
                        className={inputClass}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Correo administrador
                      </span>
                      <input
                        type="email"
                        name="correo_adm"
                        defaultValue={p.correo_adm || ''}
                        className={inputClass}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Encargado
                      </span>
                      <input
                        name="encargado"
                        defaultValue={p.encargado || ''}
                        className={inputClass}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Teléfono encargado
                      </span>
                      <input
                        name="telefono_enc"
                        inputMode="numeric"
                        maxLength={10}
                        defaultValue={p.telefono_enc || ''}
                        className={inputClass}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Correo encargado
                      </span>
                      <input
                        type="email"
                        name="correo_enc"
                        defaultValue={p.correo_enc || ''}
                        className={inputClass}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Permisos acceso
                      </span>
                      <input
                        name="permisos_acceso"
                        defaultValue={p.permisos_acceso || ''}
                        className={inputClass}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Planos
                      </span>
                      <input
                        name="planos"
                        defaultValue={p.planos || ''}
                        className={inputClass}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Cant. preventas
                      </span>
                      <input
                        name="cant_preventas"
                        defaultValue={p.cant_preventas || ''}
                        className={inputClass}
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <input
                      type="hidden"
                      name="tipo_domicilio"
                      value={p.tipo_domicilio || ''}
                    />
                    <input type="hidden" name="domicilio" value={p.domicilio || ''} />
                    <input
                      type="hidden"
                      name="nombre_edificio"
                      value={p.nombre_edificio || ''}
                    />
                    <input
                      type="hidden"
                      name="cant_unidades_f"
                      value={p.cant_unidades_f || ''}
                    />
                    <input
                      type="hidden"
                      name="cant_pisos"
                      value={p.cant_pisos || ''}
                    />
                    <input
                      type="hidden"
                      name="cant_torres"
                      value={p.cant_torres || ''}
                    />
                    <input
                      type="hidden"
                      name="administrador"
                      value={p.administrador || ''}
                    />
                    <input
                      type="hidden"
                      name="telefono_adm"
                      value={p.telefono_adm || ''}
                    />
                    <input
                      type="hidden"
                      name="correo_adm"
                      value={p.correo_adm || ''}
                    />
                    <input
                      type="hidden"
                      name="encargado"
                      value={p.encargado || ''}
                    />
                    <input
                      type="hidden"
                      name="telefono_enc"
                      value={p.telefono_enc || ''}
                    />
                    <input
                      type="hidden"
                      name="correo_enc"
                      value={p.correo_enc || ''}
                    />
                    <input
                      type="hidden"
                      name="permisos_acceso"
                      value={p.permisos_acceso || ''}
                    />
                    <input type="hidden" name="planos" value={p.planos || ''} />
                    <input
                      type="hidden"
                      name="cant_preventas"
                      value={p.cant_preventas || ''}
                    />
                  </>
                )}

                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-gray-700">
                    Observaciones vendedor
                  </span>
                  <textarea
                    name="observaciones_vendedor"
                    rows={4}
                    defaultValue={p.observaciones_vendedor || ''}
                    className={inputClass}
                  />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Gestión</h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">
                    Estado
                  </span>
                  <select
                    name="estado_pedido_id"
                    defaultValue={p.estado_pedido_id ?? ''}
                    className={inputClass}
                  >
                    <option value="">Sin calificar</option>
                    {estadosDisponibles.map((e: any) => (
                      <option key={e.id} value={e.id}>
                        {e.nombre}
                        {!e.activo ? ' (inactivo)' : ''}
                      </option>
                    ))}
                  </select>
                </label>

                {esRellamado ? (
                  <input type="hidden" name="wo" value={p.wo || ''} />
                ) : (
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">WO</span>
                    <input name="wo" defaultValue={p.wo || ''} className={inputClass} />
                  </label>
                )}

                {esRellamado ? (
                  <>
                    <input
                      type="hidden"
                      name="fecha_ok"
                      value={p.fecha_ok ? String(p.fecha_ok).slice(0, 10) : ''}
                    />
                    <div className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Fecha Gestión
                      </span>
                      <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700">
                        {p.fecha_gestion
                          ? new Intl.DateTimeFormat('es-AR', {
                              timeZone: 'America/Argentina/Buenos_Aires',
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: false,
                            }).format(new Date(p.fecha_gestion))
                          : 'Se registra automáticamente al establecer el Estado'}
                      </div>
                    </div>
                  </>
                ) : (
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">
                      Fecha OK
                    </span>
                    <input
                      type="date"
                      name="fecha_ok"
                      defaultValue={p.fecha_ok ? String(p.fecha_ok).slice(0, 10) : ''}
                      className={inputClass}
                    />
                  </label>
                )}

                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-gray-700">
                    Observaciones gestión
                  </span>
                  <textarea
                    name="observaciones_gestion"
                    rows={4}
                    defaultValue={p.observaciones_gestion || ''}
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="mt-5 flex justify-end border-t border-gray-100 pt-4">
                <button
                  type="submit"
                  className="rounded-lg bg-red-600 px-5 py-2.5 font-semibold text-white hover:bg-red-700"
                >
                  Guardar gestión
                </button>
              </div>
            </section>
          </form>

          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Historial de estados
            </h2>

            {(historialEstados ?? []).length === 0 ? (
              <div className="text-sm text-gray-500">
                Sin cambios de estado registrados.
              </div>
            ) : (
              <div className="space-y-3">
                {(historialEstados ?? []).map((h: any) => (
                  <div
                    key={h.id}
                    className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex justify-between gap-3">
                      <div className="font-semibold text-gray-900">Estado</div>
                      <div className="text-xs text-gray-500">
                        {fechaArgentina(h.created_at)}
                      </div>
                    </div>

                    <div className="mt-2 text-sm text-gray-700">
                      {h.estado_anterior_nombre || estado(h.estado_anterior_id)} →{' '}
                      <b>{h.estado_nuevo_nombre || estado(h.estado_nuevo_id)}</b>
                    </div>

                    {h.observacion ? (
                      <div className="mt-2 text-sm text-gray-600">
                        Observación: {h.observacion}
                      </div>
                    ) : null}

                    <div className="mt-1 text-xs text-gray-500">
                      {h.actor_nombre || perfil(h.actor_user_id)}
                      {h.actor_rol ? ` · ${h.actor_rol}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Historial general
            </h2>

            {(historialGeneral ?? []).length === 0 ? (
              <div className="text-sm text-gray-500">
                Sin cambios generales registrados.
              </div>
            ) : (
              <div className="space-y-3">
                {(historialGeneral ?? []).map((h: any) => (
                  <div
                    key={h.id}
                    className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex justify-between gap-3">
                      <div className="font-semibold text-gray-900">
                        {h.campo || h.evento || 'Modificación'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {fechaArgentina(h.created_at)}
                      </div>
                    </div>

                    <div className="mt-2 text-sm text-gray-700">
                      {mostrar(h.valor_anterior)} → <b>{mostrar(h.valor_nuevo)}</b>
                    </div>

                    <div className="mt-1 text-xs text-gray-500">
                      {h.actor_nombre || perfil(h.actor_user_id)}
                      {h.actor_rol ? ` · ${h.actor_rol}` : ''}
                    </div>

                    {h.observacion ? (
                      <div className="mt-2 text-sm text-gray-600">
                        Observación: {h.observacion}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
