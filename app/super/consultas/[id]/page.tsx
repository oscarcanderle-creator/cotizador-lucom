import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '../../../../utils/supabase/server'
import AppHeader from '../../../../components/AppHeader'

type Params = Promise<{ id: string }>
type SearchParams = Promise<{ ok?: string; error?: string }>

function mostrar(v: unknown) {
  if (v === null || v === undefined || v === '') return '-'
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

export default async function SuperConsultaDetalle({
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
    .select('nombre, rol, activo')
    .eq('id', user.id)
    .single()

  if (!profile?.activo) redirect('/login')
  if (!['ADMIN', 'SUPERVISOR'].includes(profile.rol)) redirect('/ventas')

  const { id } = await params
  const consultaId = Number(id)
  if (!Number.isInteger(consultaId)) notFound()

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
      .select('rol, activo')
      .eq('id', actionUser.id)
      .single()

    if (!actionProfile?.activo) redirect('/login')
    if (!['ADMIN', 'SUPERVISOR'].includes(actionProfile.rol)) redirect('/ventas')

    const telefono = String(formData.get('telefono') ?? '').replace(/\D/g, '')

    if (!validarTelefono(telefono)) {
      redirect(
        `/super/consultas/${consultaId}?error=${encodeURIComponent(
          'El teléfono debe tener exactamente 10 dígitos y no puede comenzar con 0 ni 5.'
        )}`
      )
    }

    const deudaRaw = String(formData.get('estado_deuda_id') ?? '').trim()
    const coberturaRaw = String(formData.get('estado_cobertura_id') ?? '').trim()

    const { error: rpcError } = await supabaseAction.rpc('gestionar_consulta_completa', {
      p_consulta_id: consultaId,
      p_cliente: normalizar(formData.get('cliente')),
      p_dni: normalizar(formData.get('dni')),
      p_telefono: telefono,
      p_tipo_domicilio: normalizar(formData.get('tipo_domicilio')),
      p_domicilio: normalizar(formData.get('domicilio')),
      p_entrecalles: normalizar(formData.get('entrecalles')),
      p_localidad: normalizar(formData.get('localidad')),
      p_observaciones: normalizar(formData.get('observaciones')),
      p_estado_deuda_id: deudaRaw ? Number(deudaRaw) : null,
      p_estado_cobertura_id: coberturaRaw ? Number(coberturaRaw) : null,
    })

    if (rpcError) {
      redirect(
        `/super/consultas/${consultaId}?error=${encodeURIComponent(rpcError.message)}`
      )
    }

    revalidatePath(`/super/consultas/${consultaId}`)
    revalidatePath('/super/consultas')
    redirect(`/super/consultas/${consultaId}?ok=1`)
  }

  async function tomarConsulta() {
    'use server'

    const supabaseAction = await createClient()
    const {
      data: { user: actionUser },
    } = await supabaseAction.auth.getUser()

    if (!actionUser) redirect('/login')

    const { data: actionProfile } = await supabaseAction
      .from('profiles')
      .select('rol, activo')
      .eq('id', actionUser.id)
      .single()

    if (!actionProfile?.activo) redirect('/login')
    if (!['ADMIN', 'SUPERVISOR'].includes(actionProfile.rol)) redirect('/ventas')

    const { error: rpcError } = await supabaseAction.rpc('tomar_consulta', {
      p_consulta_id: consultaId,
    })

    if (rpcError) {
      redirect(
        `/super/consultas/${consultaId}?error=${encodeURIComponent(rpcError.message)}`
      )
    }

    revalidatePath(`/super/consultas/${consultaId}`)
    revalidatePath('/super/consultas')
    redirect(`/super/consultas/${consultaId}?ok=tomada`)
  }

  const { data: c, error } = await supabase
    .from('consultas')
    .select(`
      id, marca_temporal, tipo_consulta_id, vendedor_id, responsable_id,
      cliente_id, cliente, dni, telefono, tipo_domicilio, domicilio,
      entrecalles, localidad, observaciones, estado_consulta_id,
      estado_deuda_id, estado_cobertura_id, fecha_estado, created_at, updated_at
    `)
    .eq('id', consultaId)
    .maybeSingle()

  if (error) throw new Error(`No se pudo cargar la Consulta: ${error.message}`)
  if (!c) notFound()

  const [
    { data: tipo },
    { data: estados },
    { data: perfiles },
    { data: historialGeneral, error: hgError },
    { data: historialEstados, error: heError },
  ] = await Promise.all([
    supabase
      .from('tipos_consulta')
      .select('id,codigo,nombre')
      .eq('id', c.tipo_consulta_id)
      .maybeSingle(),
    supabase
      .from('estados_consulta')
      .select('id,codigo,nombre,ambito,tipo_estado,activo')
      .order('orden'),
    supabase.from('profiles').select('id,nombre,vendedor'),
    supabase
      .from('historial_consultas')
      .select('*')
      .eq('consulta_id', consultaId)
      .order('created_at', { ascending: false }),
    supabase
      .from('historial_estados_consultas')
      .select('*')
      .eq('consulta_id', consultaId)
      .order('created_at', { ascending: false }),
  ])

  if (hgError) {
    throw new Error(`No se pudo cargar el historial de la Consulta: ${hgError.message}`)
  }
  if (heError) {
    throw new Error(`No se pudo cargar el historial de estados: ${heError.message}`)
  }

  const perfilMap = new Map((perfiles ?? []).map((p: any) => [String(p.id), p]))
  const estadoMap = new Map((estados ?? []).map((e: any) => [String(e.id), e]))

  const perfil = (id: string | null) => {
    if (!id) return 'Sin asignar'
    const p: any = perfilMap.get(String(id))
    return p?.vendedor || p?.nombre || 'Usuario no disponible'
  }

  const estado = (id: number | null) =>
    id ? (estadoMap.get(String(id)) as any)?.nombre || `Estado ${id}` : '-'

  const usaDeuda = ['DEUDA_CLIENTE', 'DOMICILIO_DEUDA'].includes(tipo?.codigo || '')
  const usaCobertura = ['DOMICILIO_COBERTURA', 'DOMICILIO_DEUDA'].includes(
    tipo?.codigo || ''
  )

  const estadosDeuda = (estados ?? []).filter(
    (e: any) =>
      e.ambito === 'DEUDA' && (e.activo || Number(e.id) === Number(c.estado_deuda_id))
  )
  const estadosCobertura = (estados ?? []).filter(
    (e: any) =>
      e.ambito === 'COBERTURA' &&
      (e.activo || Number(e.id) === Number(c.estado_cobertura_id))
  )

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
            <h1 className="text-2xl font-bold text-gray-900">Detalle de Consulta</h1>
            <p className="mt-1 text-sm text-gray-500">
              Consulta #{c.id} · {tipo?.nombre || '-'}
            </p>
          </div>
          <a
            href="/super/consultas"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Volver a Consultas
          </a>
        </div>

        {sp.ok ? (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {sp.ok === 'tomada'
              ? 'Consulta asignada correctamente.'
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
              <h2 className="text-lg font-semibold text-gray-900">Consulta</h2>
              <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                SUPER · gestión habilitada
              </span>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Campo label="Fecha / Hora" value={fechaArgentina(c.marca_temporal)} />
              <Campo label="Tipo" value={tipo?.nombre} />
              <Campo label="Vendedor" value={perfil(c.vendedor_id)} />
              <Campo label="Responsable" value={perfil(c.responsable_id)} />
            </div>

            {!c.responsable_id ? (
              <form action={tomarConsulta} className="mt-5 border-t border-gray-100 pt-4">
                <button
                  type="submit"
                  className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                >
                  Tomar Consulta
                </button>
              </form>
            ) : null}
          </section>

          <form action={guardarGestion} className="space-y-5">
            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Datos de la Consulta
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">
                    Cliente
                  </span>
                  <input
                    name="cliente"
                    defaultValue={c.cliente || ''}
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">DNI</span>
                  <input name="dni" defaultValue={c.dni || ''} className={inputClass} />
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
                    defaultValue={c.telefono || ''}
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">
                    Tipo domicilio
                  </span>
                  <select
                    name="tipo_domicilio"
                    defaultValue={c.tipo_domicilio || ''}
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
                    defaultValue={c.domicilio || ''}
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">
                    Entre calles
                  </span>
                  <input
                    name="entrecalles"
                    defaultValue={c.entrecalles || ''}
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">
                    Localidad
                  </span>
                  <input
                    name="localidad"
                    defaultValue={c.localidad || ''}
                    className={inputClass}
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-gray-700">
                    Observaciones
                  </span>
                  <textarea
                    name="observaciones"
                    rows={4}
                    defaultValue={c.observaciones || ''}
                    className={inputClass}
                  />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Estados</h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {usaDeuda ? (
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">
                      Estado Deuda
                    </span>
                    <select
                      name="estado_deuda_id"
                      defaultValue={c.estado_deuda_id ?? ''}
                      className={inputClass}
                    >
                      <option value="">Sin calificar</option>
                      {estadosDeuda.map((e: any) => (
                        <option key={e.id} value={e.id}>
                          {e.nombre}
                          {!e.activo ? ' (inactivo)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <input
                    type="hidden"
                    name="estado_deuda_id"
                    value={c.estado_deuda_id ?? ''}
                  />
                )}

                {usaCobertura ? (
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">
                      Estado Cobertura
                    </span>
                    <select
                      name="estado_cobertura_id"
                      defaultValue={c.estado_cobertura_id ?? ''}
                      className={inputClass}
                    >
                      <option value="">Sin calificar</option>
                      {estadosCobertura.map((e: any) => (
                        <option key={e.id} value={e.id}>
                          {e.nombre}
                          {!e.activo ? ' (inactivo)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <input
                    type="hidden"
                    name="estado_cobertura_id"
                    value={c.estado_cobertura_id ?? ''}
                  />
                )}
              </div>

              {tipo?.codigo === 'DOMICILIO_DEUDA' ? (
                <p className="mt-3 text-xs text-gray-500">
                  Deuda y Cobertura se califican de forma independiente.
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                <div className="text-xs text-gray-500">
                  Estado legado: {estado(c.estado_consulta_id)} · Primera fecha de
                  estado: {fechaArgentina(c.fecha_estado)}
                </div>
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
                      <div className="font-semibold text-gray-900">
                        {h.ambito || 'Estado'}
                      </div>
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
