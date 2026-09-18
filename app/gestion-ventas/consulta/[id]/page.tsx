import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { createAdminClient } from '../../../../utils/supabase/admin'
import { createClient } from '../../../../utils/supabase/server'
import AppHeader from '../../../../components/AppHeader'
import GestionConsultaForm from './GestionConsultaForm'

type Params = Promise<{
  id: string
}>

function mostrar(valor: unknown) {
  if (valor === null || valor === undefined || valor === '') return '-'
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

async function tomarConsulta(formData: FormData) {
  'use server'

  const consultaId = Number(formData.get('consulta_id'))

  if (!Number.isInteger(consultaId) || consultaId <= 0) {
    throw new Error('Consulta inválida.')
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, activo, puede_gestionar_ventas')
    .eq('id', user.id)
    .single()

  const puedeGestionar =
    profile?.activo === true &&
    profile.rol === 'VENDEDOR' &&
    profile.puede_gestionar_ventas === true

  if (!puedeGestionar) {
    throw new Error('No tiene permisos para gestionar Consultas.')
  }

  const { error } = await supabase.rpc('tomar_consulta', {
    p_consulta_id: consultaId,
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/gestion-ventas/consulta/${consultaId}`)
  revalidatePath('/gestion-ventas')

  redirect(`/gestion-ventas/consulta/${consultaId}`)
}

export default async function GestionConsultaPage({
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

  const esVendedorGestor =
    profile.rol === 'VENDEDOR' &&
    profile.puede_gestionar_ventas === true

  /*
   * Las Consultas pertenecen al circuito L1 / Vendedor Gestor.
   * BBOO no interviene en este circuito.
   */
  if (!esVendedorGestor) redirect('/ventas')

  const { id } = await params
  const consultaId = Number(id)

  if (!Number.isInteger(consultaId) || consultaId <= 0) {
    notFound()
  }

  const admin = createAdminClient()

  const { data: consulta, error: errorConsulta } = await admin
    .from('consultas')
    .select(`
      id,
      marca_temporal,
      operacion_id,
      vendedor_id,
      responsable_id,
      cliente,
      dni,
      telefono,
      tipo_domicilio,
      domicilio,
      entrecalles,
      localidad,
      observaciones,
      estado_consulta_id,
      estado_deuda_id,
      estado_cobertura_id,
      fecha_estado,
      fecha_gestion,
      tipo_consulta_id
    `)
    .eq('id', consultaId)
    .maybeSingle()

  if (errorConsulta) {
    throw new Error(errorConsulta.message)
  }

  if (!consulta) notFound()

  const [
    tipoResult,
    vendedorResult,
    responsableResult,
    estadoGeneralResult,
    estadoDeudaResult,
    estadoCoberturaResult,
    estadosConsultaResult,
  ] = await Promise.all([
    admin
      .from('tipos_consulta')
      .select('id, codigo, nombre')
      .eq('id', consulta.tipo_consulta_id)
      .maybeSingle(),

    admin
      .from('profiles')
      .select('id, nombre, vendedor')
      .eq('id', consulta.vendedor_id)
      .maybeSingle(),

    consulta.responsable_id
      ? admin
          .from('profiles')
          .select('id, nombre, vendedor')
          .eq('id', consulta.responsable_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    consulta.estado_consulta_id
      ? admin
          .from('estados_consulta')
          .select('id, nombre')
          .eq('id', consulta.estado_consulta_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    consulta.estado_deuda_id
      ? admin
          .from('estados_consulta')
          .select('id, nombre')
          .eq('id', consulta.estado_deuda_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    consulta.estado_cobertura_id
      ? admin
          .from('estados_consulta')
          .select('id, nombre')
          .eq('id', consulta.estado_cobertura_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    admin
      .from('estados_consulta')
      .select('id, nombre, ambito, activo')
      .order('orden', { ascending: true }),
  ])

  const tipo = tipoResult.data
  const vendedor = vendedorResult.data
  const responsable = responsableResult.data

  const nombreVendedor =
    vendedor?.vendedor ||
    vendedor?.nombre ||
    'Usuario no disponible'

  const nombreResponsable =
    responsable?.vendedor ||
    responsable?.nombre ||
    'Sin asignar'

  const esResponsable = consulta.responsable_id === user.id
  const estaLibre = consulta.responsable_id === null
  const perteneceAOtro = !estaLibre && !esResponsable

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader
        rol={profile.rol}
        usuario={profile.nombre?.trim() || user.email || 'Usuario'}
        actual="GESTION_VENTAS"
        puedeGestionarVentas={profile.puede_gestionar_ventas === true}
      />

      <div className="mx-auto max-w-5xl p-4 sm:p-8">
        <div className="mb-6 flex justify-end">
          <a
            href="/gestion-ventas"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            ← Volver a Gestión de Ventas
          </a>
        </div>

        <div className="overflow-hidden rounded-2xl border border-yellow-200 bg-white shadow-sm">
          <div className="border-b border-yellow-200 bg-yellow-100 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white">
                CONSULTA
              </span>

              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                {tipo?.nombre || 'Consulta'}
              </span>
            </div>

            <h1 className="mt-3 text-xl font-bold text-gray-900">
              Gestionar Consulta #{consulta.id}
            </h1>

            <div className="mt-1 text-sm text-gray-600">
              Ingreso: {fechaArgentina(consulta.marca_temporal)}
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <Campo label="Vendedor" value={nombreVendedor} />
              <Campo label="Responsable" value={nombreResponsable} />

              <Campo label="Cliente" value={consulta.cliente} />
              <Campo label="DNI" value={consulta.dni} />

              <Campo label="Teléfono" value={consulta.telefono} />
              <Campo label="Tipo domicilio" value={consulta.tipo_domicilio} />

              <Campo label="Domicilio" value={consulta.domicilio} />
              <Campo label="Entre calles" value={consulta.entrecalles} />

              <Campo label="Localidad" value={consulta.localidad} />

              {consulta.operacion_id && (
                <Campo
                  label="Operación vinculada"
                  value={consulta.operacion_id}
                />
              )}

              <Campo
                label="Observaciones"
                value={consulta.observaciones}
                ancho
              />
            </div>

            <div className="mt-6 border-t border-gray-100 pt-5">
              <div className="grid gap-4 sm:grid-cols-3">
                {estadoGeneralResult.data && (
                  <Campo
                    label="Estado"
                    value={estadoGeneralResult.data.nombre}
                  />
                )}

                {estadoDeudaResult.data && (
                  <Campo
                    label="Estado Deuda"
                    value={estadoDeudaResult.data.nombre}
                  />
                )}

                {estadoCoberturaResult.data && (
                  <Campo
                    label="Estado Cobertura"
                    value={estadoCoberturaResult.data.nombre}
                  />
                )}
              </div>
            </div>

            <div className="mt-7 border-t border-gray-100 pt-5">
              {estaLibre && (
                <form action={tomarConsulta}>
                  <input
                    type="hidden"
                    name="consulta_id"
                    value={consulta.id}
                  />

                  <button
                    type="submit"
                    className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-700"
                  >
                    Tomar Consulta
                  </button>
                </form>
              )}

              {esResponsable && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
                    Esta Consulta está asignada a vos.
                  </div>

                  <GestionConsultaForm
                    consulta={{
                      id: consulta.id,
                      cliente: consulta.cliente,
                      dni: consulta.dni,
                      telefono: consulta.telefono,
                      tipo_domicilio: consulta.tipo_domicilio,
                      domicilio: consulta.domicilio,
                      entrecalles: consulta.entrecalles,
                      localidad: consulta.localidad,
                      observaciones: consulta.observaciones,
                      estado_consulta_id: consulta.estado_consulta_id,
                      estado_deuda_id: consulta.estado_deuda_id,
                      estado_cobertura_id: consulta.estado_cobertura_id,
                    }}
                    tipoCodigo={tipo?.codigo || ''}
                    estadosConsulta={estadosConsultaResult.data ?? []}
                  />
                </div>
              )}

              {perteneceAOtro && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  Esta Consulta ya está asignada a {nombreResponsable}.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
