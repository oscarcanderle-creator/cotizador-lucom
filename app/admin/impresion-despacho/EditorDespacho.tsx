'use client'

import { useState } from 'react'
import { CAMPOS, ConfigDespacho } from '../../../lib/impresionDespacho'

type Props = { inicial: ConfigDespacho; publicada: ConfigDespacho; version: number; fechaPublicada: string | null }
export default function EditorDespacho({ inicial, publicada, version, fechaPublicada }: Props) {
  const [config, setConfig] = useState<ConfigDespacho>(inicial)
  const [guardada, setGuardada] = useState<ConfigDespacho>(inicial)
  const [versionActual, setVersionActual] = useState(version)
  const [publicadaActual, setPublicadaActual] = useState(publicada)
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [modo, setModo] = useState<'borrador' | 'publicada'>('borrador')
  const [fecha, setFecha] = useState(fechaPublicada)
  const sinGuardar = JSON.stringify(config) !== JSON.stringify(guardada)
  const cambiarTexto = (campo: 'titulo' | 'subtitulo' | 'nota' | 'textoRecepcion', valor: string) => setConfig(v => ({ ...v, [campo]: valor }))
  async function ejecutar(accion: 'guardar' | 'publicar') {
    if (accion === 'publicar' && sinGuardar) { setMensaje('Primero guardá el borrador antes de publicarlo.'); return }
    if (accion === 'publicar' && !window.confirm('¿Publicar este diseño para las próximas impresiones de Logística?')) return
    setOcupado(true); setMensaje('')
    try {
      const response = await fetch('/api/admin/impresion-despacho', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, configuracion: config }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación.')
      if (accion === 'guardar') setGuardada(config)
      if (accion === 'publicar') { setVersionActual(data.version); setPublicadaActual(guardada); setFecha(new Date().toISOString()); setModo('publicada') }
      setMensaje(data.mensaje)
    } catch (e) { setMensaje(e instanceof Error ? e.message : 'Error inesperado.') }
    finally { setOcupado(false) }
  }
  const vista = modo === 'borrador' ? config : publicadaActual
  const visible = (key: keyof ConfigDespacho['campos']) => vista.campos[key]
  return <div className="mx-auto max-w-7xl px-4 py-8 text-gray-900">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Impresión de despacho</h1><p className="mt-1 text-sm text-gray-600">A4 vertical · Primer cuarto visible · Tres cuartos interiores</p></div>
      <a href="/admin" className="rounded-lg border px-4 py-2 text-sm">Volver a ADMIN</a>
    </div>
    <div className="mb-5 rounded-lg border bg-white p-4 text-sm">Versión publicada: <strong>{versionActual || 'Ninguna'}</strong>{fecha && <> · Publicada el {new Date(fecha).toLocaleString('es-AR')}</>}{sinGuardar && <strong className="ml-3 text-amber-700">Cambios sin guardar</strong>}</div>
    <div className="grid gap-6 xl:grid-cols-[minmax(300px,420px)_1fr]">
      <div className="space-y-5">
        <section className="rounded-xl border bg-white p-5"><h2 className="mb-4 font-semibold">Identidad y textos</h2>
          {([['titulo','Título',80],['subtitulo','Subtítulo',120],['nota','Instrucciones de despacho',1500],['textoRecepcion','Texto de recepción',500]] as const).map(([key,label,max]) => <label key={key} className="mb-4 block text-sm"><span className="mb-1 block font-medium">{label}</span>{key === 'nota' || key === 'textoRecepcion' ? <textarea maxLength={max} rows={3} value={config[key]} onChange={e => cambiarTexto(key,e.target.value)} className="w-full rounded-lg border p-2" /> : <input maxLength={max} value={config[key]} onChange={e => cambiarTexto(key,e.target.value)} className="w-full rounded-lg border p-2" />}</label>)}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.mostrarLogo} onChange={e => setConfig(v => ({...v,mostrarLogo:e.target.checked}))} /> Mostrar logo Grupo Lucom</label>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={config.mostrarLogoClaro} onChange={e => setConfig(v => ({...v,mostrarLogoClaro:e.target.checked}))} /> Mostrar logo Claro</label>
          <label className="mt-3 block text-sm">Ancho logo Claro: {config.tamanoLogoClaro} mm<input type="range" min="14" max="36" step="1" value={config.tamanoLogoClaro} disabled={!config.mostrarLogoClaro} onChange={e => setConfig(v => ({...v,tamanoLogoClaro:Number(e.target.value)}))} className="mt-2 w-full" /></label>
          <label className="mt-4 block text-sm">Tamaño de texto: {config.tamanoFuente} pt<input type="range" min="10" max="16" step="1" value={config.tamanoFuente} onChange={e => setConfig(v => ({...v,tamanoFuente:Number(e.target.value)}))} className="mt-2 w-full" /></label>
        </section>
        <section className="rounded-xl border bg-white p-5"><h2 className="mb-3 font-semibold">Campos visibles</h2>
          {(['Exterior','Interior'] as const).map(zona => <div key={zona} className="mb-4"><h3 className="mb-2 text-sm font-semibold text-gray-500">{zona} {zona === 'Exterior' ? '(¼ A4)' : '(¾ A4)'}</h3><div className="space-y-2">{CAMPOS.filter(c => c.zona === zona).map(c => <label key={c.key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.campos[c.key]} onChange={e => setConfig(v => ({...v,campos:{...v.campos,[c.key]:e.target.checked}}))}/>{c.nombre}</label>)}</div></div>)}
        </section>
        <div className="flex flex-wrap gap-3"><button disabled={ocupado || !sinGuardar} onClick={() => ejecutar('guardar')} className="rounded-lg bg-gray-900 px-5 py-2 font-semibold text-white disabled:opacity-50">Guardar borrador</button><button disabled={ocupado || sinGuardar} onClick={() => ejecutar('publicar')} className="rounded-lg bg-red-600 px-5 py-2 font-semibold text-white disabled:opacity-50">Publicar</button></div>
        {mensaje && <p role="status" className="rounded-lg border bg-white p-3 text-sm">{mensaje}</p>}
      </div>
      <div className="min-w-0"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Vista previa · datos de ejemplo</h2><div className="flex gap-2"><button onClick={() => setModo('borrador')} className={`rounded-lg px-3 py-2 text-sm ${modo === 'borrador' ? 'bg-gray-900 text-white' : 'border bg-white'}`}>Borrador</button><button onClick={() => setModo('publicada')} className={`rounded-lg px-3 py-2 text-sm ${modo === 'publicada' ? 'bg-gray-900 text-white' : 'border bg-white'}`}>Publicado</button><button onClick={() => window.print()} className="rounded-lg border bg-white px-3 py-2 text-sm">Imprimir prueba</button></div></div>
        <div className="overflow-x-auto rounded-xl border bg-gray-200 p-3 sm:p-6"><article className="hoja-despacho relative mx-auto bg-white text-black shadow-lg" style={{width:'210mm',minHeight:'297mm',fontSize:`${vista.tamanoFuente}pt`}}>
          <div className="relative flex flex-col justify-between border-b-2 border-dashed border-gray-500 px-[10mm] py-[7mm]" style={{height:'74.25mm'}}>
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
              <div className="min-w-0">{vista.mostrarLogo && <img src="/branding/logo-lucom.png" alt="Grupo Lucom" className="mb-1 max-h-[14mm] max-w-[45mm] object-contain object-left" />}<h2 className="font-bold">{vista.titulo}</h2><p className="text-xs">{vista.subtitulo}</p></div>
            <div className="flex items-start justify-center">
  {vista.mostrarLogoClaro && (
    <img
      src="/branding/logo-claro.png"
      alt="Claro"
      style={{
        width: `${vista.tamanoLogoClaro}mm`,
        height: 'auto',
        maxWidth: 'none',
        maxHeight: 'none',
      }}
      className="object-contain"
    />
  )}
