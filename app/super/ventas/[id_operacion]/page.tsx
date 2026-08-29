import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '../../../../utils/supabase/server'
import AppHeader from '../../../../components/AppHeader'

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

  if (!idOperacion || !vendedorId) {
    throw new Error('Datos de operación inválidos.')
  }

  const { error } = await supabase.rpc('super_reasignar_venta', {
    p_operacion_id: idOperacion,
    p_vendedor_id: vendedorId,
    p_responsable_id: responsableId || null,
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

  const { data: operacion } = await supabase
    .from('operaciones')
    .select('id_operacion, tipo, usuario_id, origen_dato')
    .eq('id_operacion', idOperacion)
    .eq('usuario_id', user.id)
    .eq('tipo', 'BAF')
    .maybeSingle()

  if (!operacion) {
    throw new Error('No se encontró la operación BAF o no pertenece al usuario.')
  }

  const { data: gestionActual } = await supabase
    .from('gestion_baf')
    .select('estado_baf_id')
    .eq('operacion_id', idOperacion)
    .maybeSingle()

  let estadoNuevoId: number | null = null
  let estadoNuevoNombre: string | null = null

  if (estadoBafIdRaw) {
    const estadoId = Number(estadoBafIdRaw)

    if (!Number.isInteger(estadoId)) {
      throw new Error('Estado BAF inválido.')
    }

    const { data: estado } = await supabase
      .from('estados_baf')
      .select('id, nombre')
      .eq('id', estadoId)
      .eq('activo', true)
      .maybeSingle()

    if (!estado) {
      throw new Error('El Estado BAF seleccionado no está disponible.')
    }

    estadoNuevoId = estado.id
    estadoNuevoNombre = estado.nombre
  }

  let estadoAnteriorNombre: string | null = null

  if (gestionActual?.estado_baf_id) {
    const { data: estadoAnterior } = await supabase
      .from('estados_baf')
      .select('nombre')
      .eq('id', gestionActual.estado_baf_id)
      .maybeSingle()

    estadoAnteriorNombre = estadoAnterior?.nombre ?? null
  }

  const ahora = new Date().toISOString()

  const texto = (nombre: string) => {
    const valor = String(formData.get(nombre) ?? '').trim()
    return valor || null
  }

  const { error: gestionError } = await supabase
    .from('gestion_baf')
    .upsert(
      {
        operacion_id: idOperacion,
        estado_baf_id: estadoNuevoId,
        fecha_gestion: ahora,
        prospector: texto('prospector'),
        detalle_lead: operacion.origen_dato || null,
        cia_celular: texto('cia_celular'),
        sds: texto('sds'),
        orden_trabajo: texto('orden_trabajo'),
        linea_fija: texto('linea_fija'),
        fecha_instalacion: texto('fecha_instalacion'),
        ciclo_cuenta: texto('ciclo_cuenta'),
        motivo_estado: texto('motivo_estado'),
        updated_by: user.id,
        updated_at: ahora,
      },
      {
        onConflict: 'operacion_id',
      }
    )

  if (gestionError) {
    throw new Error(`No se pudo guardar la gestión BAF: ${gestionError.message}`)
  }

  const cambioEstado =
    gestionActual?.estado_baf_id !== estadoNuevoId &&
    estadoNuevoNombre !== null

  if (cambioEstado) {
    const { error: historialError } = await supabase
      .from('historial_estados_operacion')
      .insert({
        operacion_id: idOperacion,
        tipo: 'BAF',
        estado_anterior: estadoAnteriorNombre,
        estado_nuevo: estadoNuevoNombre,
        usuario_id: user.id,
        fecha_hora: ahora,
        observacion: texto('motivo_estado'),
      })

    if (historialError) {
      throw new Error(
        `La gestión BAF se guardó, pero no se pudo registrar el historial: ${historialError.message}`
      )
    }
  }

  revalidatePath(`/mis-ventas/${encodeURIComponent(idOperacion)}`)
  revalidatePath('/mis-ventas')
  redirect(`/mis-ventas/${encodeURIComponent(idOperacion)}`)
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

  const { data: operacion } = await supabase
    .from('operaciones')
    .select('id_operacion, tipo, usuario_id')
    .eq('id_operacion', idOperacion)
    .eq('usuario_id', user.id)
    .eq('tipo', 'PORTA')
    .maybeSingle()

  if (!operacion) {
    throw new Error('No se encontró la operación PORTA/Línea Nueva o no pertenece al usuario.')
  }

  const { data: gestionActual } = await supabase
    .from('gestion_porta')
    .select('estado_porta_id, fecha_carga_stl, fecha_porta')
    .eq('operacion_id', idOperacion)
    .maybeSingle()

  let estadoNuevoId: number | null = null
  let estadoNuevoNombre: string | null = null
  let estadoNuevoCodigo: string | null = null

  if (estadoPortaIdRaw) {
    const estadoId = Number(estadoPortaIdRaw)

    if (!Number.isInteger(estadoId)) {
      throw new Error('Estado PORTA inválido.')
    }

    const { data: estado } = await supabase
      .from('estados_porta')
      .select('id, codigo, nombre')
      .eq('id', estadoId)
      .eq('activo', true)
      .maybeSingle()

    if (!estado) {
      throw new Error('El Estado PORTA seleccionado no está disponible.')
    }

    estadoNuevoId = estado.id
    estadoNuevoNombre = estado.nombre
    estadoNuevoCodigo = estado.codigo
  }

  let estadoAnteriorNombre: string | null = null

  if (gestionActual?.estado_porta_id) {
    const { data: estadoAnterior } = await supabase
      .from('estados_porta')
      .select('nombre')
      .eq('id', gestionActual.estado_porta_id)
      .maybeSingle()

    estadoAnteriorNombre = estadoAnterior?.nombre ?? null
  }

  let bbooId: string | null = null

  if (bbooIdRaw) {
    const { data: bboo } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', bbooIdRaw)
      .eq('activo', true)
      .eq('rol', 'BBOO')
      .maybeSingle()

    if (!bboo) {
      throw new Error('El usuario BBOO seleccionado no está disponible.')
    }

    bbooId = bboo.id
  }

  let medioDespachoId: number | null = null

  if (medioDespachoIdRaw) {
    const medioId = Number(medioDespachoIdRaw)

    if (!Number.isInteger(medioId)) {
      throw new Error('Medio de despacho CHIP inválido.')
    }

    const { data: medio } = await supabase
      .from('medios_despacho_chip')
      .select('id')
      .eq('id', medioId)
      .eq('activo', true)
      .maybeSingle()

    if (!medio) {
      throw new Error('El Medio de despacho CHIP seleccionado no está disponible.')
    }

    medioDespachoId = medio.id
  }

  const ahora = new Date().toISOString()

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

  let fechaCargaStl = gestionActual?.fecha_carga_stl ?? null
  let fechaPorta = gestionActual?.fecha_porta ?? null

  if (!fechaCargaStl && estadoNuevoCodigo === 'CARGADO_STL') {
    fechaCargaStl = ahora
  }

  if (!fechaPorta && estadoNuevoCodigo === 'ACTIVA_NRO_PORTADO') {
    fechaPorta = ahora
  }

  const { error: gestionError } = await supabase
    .from('gestion_porta')
    .upsert(
      {
        operacion_id: idOperacion,
        bboo_id: bbooId,
        fecha_carga_stl: fechaCargaStl,
        sim: texto('sim'),
        plan_cargado: texto('plan_cargado'),
        sds: texto('sds'),
        spn: texto('spn'),
        pin_lnva_nro: texto('pin_lnva_nro'),
        documentacion_dni: booleano('documentacion_dni'),
        medio_despacho_chip_id: medioDespachoId,
        fecha_porta: fechaPorta,
        tiene_baf: booleano('tiene_baf'),
        zona_baf: booleano('zona_baf'),
        observaciones_gestion: texto('observaciones_gestion'),
        estado_porta_id: estadoNuevoId,
        updated_by: user.id,
        updated_at: ahora,
      },
      {
        onConflict: 'operacion_id',
      }
    )

  if (gestionError) {
    throw new Error(`No se pudo guardar la gestión PORTA/Línea Nueva: ${gestionError.message}`)
  }

  const cambioEstado =
    gestionActual?.estado_porta_id !== estadoNuevoId &&
    estadoNuevoNombre !== null

  if (cambioEstado) {
    const { error: historialError } = await supabase
      .from('historial_estados_operacion')
      .insert({
        operacion_id: idOperacion,
        tipo: 'PORTA',
        estado_anterior: estadoAnteriorNombre,
        estado_nuevo: estadoNuevoNombre,
        usuario_id: user.id,
        fecha_hora: ahora,
        observacion: texto('observaciones_gestion'),
      })

    if (historialError) {
      throw new Error(
        `La gestión PORTA/Línea Nueva se guardó, pero no se pudo registrar el historial: ${historialError.message}`
      )
    }
  }

  revalidatePath(`/mis-ventas/${encodeURIComponent(idOperacion)}`)
  revalidatePath('/mis-ventas')
  redirect(`/mis-ventas/${encodeURIComponent(idOperacion)}`)
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

  const responsableActual = (responsables ?? []).find(
    (responsable: any) => responsable.id === responsableActualId
  )

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

            <form action={guardarAsignacionesSuper} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <input type="hidden" name="id_operacion" value={op.id_operacion} />
              <input type="hidden" name="tipo" value={op.tipo} />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-gray-800">Vendedor</span>
                  <select
                    name="vendedor_id"
                    defaultValue={op.usuario_id ?? ''}
                    required
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  >
                    <option value="" disabled>Seleccionar vendedor</option>
                    {vendedoresDisponibles.map((vendedor: any) => (
                      <option key={vendedor.id} value={vendedor.id}>
                        {vendedor.vendedor || vendedor.nombre}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-gray-500">
                    Actual: {mostrar(op.vendedor)}
                  </span>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-gray-800">Responsable</span>
                  <select
                    name="responsable_id"
                    defaultValue={responsableActualId ?? ''}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  >
                    <option value="">Sin asignar</option>
                    {(responsables ?? []).map((responsable: any) => (
                      <option key={responsable.id} value={responsable.id}>
                        {responsable.vendedor || responsable.nombre}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-gray-500">
                    Actual: {responsableActual?.vendedor || responsableActual?.nombre || 'Sin asignar'}
                  </span>
                </label>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                >
                  Guardar asignaciones
                </button>
              </div>
            </form>
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
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                Vista Supervisor · solo lectura
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
            </div>

            {esBaf ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Campo label="Estado BAF" value={gestionBaf?.estados_baf?.nombre || 'Sin gestión'} />
                <Campo label="Fecha Gestión" value={fechaArgentina(gestionBaf?.fecha_gestion)} />
                <Campo label="Prospector" value={gestionBaf?.prospector} />
                <Campo label="Detalle Lead" value={op.origen_dato} />
                <Campo label="CIA Celular" value={gestionBaf?.cia_celular} />
                <Campo label="SDS" value={gestionBaf?.sds} />
                <Campo label="Orden Trabajo" value={gestionBaf?.orden_trabajo} />
                <Campo label="Línea Fija" value={gestionBaf?.linea_fija} />
                <Campo label="Fecha Instalación" value={gestionBaf?.fecha_instalacion} ancho />
                <Campo label="Ciclo Cuenta" value={gestionBaf?.ciclo_cuenta} />
                <Campo label="Motivo Estado" value={gestionBaf?.motivo_estado} ancho />
              </div>
            ) : esPorta ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Campo label="Estado" value={gestionPorta?.estados_porta?.nombre || 'Sin gestión'} />
                <Campo
                  label="BBOO"
                  value={
                    (usuariosBboo ?? []).find((bboo: any) => bboo.id === gestionPorta?.bboo_id)
                      ?.vendedor ||
                    (usuariosBboo ?? []).find((bboo: any) => bboo.id === gestionPorta?.bboo_id)
                      ?.nombre ||
                    'Sin asignar'
                  }
                />
                <Campo label="Fecha Carga STL" value={fechaArgentina(gestionPorta?.fecha_carga_stl)} />
                <Campo label="Fecha PORTA" value={fechaArgentina(gestionPorta?.fecha_porta)} />
                <Campo label="SIM" value={gestionPorta?.sim} />
                <Campo label="PLAN" value={gestionPorta?.plan_cargado} />
                <Campo label="SDS" value={gestionPorta?.sds} />
                <Campo label="SPN" value={gestionPorta?.spn} />
                <Campo label="PIN / LNVA NRO" value={gestionPorta?.pin_lnva_nro} />
                <Campo label="Documentación DNI" value={gestionPorta?.documentacion_dni} />
                <Campo
                  label="Medio de despacho CHIP"
                  value={gestionPorta?.medios_despacho_chip?.nombre}
                />
                <Campo label="Tiene BAF" value={gestionPorta?.tiene_baf} />
                <Campo label="Zona BAF" value={gestionPorta?.zona_baf} />
                <Campo
                  label="Observaciones gestión"
                  value={gestionPorta?.observaciones_gestion}
                  ancho
                />
              </div>
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
