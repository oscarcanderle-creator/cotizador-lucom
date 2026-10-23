import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../../../utils/supabase/server'
import { createAdminClient } from '../../../../utils/supabase/admin'

const ROLES_PERMITIDOS = ['ADMIN', 'SUPERVISOR', 'BBOO', 'TERRENO', 'LOGISTICA']
const ROLES_EVIDENCIAS = ['ADMIN', 'SUPERVISOR', 'BBOO']

function fechaArgentina(valor: string | null | undefined) {
  if (!valor) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Argentina/Cordoba',
  }).format(new Date(valor))
}

function modalidadTexto(valor: string | null | undefined) {
  return valor ? valor.replaceAll('_', ' ') : '—'
}
const mostrar = (v: unknown) => String(v ?? '').trim() || '—'
const uno = (v: any) => Array.isArray(v) ? v[0] : v

export default async function ConsultarEntregaQR({ params }: { params: Promise<{ id: string }> }) {
  const { id: idTexto } = await params
  if (!/^[1-9]\d*$/.test(idTexto) || !Number.isSafeInteger(Number(idTexto))) notFound()
  const id = Number(idTexto)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/logistica/entrega/${id}`)}`)
  const { data: perfil } = await supabase.from('profiles').select('rol, activo, debe_cambiar_password').eq('id', user.id).single()
  if (!perfil?.activo) redirect('/login')
  if (perfil.debe_cambiar_password) redirect('/cambiar-password')
  if (!ROLES_PERMITIDOS.includes(perfil.rol)) redirect('/ventas')

  // El cliente administrador se usa únicamente después de validar identidad y rol.
  const admin = createAdminClient()
  const { data: gestion, error } = await admin.from('gestiones_entrega')
    .select('id,codigo_gestion,operacion_id,estado_entrega_id,medio_despacho_chip_id,fecha_lista_entrega,fecha_primera_distribucion,created_at')
    .eq('id', id).maybeSingle()
  if (error) throw new Error(`No se pudo consultar la entrega: ${error.message}`)
  if (!gestion) notFound()

  const [operacionR, itemsR, estadoR, medioR, relacionesR] = await Promise.all([
    admin.from('operaciones').select('id_operacion,cliente:clientes(nombre,apellido,telefono),domicilio:domicilios(calle_nro,piso,dpto,entre_calles,barrio,localidad,datos_extras)').eq('id_operacion', gestion.operacion_id).maybeSingle(),
    admin.from('gestion_entrega_items').select('producto_operacion_id,sim_snapshot').eq('gestion_entrega_id', id),
    admin.from('estados_entrega').select('nombre,codigo').eq('id', gestion.estado_entrega_id).maybeSingle(),
    admin.from('medios_despacho_chip').select('nombre').eq('id', gestion.medio_despacho_chip_id).maybeSingle(),
    admin.from('lote_despacho_gestiones').select('lote_despacho_id').eq('gestion_entrega_id', id),
  ])
  for (const r of [operacionR,itemsR,estadoR,medioR,relacionesR]) if (r.error) throw new Error(r.error.message)
  const loteIds = [...new Set((relacionesR.data ?? []).map(x => x.lote_despacho_id))]
  const lotesR = loteIds.length ? await admin.from('lotes_despacho').select('id,codigo_lote,estado').in('id', loteIds) : { data: [], error: null }
  if (lotesR.error) throw new Error(lotesR.error.message)
  const items = itemsR.data ?? []
  const productoIds = items.map(x => x.producto_operacion_id)
  const productosR = productoIds.length ? await admin.from('operacion_productos').select('id,tipo_producto,plan_snapshot').in('id', productoIds) : { data: [], error: null }
  if (productosR.error) throw new Error(productosR.error.message)
  const productos = new Map((productosR.data ?? []).map(p => [Number(p.id), p]))
  const puedeVerEvidencias = ROLES_EVIDENCIAS.includes(perfil.rol)

  const intentosR = puedeVerEvidencias
    ? await admin.from('lote_despacho_gestiones')
        .select('id,lote_despacho_id,resultado,fecha_resultado,observacion_cadete,resultado_por')
        .eq('gestion_entrega_id', id)
        .order('id', { ascending: false })
    : { data: [], error: null }

  if (intentosR.error) throw new Error(intentosR.error.message)

  const intentos = intentosR.data ?? []
  const intentoIds = intentos.map(x => x.id)

  const evidenciasR = intentoIds.length
    ? await admin.from('evidencias_entrega')
        .select('intento_id,modalidad,referencia,observacion,latitud,longitud,precision_metros,foto_path,capturado_por,registrado_en_servidor')
        .in('intento_id', intentoIds)
    : { data: [], error: null }

  if (evidenciasR.error) throw new Error(evidenciasR.error.message)

  const evidencias = new Map((evidenciasR.data ?? []).map(e => [e.intento_id, e]))

  const responsablesIds = [...new Set([
    ...intentos.map(i => i.resultado_por),
    ...(evidenciasR.data ?? []).map(e => e.capturado_por),
  ].filter((v): v is string => Boolean(v)))]

  const responsablesR = responsablesIds.length
    ? await admin.from('profiles').select('id,nombre').in('id', responsablesIds)
    : { data: [], error: null }

  if (responsablesR.error) throw new Error(responsablesR.error.message)

  const responsables = new Map((responsablesR.data ?? []).map(p => [p.id, p.nombre]))

  const fotos = new Map<number, string>()

  for (const evidencia of evidenciasR.data ?? []) {
    if (evidencia.foto_path) {
      fotos.set(
        evidencia.intento_id,
        `/api/logistica/comprobante?intento_id=${evidencia.intento_id}`
      )
    }
  }

  const cliente: any = uno(operacionR.data?.cliente)
  const domicilio: any = uno(operacionR.data?.domicilio)
  const direccion = [domicilio?.calle_nro, domicilio?.piso && `Piso ${domicilio.piso}`, domicilio?.dpto && `Dpto ${domicilio.dpto}`, domicilio?.barrio, domicilio?.localidad].filter(Boolean).join(' · ')

  return <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
    <div className="mx-auto max-w-3xl space-y-3">
      <header className="rounded-2xl bg-red-700 p-5 text-white">
        <p className="text-sm">Grupo Lucom · Consulta de Logística</p>
        <h1 className="mt-1 text-2xl font-bold">Gestión {mostrar(gestion.codigo_gestion)}</h1>
        <p className="mt-1 text-sm">ID {id} · Operación {mostrar(gestion.operacion_id)}</p>
      </header>
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Estado actual</h2>
        <p className="mt-2 text-lg font-bold">{mostrar(estadoR.data?.nombre ?? estadoR.data?.codigo)}</p>
        <p className="mt-2 text-sm text-slate-600">Medio de despacho: {mostrar(medioR.data?.nombre)}</p>
        <p className="mt-2 text-sm text-slate-600">Lotes: {(lotesR.data ?? []).map(l => `${l.codigo_lote} (${l.estado})`).join(', ') || '—'}</p>
      </section>
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">Destinatario</h2>
        <p className="text-lg font-semibold">{mostrar([cliente?.apellido,cliente?.nombre].filter(Boolean).join(', '))}</p>
        <p className="mt-2">{mostrar(direccion)}</p>
        <p className="mt-2 text-sm">Entre calles: {mostrar(domicilio?.entre_calles)}</p>
        <p className="mt-2 text-sm">Teléfono: {mostrar(cliente?.telefono)}</p>
        {domicilio?.datos_extras && <p className="mt-2 text-sm">{mostrar(domicilio.datos_extras)}</p>}
      </section>
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">Chips incluidos ({items.length})</h2>
        {items.length === 0 ? <p className="text-sm text-slate-500">Sin chips registrados.</p> : <div className="space-y-3">{items.map(item => {
          const producto = productos.get(Number(item.producto_operacion_id))
          return <div key={item.producto_operacion_id} className="rounded-xl border p-3">
            <p className="font-medium">{producto?.tipo_producto === 'LINEA_NUEVA' ? 'Línea nueva' : 'Portabilidad'}</p>
            <p className="text-sm">SIM: {mostrar(item.sim_snapshot)}</p>
            <p className="text-sm">Plan: {mostrar(producto?.plan_snapshot)}</p>
          </div>
        })}</div>}
      </section>
      {puedeVerEvidencias && (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-base font-bold">Intentos y comprobantes de entrega</h2>

          {intentos.length === 0 ? (
            <p className="text-sm text-slate-500">Todavía no hay intentos registrados.</p>
          ) : (
            <div className="space-y-2">
              {intentos.map(intento => {
                const evidencia = evidencias.get(intento.id)
                const responsableId = intento.resultado_por ?? evidencia?.capturado_por
                const responsable = responsableId ? responsables.get(responsableId) : null
                const fotoUrl = fotos.get(intento.id)

                return (
                  <article key={intento.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-3 py-2">
                      <div>
                        <h3 className="font-bold text-slate-900">
                          {intento.resultado === 'ENTREGADO'
                            ? 'Entrega realizada'
                            : intento.resultado === 'NO_ENTREGADO'
                              ? 'Visita sin entrega'
                              : 'Visita de distribución'}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {fechaArgentina(intento.fecha_resultado)}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                        intento.resultado === 'ENTREGADO'
                          ? 'bg-green-100 text-green-800'
                          : intento.resultado === 'NO_ENTREGADO'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-100 text-slate-700'
                      }`}>
                        {mostrar(intento.resultado)}
                      </span>
                    </div>

                    <div className="space-y-2 p-3">
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Responsable</p>
                          <p className="text-sm font-semibold">{mostrar(responsable)}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Modalidad</p>
                          <p className="text-sm font-semibold">{modalidadTexto(evidencia?.modalidad)}</p>
                        </div>
                        {evidencia?.referencia && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recibido por</p>
                            <p className="text-sm">{evidencia.referencia}</p>
                          </div>
                        )}
                        {evidencia?.latitud != null && evidencia?.longitud != null && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ubicación GPS</p>
                            <a
                              href={`https://www.google.com/maps?q=${evidencia.latitud},${evidencia.longitud}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block text-sm font-semibold text-red-700 underline"
                            >
                              Ver ubicación en mapa ↗
                            </a>
                            <p className="mt-1 text-xs text-slate-500">
                              Precisión: {evidencia.precision_metros != null
                                ? `${Number(evidencia.precision_metros).toFixed(2)} metros`
                                : '—'}
                            </p>
                          </div>
                        )}
                      </div>

                      {(evidencia?.observacion || intento.observacion_cadete) && (
                        <div className="rounded-lg bg-slate-50 px-3 py-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Observaciones</p>
                          <p className="text-sm text-slate-800">
                            {mostrar(evidencia?.observacion ?? intento.observacion_cadete)}
                          </p>
                        </div>
                      )}

                      {fotoUrl ? (
                        <div className="flex items-center gap-3 border-t border-slate-100 pt-2">
                          <a
                            href={fotoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200"
                            title="Abrir fotografía completa"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={fotoUrl}
                              alt={`Comprobante de entrega del intento ${intento.id}`}
                              className="h-20 w-full object-cover"
                            />
                          </a>
                          <div>
                            <p className="text-sm font-bold text-slate-900">Comprobante fotográfico</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Fotografía registrada durante la entrega.
                            </p>
                            <a
                              href={fotoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-block text-sm font-semibold text-red-700 underline"
                            >
                              Ver fotografía completa ↗
                            </a>
                          </div>
                        </div>
                      ) : (
                        <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
                          {evidencia?.foto_path
                            ? 'No se pudo cargar el comprobante fotográfico.'
                            : 'Sin comprobante fotográfico registrado.'}
                        </p>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}

      <p className="text-center text-xs text-slate-500">Consulta de solo lectura. Escanear este QR no modifica la gestión.</p>
      <div className="text-center">
          <Link
            href="/logistica?bandeja=HISTORIAL"
            className="inline-flex rounded-lg bg-red-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800"
          >
            ← Volver a Logística
          </Link>
        </div>
    </div>
  </main>
}
