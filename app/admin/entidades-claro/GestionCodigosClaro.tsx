'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { gestionarCodigoClaro } from './actions'
import HistorialClaro from './HistorialClaro'

type Codigo = {
  id: string
  tipo_codigo: string
  codigo: string
  activo: boolean
  vigente_desde: string | null
  vigente_hasta: string | null
}
type Entidad = { id: string; nombre: string; activo: boolean; entidades_claro_codigos: Codigo[] }
type Accion = 'alta' | 'baja' | 'reactivar'

export default function GestionCodigosClaro({ entidad }: { entidad: Entidad }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [accion, setAccion] = useState<Accion | null>(null)
  const [codigoId, setCodigoId] = useState('')
  const [tipo, setTipo] = useState('IDENTITY')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const seleccionado = entidad.entidades_claro_codigos.find(c => c.id === codigoId)
  const hoy = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date())
  const campo = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
  const boton = 'rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-100 disabled:opacity-50'
  const fecha = (valor: string | null) => valor ? valor.split('-').reverse().join('/') : '—'

  function elegir(a: Accion | null, id = '') {
    setAccion(a)
    setCodigoId(id)
    setTipo('IDENTITY')
    setError('')
    setExito('')
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (guardando || !accion || !entidad.activo) return
    const datos = new FormData(event.currentTarget)
    datos.set('accion', accion)
    datos.set('entidad_id', entidad.id)
    datos.set('codigo_id', codigoId)
    setGuardando(true)
    setError('')
    try {
      const resultado = await gestionarCodigoClaro(datos)
      if (!resultado.ok) { setError(resultado.mensaje); return }
      elegir(null)
      setExito(resultado.mensaje)
      router.refresh()
    } catch {
      setError('No se pudo confirmar la operación. Verificá el maestro antes de reintentar.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <button type="button" className={boton} onClick={() => { elegir(null); setAbierto(true) }}>Códigos</button>
      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby={'codigos-' + entidad.id}
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 id={'codigos-' + entidad.id} className="text-xl font-semibold text-gray-900">Códigos Claro</h2>
                <p className="text-sm text-gray-600">{entidad.nombre}</p>
              </div>
              <button type="button" aria-label="Cerrar" disabled={guardando} onClick={() => setAbierto(false)} className="text-2xl text-gray-500">×</button>
            </div>
            <div className="space-y-4 p-6">
              {!entidad.activo && <p className="text-sm text-gray-600">Titular inactivo. Reactivá primero la entidad para administrar sus códigos.</p>}
              <div className="flex justify-end">
                <button type="button" disabled={!entidad.activo || guardando} onClick={() => elegir('alta')}
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-50">+ Agregar código</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-700">
                  <thead className="bg-gray-100"><tr>
                    {['Tipo', 'Código', 'Estado', 'Desde', 'Hasta', 'Acciones'].map(t => <th key={t} className="p-2 whitespace-nowrap">{t}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {entidad.entidades_claro_codigos.map(c => <tr key={c.id}>
                      <td className="p-2">{c.tipo_codigo}</td>
                      <td className="p-2 font-mono">{c.codigo}</td>
                      <td className={'p-2 ' + (c.activo ? 'text-green-700' : 'text-gray-500')}>{c.activo ? 'Activo' : 'Inactivo'}</td>
                      <td className="p-2 whitespace-nowrap">{fecha(c.vigente_desde)}</td>
                      <td className="p-2 whitespace-nowrap">{fecha(c.vigente_hasta)}</td>
                      <td className="p-2"><div className="flex flex-wrap gap-1"><HistorialClaro tipo="codigo" id={c.id} nombre={c.codigo + " — " + c.tipo_codigo} /><button type="button" className={boton} disabled={!entidad.activo || guardando}
                        onClick={() => elegir(c.activo ? 'baja' : 'reactivar', c.id)}>{c.activo ? 'Dar de baja' : 'Reactivar'}</button></div></td>
                    </tr>)}
                    {!entidad.entidades_claro_codigos.length && <tr><td colSpan={6} className="p-4 text-center">Sin códigos registrados.</td></tr>}
                  </tbody>
                </table>
              </div>
              {accion && (
                <form key={accion + codigoId} onSubmit={guardar} className="space-y-3 rounded-xl border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-900">{accion === 'alta' ? 'Agregar código' : accion === 'baja' ? 'Dar de baja código' : 'Reactivar código'} {seleccionado?.codigo}</h3>
                  <fieldset disabled={guardando} className="space-y-3">
                    {accion === 'alta' && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="block text-sm">Tipo<select name="tipo_codigo" className={campo} value={tipo} onChange={e => setTipo(e.target.value)}><option value="IDENTITY">Entidad Claro (IDENTITY)</option><option value="POS_1175">POS (1175)</option></select></label>
                      <label className="block text-sm">Código<input name="codigo" required className={campo + ' uppercase'} pattern={tipo === 'IDENTITY' ? '(AGE|AGET|AGEP)[0-9]+' : '[0-9]+'} inputMode={tipo === 'POS_1175' ? 'numeric' : 'text'} placeholder={tipo === 'IDENTITY' ? 'AGE / AGET / AGEP' : 'Solo números'} onChange={e => { e.target.value = e.target.value.toUpperCase() }} /></label>
                    </div>}
                    <label className="block text-sm">Fecha de {accion === 'alta' ? 'alta' : accion === 'baja' ? 'baja' : 'reactivación'}<input name="fecha" type="date" defaultValue={hoy} max={hoy} required className={campo}/></label>
                    <label className="block text-sm">Motivo<textarea name="motivo" required rows={3} className={campo}/></label>
                  </fieldset>
                  <p className="text-xs text-gray-500">Se conservarán los períodos históricos. La operación está sujeta a las validaciones de Supabase.</p>
                  <div className="flex justify-end gap-2">
                    <button type="button" disabled={guardando} className={boton} onClick={() => elegir(null)}>Cancelar</button>
                    <button type="submit" disabled={guardando} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50">{guardando ? 'Procesando...' : 'Confirmar'}</button>
                  </div>
                </form>
              )}
              {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              {exito && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{exito}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
