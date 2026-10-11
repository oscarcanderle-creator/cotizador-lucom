import { redirect } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'
import { createAdminClient } from '../../../utils/supabase/admin'
import ImprimirAhora from '../../../components/ImprimirAhora'
import QRCode from 'qrcode'
import { normalizarConfig } from '../../../lib/impresionDespacho'

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
  const { data: configuracionGuardada, error: errorConfiguracion } = await admin
    .from('configuracion_impresion_despacho')
    .select('publicado, version_publicada')
    .eq('id', 1)
    .single()
  if (errorConfiguracion || !configuracionGuardada || configuracionGuardada.version_publicada < 1) {
    throw new Error('No hay una configuración de impresión publicada. Publicala desde ADMIN antes de imprimir.')
  }
  const config = normalizarConfig(configuracionGuardada.publicado)
  const visible = (campo: keyof typeof config.campos) => config.campos[campo]
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

  const qrPorId = new Map<number, string>(await Promise.all(ids.map(async id => [id, await QRCode.toDataURL(`https://cotizador-lucom-psi.vercel.app/logistica/entrega/${id}`, { width: 260, margin: 2, errorCorrectionLevel: 'M' })] as const)))

  return <main className="mx-auto max-w-5xl bg-white px-4 py-6 text-gray-950 print:m-0 print:max-w-none print:p-0">
    <div className="print:hidden"><ImprimirAhora /></div>
    <p className="mb-4 text-xs text-gray-500 print:hidden">Diseño publicado (versión {configuracionGuardada.version_publicada}). Cada hoja corresponde a una entrega. La solicitud de impresión ya fue registrada en PGL.</p>
    {ids.map(id => {
      const gestion = gestiones.find(g => g.id === id)!
      const operacion = operaciones.get(String(gestion.operacion_id))
      const cliente: any = uno(operacion?.cliente)
      const domicilio: any = uno(operacion?.domicilio)
      const chips = items.filter(i => i.gestion_entrega_id === id)
      const domicilioTexto = [domicilio?.calle_nro, domicilio?.piso && `Piso ${domicilio.piso}`, domicilio?.dpto && `Dpto ${domicilio.dpto}`, domicilio?.barrio, domicilio?.localidad].filter(Boolean).join(' · ')
      return <article key={id} className="hoja-despacho relative mx-auto mb-8 bg-white text-black shadow-md print:mb-0 print:shadow-none" style={{ width: '210mm', height: '297mm', fontSize: `${config.tamanoFuente}pt`, breakAfter: 'page', pageBreakAfter: 'always', overflow: 'hidden' }}>
        <div className="relative flex flex-col justify-between border-b-2 border-dashed border-gray-500 px-[10mm] py-[7mm]" style={{ height: '74.25mm' }}>
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0" style={{ maxWidth: '115mm' }}>
              {config.mostrarLogo && <img src="/branding/logo-lucom.png" alt="Grupo Lucom" className="mb-1 max-h-[14mm] max-w-[45mm] object-contain" />}
              <h1 className="font-bold">{config.titulo}</h1>
              <p className="text-xs">{config.subtitulo}</p>
            </div>
            {config.mostrarLogoClaro && <img src="/branding/logo-claro.png" alt="Claro" className="absolute top-0 object-contain" style={{ width: `${config.tamanoLogoClaro}mm`, height: `${config.tamanoLogoClaro}mm`, left: '50%', transform: 'translateX(-50%)' }} />}
            <div className="ml-auto shrink-0 text-right text-xs">
              {visible('codigo') && <p className="font-bold">{mostrar(gestion.codigo_gestion)}</p>}
              {visible('qr') && <img src={qrPorId.get(id)} alt={`QR de la gestión ${id}`} className="ml-auto mt-1 object-contain" style={{ width: '23mm', height: '23mm' }} />}
            </div>
          </div>
          <div className="text-sm">
            {visible('destinatario') && <p><strong>Destinatario:</strong> {mostrar([cliente?.apellido, cliente?.nombre].filter(Boolean).join(', '))}</p>}
            {visible('domicilio') && <p><strong>Domicilio:</strong> {mostrar(domicilioTexto)}</p>}
          </div>
        </div>
        <div className="space-y-5 px-[10mm] py-[12mm]">
          {visible('operacion') && <p><strong>Operación:</strong> {mostrar(gestion.operacion_id)}</p>}
          {visible('medio') && <p><strong>Medio:</strong> {mostrar(medios.get(Number(gestion.medio_despacho_chip_id)))}</p>}
          {visible('entreCalles') && <p><strong>Entre calles:</strong> {mostrar(domicilio?.entre_calles)}</p>}
          {visible('telefono') && <p><strong>Contacto:</strong> {mostrar(cliente?.telefono)}</p>}
          {visible('chips') && <section>
            <h2 className="mb-2 border-b pb-1 font-bold">CHIPS INCLUIDOS ({chips.length})</h2>
            <table className="w-full border-collapse text-left text-xs">
              <thead><tr><th className="border p-2">Tipo</th><th className="border p-2">SIM</th>{visible('planStl') && <th className="border p-2">Plan STL</th>}{visible('planContratado') && <th className="border p-2">Plan contratado</th>}</tr></thead>
              <tbody>{chips.map(item => {
                const producto = productos.get(Number(item.producto_operacion_id))
                const movil = moviles.get(Number(item.producto_operacion_id))
                const contratado = mostrar(producto?.plan_snapshot)
                const cargado = mostrar(movil?.plan_cargado)
                return <tr key={item.producto_operacion_id}>
                  <td className="border p-2">{producto?.tipo_producto === 'LINEA_NUEVA' ? 'Línea nueva' : 'Portabilidad'}</td>
                  <td className="border p-2">{mostrar(item.sim_snapshot)}</td>
                  {visible('planStl') && <td className="border p-2">{cargado}</td>}
                  {visible('planContratado') && <td className="border p-2">{contratado !== cargado ? contratado : 'Igual a STL'}</td>}
                </tr>
              })}</tbody>
            </table>
          </section>}
          {config.nota && <section><h2 className="mb-2 border-b pb-1 font-bold">INSTRUCCIONES</h2><p className="whitespace-pre-wrap">{config.nota}</p></section>}
          {(visible('firma') || visible('dniRecepcion')) && <section>
            <h2 className="mb-2 border-b pb-1 font-bold">RECEPCIÓN</h2>
            <p className="mb-5 whitespace-pre-wrap">{config.textoRecepcion}</p>
            {visible('firma') && <p className="mb-4">Firma: ______________________ Aclaración: ______________________</p>}
            {visible('dniRecepcion') && <p>DNI: ______________________ Fecha: ______________________</p>}
          </section>}
        </div>
      </article>
    })}
    <style>{`@media print { @page { size: A4 portrait; margin: 0; } html, body { margin: 0 !important; padding: 0 !important; background: white !important; } .hoja-despacho { margin: 0 !important; width: 210mm !important; height: 297mm !important; break-after: page; page-break-after: always; } .hoja-despacho:last-of-type { break-after: auto; page-break-after: auto; } }`}</style>
  </main>
}
