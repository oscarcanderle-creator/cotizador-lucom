import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../../../utils/supabase/server'
import { createAdminClient } from '../../../../utils/supabase/admin'

const ROLES_PERMITIDOS = ['ADMIN', 'SUPERVISOR', 'BBOO', 'TERRENO', 'LOGISTICA']
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
  const cliente: any = uno(operacionR.data?.cliente)
  const domicilio: any = uno(operacionR.data?.domicilio)
  const direccion = [domicilio?.calle_nro, domicilio?.piso && `Piso ${domicilio.piso}`, domicilio?.dpto && `Dpto ${domicilio.dpto}`, domicilio?.barrio, domicilio?.localidad].filter(Boolean).join(' · ')

  return <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
    <div className="mx-auto max-w-xl space-y-5">
      <header className="rounded-2xl bg-red-700 p-5 text-white">
        <p className="text-sm">Grupo Lucom · Consulta de Logística</p>
        <h1 className="mt-1 text-2xl font-bold">Gestión {mostrar(gestion.codigo_gestion)}</h1>
        <p className="mt-1 text-sm">ID {id} · Operación {mostrar(gestion.operacion_id)}</p>
      </header>
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Estado actual</h2>
        <p className="mt-2 text-lg font-bold">{mostrar(estadoR.data?.nombre ?? estadoR.data?.codigo)}</p>
        <p className="mt-2 text-sm text-slate-600">Medio de despacho: {mostrar(medioR.data?.nombre)}</p>
        <p className="mt-2 text-sm text-slate-600">Lotes: {(lotesR.data ?? []).map(l => `${l.codigo_lote} (${l.estado})`).join(', ') || '—'}</p>
      </section>
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">Destinatario</h2>
        <p className="text-lg font-semibold">{mostrar([cliente?.apellido,cliente?.nombre].filter(Boolean).join(', '))}</p>
        <p className="mt-2">{mostrar(direccion)}</p>
        <p className="mt-2 text-sm">Entre calles: {mostrar(domicilio?.entre_calles)}</p>
        <p className="mt-2 text-sm">Teléfono: {mostrar(cliente?.telefono)}</p>
        {domicilio?.datos_extras && <p className="mt-2 text-sm">{mostrar(domicilio.datos_extras)}</p>}
      </section>
      <section className="rounded-2xl bg-white p-5 shadow-sm">
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
      <p className="text-center text-xs text-slate-500">Consulta de solo lectura. Escanear este QR no modifica la gestión.</p>
      <div className="text-center"><Link href="/" className="text-sm font-medium text-red-700 underline">Volver a PGL</Link></div>
    </div>
  </main>
}
