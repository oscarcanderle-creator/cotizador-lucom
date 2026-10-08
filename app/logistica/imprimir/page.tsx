import { redirect } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'
import { createAdminClient } from '../../../utils/supabase/admin'
import ImprimirAhora from '../../../components/ImprimirAhora'

export default async function ImprimirLogistica({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: perfil } = await supabase.from('profiles').select('rol, activo').eq('id', user.id).single()
  if (!perfil?.activo || !['ADMIN', 'SUPERVISOR', 'BBOO'].includes(perfil.rol)) redirect('/ventas')
  const params = await searchParams
  const idsTexto = String(params.ids ?? '')
  if (!/^\d+(,\d+)*$/.test(idsTexto)) throw new Error('Selección de entregas inválida.')
  const ids = [...new Set(idsTexto.split(',').map(Number))]
  if (ids.length === 0 || ids.length > 100 || ids.some(id => !Number.isSafeInteger(id) || id <= 0)) throw new Error('Selección inválida.')

  const admin = createAdminClient()
  const { data: gestiones, error: errorGestiones } = await admin.from('gestiones_entrega')
    .select('id, codigo_gestion, operacion_id, cantidad_impresiones, medio_despacho_chip_id')
    .in('id', ids)
  if (errorGestiones || !gestiones || gestiones.length !== ids.length) throw new Error('No se pudieron recuperar todas las entregas.')
  const { data: items, error: errorItems } = await admin.from('gestion_entrega_items')
    .select('gestion_entrega_id, producto_operacion_id, sim_snapshot').in('gestion_entrega_id', ids)
  if (errorItems || !items) throw new Error('No se pudieron recuperar los chips.')
  const operacionIds = [...new Set(gestiones.map(g => g.operacion_id))]
  const productoIds = [...new Set(items.map(i => i.producto_operacion_id))]
  const [operacionesR, productosR, gestionMovilR, mediosR] = await Promise.all([
    admin.from('operaciones').select('id_operacion, cliente:clientes(nombre,apellido,telefono), domicilio:domicilios(calle_nro,piso,dpto,entre_calles,barrio,localidad,datos_extras)').in('id_operacion', operacionIds),
    admin.from('operacion_productos').select('id,tipo_producto,plan_snapshot').in('id', productoIds),
    admin.from('gestion_producto_movil').select('producto_operacion_id,plan_cargado').in('producto_operacion_id', productoIds),
    admin.from('medios_despacho_chip').select('id,nombre').in('id', gestiones.map(g => g.medio_despacho_chip_id)),
  ])
  for (const resultado of [operacionesR, productosR, gestionMovilR, mediosR]) if (resultado.error) throw new Error(resultado.error.message)
  const operaciones = new Map((operacionesR.data ?? []).map(o => [String(o.id_operacion), o]))
  const productos = new Map((productosR.data ?? []).map(p => [Number(p.id), p]))
  const moviles = new Map((gestionMovilR.data ?? []).map(m => [Number(m.producto_operacion_id), m]))
  const medios = new Map((mediosR.data ?? []).map(m => [Number(m.id), m.nombre]))
  const uno = (valor: any) => Array.isArray(valor) ? valor[0] : valor
  const mostrar = (valor: unknown) => String(valor ?? '').trim() || '—'

  return <main className="mx-auto max-w-4xl bg-white p-6 text-gray-950 print:max-w-none print:p-0">
    <ImprimirAhora />
    <p className="mb-4 text-xs text-gray-500 print:hidden">Cada hoja corresponde a una entrega. La solicitud de impresión ya fue registrada en PGL.</p>
    {ids.map(id => {
      const gestion = gestiones.find(g => g.id === id)!
      const operacion = operaciones.get(String(gestion.operacion_id))
      const cliente: any = uno(operacion?.cliente)
      const domicilio: any = uno(operacion?.domicilio)
      const chips = items.filter(i => i.gestion_entrega_id === id)
      const domicilioTexto = [domicilio?.calle_nro, domicilio?.piso && `Piso ${domicilio.piso}`, domicilio?.dpto && `Dpto ${domicilio.dpto}`, domicilio?.barrio, domicilio?.localidad].filter(Boolean).join(' · ')
      return <article key={id} className="mb-8 min-h-[245mm] break-after-page border border-gray-300 p-8 print:mb-0 print:border-0 print:p-6">
        <div className="flex items-start justify-between border-b-2 border-gray-900 pb-4">
          <div><h1 className="text-2xl font-bold">HOJA DE ENVÍO</h1><p className="text-sm">Grupo Lucom · Logística</p></div>
          <div className="text-right text-sm"><strong>{mostrar(gestion.codigo_gestion)}</strong><div>Operación: {mostrar(gestion.operacion_id)}</div><div>{mostrar(medios.get(Number(gestion.medio_despacho_chip_id)))}</div></div>
        </div>
        <section className="mt-6 space-y-2"><h2 className="font-bold uppercase">Destinatario</h2>
          <p><strong>Nombre:</strong> {mostrar([cliente?.apellido, cliente?.nombre].filter(Boolean).join(', '))}</p>
          <p><strong>Domicilio:</strong> {mostrar(domicilioTexto)}</p>
          <p><strong>Entre calles:</strong> {mostrar(domicilio?.entre_calles)}</p>
          <p><strong>Contacto para entrega:</strong> {mostrar(cliente?.telefono)}</p>
        </section>
        <section className="mt-8"><h2 className="mb-3 font-bold uppercase">Chips incluidos ({chips.length})</h2>
          <table className="w-full border-collapse text-left text-sm"><thead><tr className="bg-gray-100"><th className="border p-2">Tipo</th><th className="border p-2">SIM</th><th className="border p-2">Plan STL</th><th className="border p-2">Plan contratado</th></tr></thead><tbody>
            {chips.map(item => {
              const producto = productos.get(Number(item.producto_operacion_id))
              const movil = moviles.get(Number(item.producto_operacion_id))
              const contratado = mostrar(producto?.plan_snapshot)
              const cargado = mostrar(movil?.plan_cargado)
              return <tr key={item.producto_operacion_id}><td className="border p-2">{producto?.tipo_producto === 'LINEA_NUEVA' ? 'Línea nueva' : 'Portabilidad'}</td><td className="border p-2">{mostrar(item.sim_snapshot)}</td><td className="border p-2">{cargado}</td><td className="border p-2">{contratado !== cargado ? contratado : 'Igual a STL'}</td></tr>
            })}
          </tbody></table>
        </section>
        <section className="mt-10 border-t pt-4"><h2 className="font-bold uppercase">Nota de envío</h2><p className="mt-2 text-sm text-gray-600">Pendiente de configuración por el administrador.</p></section>
        <section className="mt-10 border-t pt-4"><p className="text-sm">Recepción: ____________________________________</p><p className="mt-4 text-sm">Fecha: ___________________</p></section>
      </article>
    })}
  </main>
}
