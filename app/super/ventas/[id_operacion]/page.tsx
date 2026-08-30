import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '../../../../utils/supabase/server'
import AppHeader from '../../../../components/AppHeader'
import AsignacionesSuperForm from './AsignacionesSuperForm'

type Params = Promise<{
  id_operacion: string
}>

function mostrar(valor: unknown) {
  if (valor === null || valor === undefined || valor === '') return '-'
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No'
  return String(valor)
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

function fechaSimple(fecha: string | null) {
  if (!fecha) return '-'

  const [anio, mes, dia] = fecha.split('-')
  if (!anio || !mes || !dia) return fecha

  return `${dia}/${mes}/${anio}`
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


async function guardarAsignacionesSuper(formData: FormData) {
  'use server'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: actor } = await supabase
    .from('profiles')
    .select('rol, activo')
    .eq('id', user.id)
    .maybeSingle()

  if (!actor?.activo || !['ADMIN', 'SUPERVISOR'].includes(actor.rol)) {
    throw new Error('No tiene permisos para modificar esta operación.')
  }

  const idOperacion = String(formData.get('id_operacion') ?? '').trim()
  const vendedorId = String(formData.get('vendedor_id') ?? '').trim()
  const responsableId = String(formData.get('responsable_id') ?? '').trim()
  const motivoVendedor = String(formData.get('motivo_vendedor') ?? '').trim()

  if (!idOperacion || !vendedorId) {
    throw new Error('Datos de operación inválidos.')
  }

  const { error } = await supabase.rpc('super_reasignar_venta', {
    p_operacion_id: idOperacion,
    p_vendedor_id: vendedorId,
    p_responsable_id: responsableId || null,
    p_motivo_vendedor: motivoVendedor || null,
  })

  if (error) {
    throw new Error(`No se pudieron guardar las asignaciones: ${error.message}`)
  }

  revalidatePath(`/super/ventas/${encodeURIComponent(idOperacion)}`)
  revalidatePath('/super')
  revalidatePath('/mis-ventas')
  redirect(`/super/ventas/${encodeURIComponent(idOperacion)}`)
}


async function guardarGestionBaf(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const idOperacion = String(formData.get('id_operacion') ?? '').trim()
  const estadoBafIdRaw = String(formData.get('estado_baf_id') ?? '').trim()

  if (!idOperacion) {
    throw new Error('Operación inválida.')
  }

  let estadoBafId: number | null = null

  if (estadoBafIdRaw) {
    const estadoId = Number(estadoBafIdRaw)

    if (!Number.isInteger(estadoId)) {
      throw new Error('Estado BAF inválido.')
    }

    estadoBafId = estadoId
  }

  const texto = (nombre: string) => {
    const valor = String(formData.get(nombre) ?? '').trim()
    return valor || null
  }

  const { error } = await supabase.rpc('super_guardar_gestion_baf', {
    p_operacion_id: idOperacion,
    p_estado_baf_id: estadoBafId,
    p_prospector: texto('prospector'),
    p_cia_celular: texto('cia_celular'),
    p_sds: texto('sds'),
    p_orden_trabajo: texto('orden_trabajo'),
    p_linea_fija: texto('linea_fija'),
    p_fecha_instalacion: texto('fecha_instalacion'),
    p_ciclo_cuenta: texto('ciclo_cuenta'),
    p_motivo_estado: texto('motivo_estado'),
  })

  if (error) {
    throw new Error(`No se pudo guardar la gestión BAF: ${error.message}`)
  }

  revalidatePath(`/super/ventas/${encodeURIComponent(idOperacion)}`)
  revalidatePath('/super')
  revalidatePath('/mis-ventas')
  revalidatePath(`/mis-ventas/${encodeURIComponent(idOperacion)}`)
  redirect(`/super/ventas/${encodeURIComponent(idOperacion)}`)
}


async function guardarGestionPorta(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const idOperacion = String(formData.get('id_operacion') ?? '').trim()
  const estadoPortaIdRaw = String(formData.get('estado_porta_id') ?? '').trim()
  const bbooIdRaw = String(formData.get('bboo_id') ?? '').trim()
  const medioDespachoIdRaw = String(formData.get('medio_despacho_chip_id') ?? '').trim()

  if (!idOperacion) {
    throw new Error('Operación inválida.')
  }

  let estadoPortaId: number | null = null
  if (estadoPortaIdRaw) {
    const valor = Number(estadoPortaIdRaw)
    if (!Number.isInteger(valor)) {
      throw new Error('Estado PORTA inválido.')
    }
    estadoPortaId = valor
  }

  let medioDespachoId: number | null = null
  if (medioDespachoIdRaw) {
    const valor = Number(medioDespachoIdRaw)
    if (!Number.isInteger(valor)) {
      throw new Error('Medio de despacho CHIP inválido.')
    }
    medioDespachoId = valor
  }

  const texto = (nombre: string) => {
    const valor = String(formData.get(nombre) ?? '').trim()
    return valor || null
  }

  const booleano = (nombre: string) => {
    const valor = String(formData.get(nombre) ?? '').trim()
    if (valor === 'SI') return true
    if (valor === 'NO') return false
    return null
  }

  const { error } = await supabase.rpc('super_guardar_gestion_porta', {
    p_operacion_id: idOperacion,
    p_estado_porta_id: estadoPortaId,
    p_bboo_id: bbooIdRaw || null,
    p_sim: texto('sim'),
    p_plan_cargado: texto('plan_cargado'),
    p_sds: texto('sds'),
    p_spn: texto('spn'),
    p_pin_lnva_nro: texto('pin_lnva_nro'),
    p_documentacion_dni: booleano('documentacion_dni'),
    p_medio_despacho_chip_id: medioDespachoId,
    p_tiene_baf: booleano('tiene_baf'),
    p_zona_baf: booleano('zona_baf'),
    p_observaciones_gestion: texto('observaciones_gestion'),
  })

  if (error) {
    throw new Error(`No se pudo guardar la gestión PORTA/Línea Nueva: ${error.message}`)
  }

  revalidatePath(`/super/ventas/${encodeURIComponent(idOperacion)}`)
  revalidatePath('/super')
  revalidatePath('/mis-ventas')
  revalidatePath(`/mis-ventas/${encodeURIComponent(idOperacion)}`)
  redirect(`/super/ventas/${encodeURIComponent(idOperacion)}`)
}

export default async function SuperDetalleVentaPage({
  params,
}: {
  params: Params
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, rol, activo, puede_gestionar_ventas')
    .eq('id', user.id)
    .single()

  if (!profile?.activo) redirect('/login')
  if (!['ADMIN', 'SUPERVISOR'].includes(profile.rol)) redirect('/ventas')

  const { data: vendedores, error: vendedoresError } = await supabase
    .from('profiles')
    .select('id, nombre, vendedor, rol')
    .eq('activo', true)
    .order('nombre', { ascending: true })

  if (vendedoresError) {
    throw new Error(`No se pudieron cargar los vendedores: ${vendedoresError.message}`)
  }

  const { data: responsables, error: responsablesError } = await supabase
    .from('profiles')
    .select('id, nombre, vendedor, rol')
    .eq('activo', true)
    .eq('puede_gestionar_ventas', true)
    .order('nombre', { ascending: true })

  if (responsablesError) {
    throw new Error(`No se pudieron cargar los responsables: ${responsablesError.message}`)
  }

  const { data: estadosBaf, error: estadosBafError } = await supabase
    .from('estados_baf')
    .select('id, codigo, nombre, orden')
    .eq('activo', true)
    .order('orden', { ascending: true })
    .order('nombre', { ascending: true })

  if (estadosBafError) {
    throw new Error(`No se pudieron cargar los Estados BAF: ${estadosBafError.message}`)
  }

  const { data: estadosPorta, error: estadosPortaError } = await supabase
    .from('estados_porta')
    .select('id, codigo, nombre, orden')
    .eq('activo', true)
    .order('orden', { ascending: true })
    .order('nombre', { ascending: true })

  if (estadosPortaError) {
    throw new Error(`No se pudieron cargar los Estados PORTA: ${estadosPortaError.message}`)
  }

  const { data: mediosDespacho, error: mediosDespachoError } = await supabase
    .from('medios_despacho_chip')
    .select('id, nombre, orden')
    .eq('activo', true)
    .order('orden', { ascending: true })
    .order('nombre', { ascending: true })

  if (mediosDespachoError) {
    throw new Error(`No se pudieron cargar los medios de despacho CHIP: ${mediosDespachoError.message}`)
  }

  const { data: usuariosBboo, error: usuariosBbooError } = await supabase
    .from('profiles')
    .select('id, nombre, vendedor')
    .eq('activo', true)
    .eq('rol', 'BBOO')
    .order('nombre', { ascending: true })

  if (usuariosBbooError) {
    throw new Error(`No se pudieron cargar los usuarios BBOO: ${usuariosBbooError.message}`)
  }

  const { id_operacion } = await params
  const id = decodeURIComponent(id_operacion)

  const { data: operacion, error } = await supabase
    .from('operaciones')
    .select(`
      id_operacion,
      grupo_operacion,
      tipo,
      fecha_hora,
      vendedor,
      origen_dato,
      estado_sync,
      sheet_destino,
      fila_sheet,
      error_sync,
      usuario_id,
      cliente:clientes (
        dni,
        tipo_documento,
        nombre,
        apellido,
        fecha_nacimiento,
        email,
        telefono,
        telefono_alternativo
      ),
      domicilio:domicilios (
        calle_nro,
        piso,
        dpto,
        entre_calles,
        barrio,
        localidad,
        coordenadas,
        datos_extras
      ),
      operaciones_baf (
        tipo_domicilio,
        plan,
        tv,
        cantidad_decos,
        zona,
        horario_contacto,
        convergente,
        linea_convergente,
        modalidad_plan
      ),
      operaciones_porta (
        nim,
        es_linea_nueva,
        gigas_acordados,
        compania_actual,
        prepago_pospago,
        observaciones,
        numero_linea
      ),
      gestion_baf (
        responsable_id,
        fecha_gestion,
        prospector,
        detalle_lead,
        cia_celular,
        sds,
        orden_trabajo,
        linea_fija,
        fecha_instalacion,
        ciclo_cuenta,
        motivo_estado,
        estado_baf_id,
        estados_baf (
          nombre
        )
      ),
      gestion_porta (
        responsable_id,
        bboo_id,
        fecha_carga_stl,
        sim,
        plan_cargado,
        sds,
        spn,
        pin_lnva_nro,
        documentacion_dni,
        medio_despacho_chip_id,
        fecha_porta,
        tiene_baf,
        zona_baf,
        observaciones_gestion,
        estado_porta_id,
        estados_porta (
          nombre
        ),
        medios_despacho_chip (
          nombre
        )
      )
    `)
    .eq('id_operacion', id)
    .maybeSingle()

  if (error) {
    throw new Error(`No se pudo cargar la venta: ${error.message}`)
  }

  if (!operacion) notFound()

  // Historial general de cambios de la operación.
  // En SUPER se muestra únicamente en modo lectura.
  const { data: historial, error: historialError } = await supabase
    .from('historial_operacion')
    .select(`
      id,
      fecha_hora,
      tipo_accion,
      campo,
      etiqueta,
      valor_anterior,
      valor_nuevo,
      rol_actor,
      observacion,
      usuario:profiles (
        nombre,
        vendedor
      )
    `)
    .eq('operacion_id', id)
    .order('fecha_hora', { ascending: false })

  if (historialError) {
    throw new Error(`No se pudo cargar el historial de la operación: ${historialError.message}`)
  }

  const op: any = operacion
  const cliente = op.cliente
  const domicilio = op.domicilio
  const baf = op.operaciones_baf
  const porta = op.operaciones_porta
  const gestionBaf = op.gestion_baf
  const gestionPorta = op.gestion_porta

  let bbooActualFueraDeLista: any = null

  if (
    gestionPorta?.bboo_id &&
    !(usuariosBboo ?? []).some((bboo: any) => bboo.id === gestionPorta.bboo_id)
  ) {
    const { data: bbooActual, error: bbooActualError } = await supabase
      .from('profiles')
      .select('id, nombre, vendedor, rol, activo')
      .eq('id', gestionPorta.bboo_id)
      .maybeSingle()

    if (bbooActualError) {
      throw new Error(`No se pudo cargar el BBOO actual: ${bbooActualError.message}`)
    }

    bbooActualFueraDeLista = bbooActual
  }

  const esBaf = op.tipo === 'BAF' 
  const esPorta = op.tipo === 'PORTA'
  const tipoVisible =
    esPorta && porta?.es_linea_nueva
      ? 'Línea Nueva'
      : esPorta
        ? 'Portabilidad'
        : op.tipo

  const responsableActualId =
    esBaf ? gestionBaf?.responsable_id : gestionPorta?.responsable_id

  let responsableActual: any = (responsables ?? []).find(
    (responsable: any) => responsable.id === responsableActualId
  )

  // Si el Responsable actualmente asignado quedó inactivo o perdió
  // puede_gestionar_ventas, ya no aparece entre los Responsables disponibles
  // para nuevas asignaciones. Lo recuperamos únicamente para conservar y
  // mostrar correctamente la asignación histórica actual.
  if (responsableActualId && !responsableActual) {
    const { data: responsableHistorico, error: responsableHistoricoError } = await supabase
      .from('profiles')
      .select('id, nombre, vendedor, rol, activo, puede_gestionar_ventas')
      .eq('id', responsableActualId)
      .maybeSingle()

    if (responsableHistoricoError) {
      throw new Error(
        `No se pudo cargar el Responsable actual: ${responsableHistoricoError.message}`
      )
    }

    responsableActual = responsableHistorico
  }

  const vendedoresDisponibles = (vendedores ?? []).filter((vendedor: any) =>
    String(vendedor.vendedor ?? vendedor.nombre ?? '').trim()
  )

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader
        rol={profile.rol}
        usuario={profile.nombre?.trim() || user.email || 'Usuario'}
        actual="SUPER"
      />

      <div className="mx-auto max-w-6xl p-4 sm:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2">
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                {tipoVisible}
              </span>
            </div>

            <h1 className="text-2xl font-bold text-gray-900">
              Detalle de Venta
            </h1>

            <p className="mt-1 break-all text-sm text-gray-500">
              Operación: {op.id_operacion}
            </p>
          </div>

          <a
            href="/super"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Volver a Super / Ventas
          </a>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Operación</h2>
              <span className="text-xs font-medium text-amber-700">
                SUPER · Vendedor y Responsable editables
              </span>
            </div>

            <div className="mb-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Campo label="Fecha / Hora" value={fechaArgentina(op.fecha_hora)} />
              <Campo label="Origen del dato" value={op.origen_dato} />
              <Campo label="Grupo operación" value={op.grupo_operacion} />
              <Campo label="Tipo" value={tipoVisible} />
            </div>

            <AsignacionesSuperForm
              action={guardarAsignacionesSuper}
              idOperacion={op.id_operacion}
              tipo={op.tipo}
              vendedorActualId={op.usuario_id ?? ''}
              vendedorActualNombre={mostrar(op.vendedor)}
              responsableActualId={responsableActualId ?? ''}
              responsableActualNombre={
                responsableActual?.vendedor ||
                responsableActual?.nombre ||
                'Sin asignar'
              }
              vendedores={vendedoresDisponibles.map((vendedor: any) => ({
                id: vendedor.id,
                nombre: vendedor.vendedor || vendedor.nombre,
              }))}
              responsables={(responsables ?? []).map((responsable: any) => ({
                id: responsable.id,
                nombre: responsable.vendedor || responsable.nombre,
              }))}
            />
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Cliente
            </h2>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Campo
                label="Apellido y Nombre"
                value={[cliente?.apellido, cliente?.nombre].filter(Boolean).join(', ')}
              />
              <Campo
                label="Documento"
                value={`${cliente?.tipo_documento ? `${cliente.tipo_documento} ` : ''}${cliente?.dni || ''}`}
              />
              <Campo
                label="Fecha de nacimiento"
                value={fechaSimple(cliente?.fecha_nacimiento)}
              />
              <Campo label="Correo electrónico" value={cliente?.email} />
              <Campo label="Teléfono" value={cliente?.telefono} />
              <Campo
                label="Teléfono alternativo"
                value={cliente?.telefono_alternativo}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Domicilio
            </h2>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Campo label="Calle / Número" value={domicilio?.calle_nro} />
              <Campo
                label="Piso / Dpto"
                value={[domicilio?.piso, domicilio?.dpto].filter(Boolean).join(' / ')}
              />
              <Campo label="Entre calles" value={domicilio?.entre_calles} />
              <Campo label="Barrio" value={domicilio?.barrio} />
              <Campo label="Localidad" value={domicilio?.localidad} />
              <Campo label="Coordenadas" value={domicilio?.coordenadas} />
              <Campo
                label="Datos extras"
                value={domicilio?.datos_extras}
                ancho
              />
            </div>
          </section>

          {esBaf && (
            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Datos BAF
              </h2>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Campo label="Servicio BAF" value={baf?.modalidad_plan} />
                <Campo label="Plan" value={baf?.plan} />
                <Campo label="TV" value={baf?.tv} />
                <Campo label="Cantidad DECOS" value={baf?.cantidad_decos} />
                <Campo label="Zona" value={baf?.zona} />
                <Campo label="Tipo domicilio" value={baf?.tipo_domicilio} />
                <Campo label="Convergente" value={baf?.convergente} />
                <Campo
                  label="Línea convergente"
                  value={baf?.linea_convergente}
                />
                <Campo
                  label="Horario contacto / Observaciones"
                  value={baf?.horario_contacto}
                  ancho
                />
              </div>
            </section>
          )}

          {esPorta && (
            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Datos {porta?.es_linea_nueva ? 'Línea Nueva' : 'PORTA'}
              </h2>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Campo label="NIM" value={porta?.nim} />
                <Campo label="Número de línea" value={porta?.numero_linea} />
                <Campo
                  label="Gigas acordados"
                  value={porta?.gigas_acordados}
                />
                <Campo
                  label="Compañía actual"
                  value={porta?.compania_actual}
                />
                <Campo
                  label="PRE / POS"
                  value={porta?.prepago_pospago}
                />
                <Campo
                  label="Línea Nueva"
                  value={porta?.es_linea_nueva}
                />
                <Campo
                  label="Observaciones vendedor"
                  value={porta?.observaciones}
                  ancho
                />
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-gray-900">Gestión</h2>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                Supervisor · editable
              </span>
            </div>

            <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Responsable
              </div>
              <div className="mt-1 text-sm font-semibold text-gray-800">
                {responsableActual?.vendedor ||
                  responsableActual?.nombre ||
                  (responsableActualId ? 'Usuario no disponible' : 'Sin asignar')}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                El Responsable se modifica desde Asignaciones.
              </div>
            </div>

            {esBaf ? (
              <form action={guardarGestionBaf}>
                <input type="hidden" name="id_operacion" value={op.id_operacion} />

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">Estado BAF</span>
                    <select
                      name="estado_baf_id"
                      defaultValue={gestionBaf?.estado_baf_id ? String(gestionBaf.estado_baf_id) : ''}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="">Sin estado</option>
                      {gestionBaf?.estado_baf_id &&
                        !(estadosBaf ?? []).some((estado: any) => estado.id === gestionBaf.estado_baf_id) ? (
                          <option value={String(gestionBaf.estado_baf_id)}>
                            {gestionBaf?.estados_baf?.nombre || 'Estado actual'} (inactivo)
                          </option>
                        ) : null}
                      {(estadosBaf ?? []).map((estado: any) => (
                        <option key={estado.id} value={String(estado.id)}>
                          {estado.nombre}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Fecha Gestión
                    </div>
                    <div className="mt-1 text-sm font-semibold text-gray-800">
                      {fechaArgentina(gestionBaf?.fecha_gestion)}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Se actualiza automáticamente cuando existe un cambio real.
                    </div>
                  </div>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">Prospector</span>
                    <input
                      type="text"
                      name="prospector"
                      defaultValue={gestionBaf?.prospector ?? ''}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Detalle Lead
                    </div>
                    <div className="mt-1 break-words text-sm text-gray-800">
                      {mostrar(op.origen_dato)}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">Solo lectura</div>
                  </div>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">CIA Celular</span>
                    <input
                      type="text"
                      name="cia_celular"
                      defaultValue={gestionBaf?.cia_celular ?? ''}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">SDS</span>
                    <input
                      type="text"
                      name="sds"
                      defaultValue={gestionBaf?.sds ?? ''}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">Orden Trabajo</span>
                    <input
                      type="text"
                      name="orden_trabajo"
                      defaultValue={gestionBaf?.orden_trabajo ?? ''}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">Línea Fija</span>
                    <input
                      type="text"
                      name="linea_fija"
                      defaultValue={gestionBaf?.linea_fija ?? ''}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="text-sm font-semibold text-gray-800">Fecha Instalación</span>
                    <input
                      type="text"
                      name="fecha_instalacion"
                      defaultValue={gestionBaf?.fecha_instalacion ?? ''}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">Ciclo Cuenta</span>
                    <input
                      type="text"
                      name="ciclo_cuenta"
                      defaultValue={gestionBaf?.ciclo_cuenta ?? ''}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="text-sm font-semibold text-gray-800">Motivo Estado</span>
                    <textarea
                      name="motivo_estado"
                      rows={3}
                      defaultValue={gestionBaf?.motivo_estado ?? ''}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </label>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                  <div className="text-xs text-gray-500">
                    Solo se registran en el historial los campos que realmente cambian.
                  </div>
                  <button
                    type="submit"
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                  >
                    Guardar gestión BAF
                  </button>
                </div>
              </form>
            ) : esPorta ? (
              <form action={guardarGestionPorta}>
                <input type="hidden" name="id_operacion" value={op.id_operacion} />

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">Estado</span>
                    <select
                      name="estado_porta_id"
                      defaultValue={
                        gestionPorta?.estado_porta_id
                          ? String(gestionPorta.estado_porta_id)
                          : ''
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="">Sin estado</option>
                      {gestionPorta?.estado_porta_id &&
                      !(estadosPorta ?? []).some(
                        (estado: any) => estado.id === gestionPorta.estado_porta_id
                      ) ? (
                        <option value={String(gestionPorta.estado_porta_id)}>
                          {gestionPorta?.estados_porta?.nombre || 'Estado actual'} (inactivo)
                        </option>
                      ) : null}
                      {(estadosPorta ?? []).map((estado: any) => (
                        <option key={estado.id} value={String(estado.id)}>
                          {estado.nombre}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">BBOO</span>
                    <select
                      name="bboo_id"
                      defaultValue={gestionPorta?.bboo_id ?? ''}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="">Sin asignar</option>
                      {bbooActualFueraDeLista ? (
                        <option value={bbooActualFueraDeLista.id}>
                          {bbooActualFueraDeLista.vendedor ||
                            bbooActualFueraDeLista.nombre ||
                            'BBOO actual'}{' '}
                          (inactivo)
                        </option>
                      ) : null}
                      {(usuariosBboo ?? []).map((bboo: any) => (
                        <option key={bboo.id} value={bboo.id}>
                          {bboo.vendedor || bboo.nombre}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Fecha Carga STL
                    </div>
                    <div className="mt-1 text-sm font-semibold text-gray-800">
                      {fechaArgentina(gestionPorta?.fecha_carga_stl)}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Se registra automáticamente al pasar a Cargado STL.
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Fecha PORTA
                    </div>
                    <div className="mt-1 text-sm font-semibold text-gray-800">
                      {fechaArgentina(gestionPorta?.fecha_porta)}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Se registra automáticamente al pasar a Cargado STL.
                    </div>
                  </div>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">SIM</span>
                    <input
                      type="text"
                      name="sim"
                      defaultValue={gestionPorta?.sim ?? ''}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">PLAN</span>
                    <input
                      type="text"
                      name="plan_cargado"
                      defaultValue={gestionPorta?.plan_cargado ?? ''}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">SDS</span>
                    <input
                      type="text"
                      name="sds"
                      defaultValue={gestionPorta?.sds ?? ''}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">SPN</span>
                    <input
                      type="text"
                      name="spn"
                      defaultValue={gestionPorta?.spn ?? ''}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">PIN / LNVA NRO</span>
                    <input
                      type="text"
                      name="pin_lnva_nro"
                      defaultValue={gestionPorta?.pin_lnva_nro ?? ''}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">Documentación DNI</span>
                    <select
                      name="documentacion_dni"
                      defaultValue={
                        gestionPorta?.documentacion_dni === true
                          ? 'SI'
                          : gestionPorta?.documentacion_dni === false
                            ? 'NO'
                            : ''
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="">Sin informar</option>
                      <option value="SI">Sí</option>
                      <option value="NO">No</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">
                      Medio de despacho CHIP
                    </span>
                    <select
                      name="medio_despacho_chip_id"
                      defaultValue={
                        gestionPorta?.medio_despacho_chip_id
                          ? String(gestionPorta.medio_despacho_chip_id)
                          : ''
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="">Sin asignar</option>
                      {gestionPorta?.medio_despacho_chip_id &&
                      !(mediosDespacho ?? []).some(
                        (medio: any) => medio.id === gestionPorta.medio_despacho_chip_id
                      ) ? (
                        <option value={String(gestionPorta.medio_despacho_chip_id)}>
                          {gestionPorta?.medios_despacho_chip?.nombre || 'Medio actual'} (inactivo)
                        </option>
                      ) : null}
                      {(mediosDespacho ?? []).map((medio: any) => (
                        <option key={medio.id} value={String(medio.id)}>
                          {medio.nombre}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">Tiene BAF</span>
                    <select
                      name="tiene_baf"
                      defaultValue={
                        gestionPorta?.tiene_baf === true
                          ? 'SI'
                          : gestionPorta?.tiene_baf === false
                            ? 'NO'
                            : ''
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="">Sin informar</option>
                      <option value="SI">Sí</option>
                      <option value="NO">No</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">Zona BAF</span>
                    <select
                      name="zona_baf"
                      defaultValue={
                        gestionPorta?.zona_baf === true
                          ? 'SI'
                          : gestionPorta?.zona_baf === false
                            ? 'NO'
                            : ''
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="">Sin informar</option>
                      <option value="SI">Sí</option>
                      <option value="NO">No</option>
                    </select>
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="text-sm font-semibold text-gray-800">
                      Observaciones gestión
                    </span>
                    <textarea
                      name="observaciones_gestion"
                      rows={4}
                      defaultValue={gestionPorta?.observaciones_gestion ?? ''}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </label>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                  <div className="text-xs text-gray-500">
                    Solo se registran en el historial los campos que realmente cambian.
                  </div>
                  <button
                    type="submit"
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                  >
                    Guardar gestión {porta?.es_linea_nueva ? 'Línea Nueva' : 'PORTA'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-sm text-gray-500">Esta venta todavía no tiene datos de gestión.</div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-gray-900">
                Historial de cambios
              </h2>
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
                Solo lectura
              </span>
            </div>

            {(historial ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
                Esta operación todavía no tiene cambios registrados en el historial.
              </div>
            ) : (
              <div className="space-y-3">
                {(historial ?? []).map((item: any) => {
                  const usuarioHistorial =
                    item.usuario?.vendedor ||
                    item.usuario?.nombre ||
                    'Usuario no disponible'

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                    >
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            {item.etiqueta || item.campo || 'Modificación'}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {usuarioHistorial}
                            {item.rol_actor ? ` · ${item.rol_actor}` : ''}
                            {item.tipo_accion ? ` · ${item.tipo_accion}` : ''}
                          </div>
                        </div>

                        <div className="text-xs font-medium text-gray-500">
                          {fechaArgentina(item.fecha_hora)}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                            Valor anterior
                          </div>
                          <div className="mt-1 break-words text-sm text-gray-700">
                            {mostrar(item.valor_anterior)}
                          </div>
                        </div>

                        <div className="hidden text-center text-gray-400 sm:block">
                          →
                        </div>

                        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                            Valor nuevo
                          </div>
                          <div className="mt-1 break-words text-sm font-medium text-gray-900">
                            {mostrar(item.valor_nuevo)}
                          </div>
                        </div>
                      </div>

                      {item.observacion ? (
                        <div className="mt-3 text-sm text-gray-600">
                          <span className="font-medium">Observación:</span>{' '}
                          {item.observacion}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Sincronización
            </h2>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Campo label="Estado Sync" value={op.estado_sync} />
              <Campo label="Sheet destino" value={op.sheet_destino} />
              <Campo label="Fila Sheet" value={op.fila_sheet} />
              <Campo label="Error Sync" value={op.error_sync} ancho />
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