</div>
              <div className="justify-self-end text-right text-xs">{visible('codigo') && <p className="font-bold">GE-000123</p>}{visible('qr') && <div className="mt-1 flex h-[23mm] w-[23mm] items-center justify-center border border-gray-500 text-center text-[10px]">QR<br/>de ejemplo</div>}</div>
            </div>
            <div className="text-sm">{visible('destinatario') && <p><strong>Destinatario:</strong> Pérez, María</p>}{visible('domicilio') && <p><strong>Domicilio:</strong> Av. Ejemplo 123 · Centro · Córdoba</p>}</div>
            <p className="absolute bottom-0 right-2 translate-y-full text-[9px] text-gray-500">DOBLAR AQUÍ — ¼ A4</p>
          </div>
          <div className="space-y-5 px-[10mm] py-[12mm]">{visible('operacion') && <p><strong>Operación:</strong> 12345</p>}{visible('medio') && <p><strong>Medio:</strong> Mensajería</p>}{visible('entreCalles') && <p><strong>Entre calles:</strong> San Martín y Belgrano</p>}{visible('telefono') && <p><strong>Contacto:</strong> 351 000 0000</p>}
            {visible('chips') && <section><h3 className="mb-2 border-b pb-1 font-bold">CHIPS INCLUIDOS</h3><table className="w-full border-collapse text-left text-xs"><thead><tr><th className="border p-2">Tipo</th><th className="border p-2">SIM</th>{visible('planStl') && <th className="border p-2">Plan STL</th>}{visible('planContratado') && <th className="border p-2">Plan contratado</th>}</tr></thead><tbody><tr><td className="border p-2">Portabilidad</td><td className="border p-2">895400000000</td>{visible('planStl') && <td className="border p-2">7 GB</td>}{visible('planContratado') && <td className="border p-2">7 GB</td>}</tr></tbody></table></section>}
            {vista.nota && <section><h3 className="mb-2 border-b pb-1 font-bold">INSTRUCCIONES</h3><p className="whitespace-pre-wrap">{vista.nota}</p></section>}
            {(visible('firma') || visible('dniRecepcion')) && <section><h3 className="mb-2 border-b pb-1 font-bold">RECEPCIÓN</h3><p className="mb-5 whitespace-pre-wrap">{vista.textoRecepcion}</p>{visible('firma') && <p className="mb-4">Firma: ______________________ Aclaración: ______________________</p>}{visible('dniRecepcion') && <p>DNI: ______________________ Fecha: ______________________</p>}</section>}
          </div>
        </article></div><p className="mt-2 text-xs text-gray-500">La vista previa es ilustrativa. La impresión operativa actual no se modifica en esta etapa.</p>
      </div>
    </div>
    <style jsx global>{`@media print { @page { size: A4 portrait; margin: 0; } body { background: white !important; } body * { visibility: hidden !important; } .hoja-despacho, .hoja-despacho * { visibility: visible !important; } .hoja-despacho { position: absolute !important; left: 0; top: 0; box-shadow: none !important; width: 210mm !important; min-height: 297mm !important; } }`}</style>
  </div>
}
