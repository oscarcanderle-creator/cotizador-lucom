'use client'

import { useState } from 'react'
import { consultarHistorialClaro } from './actions'

type Vigencia = { id: string; vigente_desde: string | null; vigente_hasta: string | null; motivo_apertura: string | null; motivo_cierre: string | null }
type Evento = { id: string; accion: string; usuario: string; datos_anteriores: Record<string, unknown> | null; datos_nuevos: Record<string, unknown> | null; created_at: string }
type Resultado = { vigencias: Vigencia[]; eventos: Evento[] }
const fecha = (v: string | null) => v ? v.split('-').reverse().join('/') : 'Sin fecha registrada'
const fechaHora = (v: string) => new Date(v).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hourCycle: 'h23' })
const nombres: Record<string, string> = {
  nombre: 'Nombre', dni: 'DNI', tipo: 'Tipo', activo: 'Estado',
  fecha_alta: 'Fecha de alta', fecha_baja: 'Fecha de baja',
  fecha_reactivacion: 'Fecha de reactivación', observaciones: 'Observaciones',
  motivo: 'Motivo', motivo_baja: 'Motivo de baja', motivo_reactivacion: 'Motivo de reactivación',
  profile_id: 'Vínculo con PGL', punto_venta_id: 'Vínculo con PDV', asesor_pdv_id: 'Vínculo con asesor PDV',
}
function mostrar(campo: string, valor: unknown) {
  if (valor === null || valor === undefined || valor === '') return 'Sin dato'
  if (campo === 'activo' && typeof valor === 'boolean') return valor ? 'Activo' : 'Inactivo'
  if (campo.endsWith('_id')) return 'Vinculado'
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return fecha(valor)
  return typeof valor === 'object' ? JSON.stringify(valor) : String(valor)
}
function cambios(e: Evento) {
  const antes = e.datos_anteriores ?? {}
  const despues = e.datos_nuevos ?? {}
  return [...new Set([...Object.keys(antes), ...Object.keys(despues)])]
    .filter(k => !['id', 'created_at', 'updated_at', 'evento'].includes(k))
    .filter(k => e.accion === 'INSERT' ? despues[k] != null : JSON.stringify(antes[k]) !== JSON.stringify(despues[k]))
    .map(k => ({ campo: k, nombre: nombres[k] ?? k.replaceAll('_', ' '), anterior: mostrar(k, antes[k]), nuevo: mostrar(k, despues[k]), cambioVinculo: k.endsWith('_id') && antes[k] != null && despues[k] != null && antes[k] !== despues[k] }))
}
function etiqueta(e: Evento) {
  const evento = e.datos_nuevos?.evento
  if (evento === 'BAJA_TITULAR') return 'Baja de titular'
  if (evento === 'REACTIVACION_TITULAR') return 'Reactivación de titular'
  if (e.accion === 'INSERT') return 'Alta de titular'
  if (e.accion === 'UPDATE') return 'Modificación'
  return e.accion
}
export default function HistorialClaro({ tipo, id, nombre }: { tipo: 'titular' | 'codigo'; id: string; nombre: string }) {
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [datos, setDatos] = useState<Resultado | null>(null)
  const [error, setError] = useState('')
  async function abrir() {
    setAbierto(true)
    setCargando(true)
    setDatos(null)
    setError('')
    try {
      setDatos(await consultarHistorialClaro(tipo, id))
    } catch {
      setError('No se pudo consultar el historial. Cerrá la ventana e intentá nuevamente.')
    } finally { setCargando(false) }
  }
  return <>
    <button type="button" onClick={abrir} disabled={cargando} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100">Historial</button>
    {abierto && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby={'historial-' + id} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div><h2 id={'historial-' + id} className="text-xl font-semibold text-gray-900">{tipo === 'codigo' ? 'Historial de vigencias' : 'Historial del titular'}</h2><p className="text-sm text-gray-600">{nombre}</p></div>
          <button type="button" aria-label="Cerrar historial" onClick={() => setAbierto(false)} className="text-2xl text-gray-500">×</button>
        </div>
        <div className="space-y-3 p-6 text-sm text-gray-700">
          {cargando && <p role="status">Consultando historial...</p>}
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
          {datos && tipo === 'codigo' && <>
            {!datos.vigencias.length && <p>No hay vigencias registradas.</p>}
            {datos.vigencias.map(v => <div key={v.id} className="rounded-xl border border-gray-200 p-4 space-y-2">
              <div className="flex justify-between gap-2"><strong>{fecha(v.vigente_desde)} — {v.vigente_hasta ? fecha(v.vigente_hasta) : 'Sin cierre'}</strong><span className={v.vigente_hasta ? 'text-gray-500' : 'text-green-700'}>{v.vigente_hasta ? 'Cerrado' : 'Abierto'}</span></div>
              <p>Motivo de apertura: {v.motivo_apertura || 'Sin motivo registrado'}</p>
              {v.vigente_hasta && <p>Motivo de cierre: {v.motivo_cierre || 'Sin motivo registrado'}</p>}
            </div>)}
          </>}
          {datos && tipo === 'titular' && <>
            {!datos.eventos.length && <p>No hay eventos registrados.</p>}
            {datos.eventos.map(e => <details key={e.id} className="rounded-xl border border-gray-200 p-4">
              <summary className="cursor-pointer"><strong>{etiqueta(e)}</strong><span className="ml-3 text-gray-500">{fechaHora(e.created_at)} · {e.usuario}</span></summary>
              <div className="mt-3 overflow-x-auto">
                {cambios(e).length ? <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50"><tr><th className="p-2">Campo</th>{e.accion !== 'INSERT' && <th className="p-2">Anterior</th>}<th className="p-2">{e.accion === 'INSERT' ? 'Valor' : 'Nuevo'}</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">{cambios(e).map(v => <tr key={v.campo}><td className="p-2 font-medium">{v.nombre}</td>{e.accion !== 'INSERT' && <td className="p-2 text-gray-500 break-words">{v.anterior}</td>}<td className="p-2 break-words">{v.cambioVinculo ? 'Vínculo modificado' : v.nuevo}</td></tr>)}</tbody>
                </table> : <p className="text-gray-500">Sin cambios de campos visibles. Consultá el detalle técnico.</p>}
              </div>
              <details className="mt-3 border-t border-gray-100 pt-3">
                <summary className="cursor-pointer text-xs text-gray-500">Ver detalle técnico completo</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[['Valores anteriores', e.datos_anteriores], ['Valores posteriores', e.datos_nuevos]].map(([titulo, valor], i) => <div key={i} className="min-w-0"><h3 className="font-medium">{String(titulo)}</h3><pre className="mt-1 whitespace-pre-wrap break-all rounded-lg bg-gray-50 p-3 text-xs">{valor ? JSON.stringify(valor, null, 2) : 'Sin datos registrados'}</pre></div>)}
              </div>
              </details>
            </details>)}
          </>}
          <p className="text-xs text-gray-500">Consulta de solo lectura. Los registros históricos no se modifican.</p>
        </div>
      </div>
    </div>}
  </>
}
