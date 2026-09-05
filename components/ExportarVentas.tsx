'use client'

import { useMemo, useState } from 'react'

type Props = { puedeExportar: boolean }
type Producto = 'BAF' | 'PORTA' | 'LN'
type BaseFecha = 'fecha_ingreso' | 'fecha_carga_stl' | 'fecha_porta'
type Formato = 'xlsx' | 'csv'
type CamposExportacion = 'vista' | 'todos'

export default function ExportarVentas({ puedeExportar }: Props) {
  const hoy = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const [abierto, setAbierto] = useState(false)
  const [desde, setDesde] = useState(hoy)
  const [hasta, setHasta] = useState(hoy)
  const [productos, setProductos] = useState<Producto[]>(['BAF', 'PORTA', 'LN'])
  const [baseFecha, setBaseFecha] = useState<BaseFecha>('fecha_ingreso')
  const [formato, setFormato] = useState<Formato>('xlsx')
  const [camposExportacion, setCamposExportacion] = useState<CamposExportacion>('vista')
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')

  const basesPermitidas = useMemo(() => {
    if (productos.includes('BAF')) return ['fecha_ingreso'] as BaseFecha[]
    if (productos.includes('LN')) return ['fecha_ingreso', 'fecha_carga_stl'] as BaseFecha[]
    return ['fecha_ingreso', 'fecha_carga_stl', 'fecha_porta'] as BaseFecha[]
  }, [productos])

  const alternarProducto = (producto: Producto) => {
    setProductos((actuales) => {
      const nuevos = actuales.includes(producto)
        ? actuales.filter((p) => p !== producto)
        : [...actuales, producto]
      const permitidas = nuevos.includes('BAF')
        ? ['fecha_ingreso']
        : nuevos.includes('LN')
          ? ['fecha_ingreso', 'fecha_carga_stl']
          : ['fecha_ingreso', 'fecha_carga_stl', 'fecha_porta']
      if (!permitidas.includes(baseFecha)) setBaseFecha('fecha_ingreso')
      return nuevos
    })
  }

  const exportar = async () => {
    setError('')
    if (!desde || !hasta) return setError('Indicá las fechas Desde y Hasta.')
    if (desde > hasta) return setError('La fecha Desde no puede ser posterior a Hasta.')
    if (productos.length === 0) return setError('Seleccioná al menos un producto.')
    if (!basesPermitidas.includes(baseFecha)) return setError('La base de fecha no es válida para los productos seleccionados.')

    setProcesando(true)
    try {
      const respuesta = await fetch('/api/gestion/exportar-ventas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ desde, hasta, productos, base_fecha: baseFecha, formato, campos_exportacion: camposExportacion }),
      })
      if (!respuesta.ok) {
        const data = await respuesta.json().catch(() => ({}))
        throw new Error(data?.error || 'No se pudo generar la exportación.')
      }
      const blob = await respuesta.blob()
      const disposicion = respuesta.headers.get('Content-Disposition') || ''
      const coincidencia = disposicion.match(/filename="?([^";]+)"?/i)
      const nombre = coincidencia?.[1] || `ventas.${formato}`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e?.message || 'No se pudo generar la exportación.')
    } finally { setProcesando(false) }
  }

  if (!puedeExportar) return null

  return (
    <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="font-semibold text-gray-900">Exportación de Datos</div><div className="text-sm text-gray-500">Elegí entre exportar la vista actual o todos los campos disponibles para tu rol.</div></div>
        <button type="button" onClick={() => setAbierto(!abierto)} className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50">{abierto ? 'Cerrar' : 'Exportar datos'}</button>
      </div>
      {abierto && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <label className="text-sm text-gray-700">Desde<input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
            <label className="text-sm text-gray-700">Hasta<input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
            <label className="text-sm text-gray-700">Fecha a utilizar<select value={baseFecha} onChange={(e) => setBaseFecha(e.target.value as BaseFecha)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"><option value="fecha_ingreso">Fecha Ingreso</option>{basesPermitidas.includes('fecha_carga_stl') && <option value="fecha_carga_stl">Fecha Carga STL</option>}{basesPermitidas.includes('fecha_porta') && <option value="fecha_porta">Fecha Porta</option>}</select></label>
            <div className="text-sm text-gray-700"><div>Productos</div><div className="mt-2 flex flex-wrap gap-3">{(['BAF','PORTA','LN'] as Producto[]).map((p) => <label key={p} className="flex items-center gap-1.5"><input type="checkbox" checked={productos.includes(p)} onChange={() => alternarProducto(p)} />{p}</label>)}</div></div>
            <label className="text-sm text-gray-700">Campos a exportar<select value={camposExportacion} onChange={(e) => setCamposExportacion(e.target.value as CamposExportacion)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"><option value="vista">Según vista actual</option><option value="todos">Todos los campos disponibles</option></select></label>
            <label className="text-sm text-gray-700">Formato<select value={formato} onChange={(e) => setFormato(e.target.value as Formato)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"><option value="xlsx">Excel (.xlsx)</option><option value="csv">CSV (.csv)</option></select></label>
          </div>
          {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="mt-4 flex justify-end"><button type="button" disabled={procesando} onClick={exportar} className="rounded-lg bg-red-600 px-5 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-60">{procesando ? 'Generando…' : 'Generar exportación'}</button></div>
        </div>
      )}
    </div>
  )
}
