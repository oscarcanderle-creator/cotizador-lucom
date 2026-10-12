'use client'

import { useEffect, useMemo, useState } from 'react'
import { CAMPOS_VENTAS } from '../../lib/reportmaker/catalogo'
import { CAMPOS_FILTRABLES } from '../../lib/reportmaker/filtros'

type Negocio = 'INTERNET' | 'PORTABILIDAD' | 'LINEA_NUEVA'
type Union = 'AND' | 'OR'

type RegistroPreview = Record<string, string | number | boolean | null>
type RespuestaPreview = {
  registros?: RegistroPreview[]
  cantidad?: number
  examinadas?: number
  busquedaParcial?: boolean
  error?: string
}

const CAMPOS_DISPONIBLES = new Set(CAMPOS_VENTAS.map(c => c.id))

type Filtro = {
  id: number
  campo: string
  operador: 'igual' | 'distinto' | 'contiene' | 'no_contiene' | 'comienza_con' | 'no_comienza_con' | 'termina_con' | 'vacio' | 'no_vacio' | 'uno_de' | 'no_uno_de'
  valor: string
  union: Union
}

const NEGOCIOS: { id: Negocio; nombre: string; descripcion: string }[] = [
  { id: 'INTERNET', nombre: 'Internet', descripcion: 'BAF y sus variantes' },
  { id: 'PORTABILIDAD', nombre: 'Portabilidad', descripcion: 'Portabilidades y sus variantes' },
  { id: 'LINEA_NUEVA', nombre: 'Línea Nueva', descripcion: 'Altas de líneas nuevas y sus variantes' },
]

const CAMPOS = CAMPOS_VENTAS

const CATEGORIAS = [
  { nombre: 'Operación', ids: ['id_operacion', 'fecha_ingreso', 'tipo', 'negocios', 'vendedor', 'origen_dato'] },
  { nombre: 'Cliente', ids: ['cliente', 'dni', 'telefono'] },
  { nombre: 'Domicilio', ids: ['domicilio', 'localidad', 'barrio', 'entre_calles', 'observaciones'] },
  { nombre: 'Gestión comercial', ids: ['responsable', 'bboo', 'estado_venta', 'estado_vendedor', 'estado_bboo', 'plan', 'sds', 'legajo_enviado'] },
  { nombre: 'Telefonía móvil', ids: ['numero_linea', 'compania_actual', 'tipo_sim', 'plan_acordado', 'plan_cargado', 'pin', 'medio_despacho_chip', 'numero_seguimiento', 'sim', 'fecha_porta', 'fecha_carga_stl'] },
  { nombre: 'Internet BAF', ids: ['estado_baf', 'estado_claro', 'motivo_cierre', 'fecha_cierre', 'fecha_instalacion', 'orden_trabajo'] },
]

const INICIALES = [
  'fecha_ingreso',
  'tipo',
  'vendedor',
  'cliente',
  'estado_venta',
  'plan',
]

export default function EditorReportMaker() {
  const [negocios, setNegocios] = useState<Negocio[]>([
    'INTERNET',
    'PORTABILIDAD',
    'LINEA_NUEVA',
  ])
  const [todosCampos, setTodosCampos] = useState(false)
  const [columnas, setColumnas] = useState<string[]>(INICIALES)
  const [busqueda, setBusqueda] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [filtros, setFiltros] = useState<Filtro[]>([])
  const [registros, setRegistros] = useState<RegistroPreview[]>([])
  const [consultando, setConsultando] = useState(false)
  const [errorConsulta, setErrorConsulta] = useState('')
  const [consultaRealizada, setConsultaRealizada] = useState(false)
  const [busquedaParcial, setBusquedaParcial] = useState(false)
  const [examinadas, setExaminadas] = useState(0)
  const [opciones, setOpciones] = useState<Record<string, string[]>>({})
  const [cargandoOpciones, setCargandoOpciones] = useState(false)
  const [opcionesParciales, setOpcionesParciales] = useState(false)
  const [busquedasMultiples, setBusquedasMultiples] = useState<Record<number, string>>({})

  useEffect(() => {
    if (!desde || !hasta || desde > hasta || !negocios.length) {
      setOpciones({})
      return
    }
    const controlador = new AbortController()
    setCargandoOpciones(true)
    setOpciones({})
    fetch('/api/reportmaker/opciones', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ negocios, desde, hasta }), signal: controlador.signal,
    }).then(async respuesta => {
      const datos = await respuesta.json()
      if (!respuesta.ok) throw new Error(datos.error || 'Error al cargar opciones')
      setOpciones(datos.opciones ?? {})
      setOpcionesParciales(Boolean(datos.busquedaParcial))
    }).catch(error => { if (error.name !== 'AbortError') setOpciones({}) })
      .finally(() => { if (!controlador.signal.aborted) setCargandoOpciones(false) })
    return () => controlador.abort()
  }, [negocios, desde, hasta])

  const columnasEfectivas = useMemo(
    () => todosCampos ? CAMPOS.map(c => c.id) : columnas,
    [todosCampos, columnas]
  )

  const camposSeleccionados = columnasEfectivas
    .map(id => CAMPOS.find(c => c.id === id))
    .filter((campo): campo is (typeof CAMPOS)[number] => Boolean(campo))

  function alternarNegocio(id: Negocio) {
    setNegocios(actual =>
      actual.includes(id)
        ? actual.filter(n => n !== id)
        : [...actual, id]
    )
  }

  function alternarColumna(id: string) {
    setColumnas(actual => {
      if (actual.includes(id)) return actual.filter(c => c !== id)
      
      return [...actual, id]
    })
  }

  function moverColumna(indice: number, direccion: number) {
    setColumnas(actual => {
      const destino = indice + direccion
      if (destino < 0 || destino >= actual.length) return actual
      const copia = [...actual]
      ;[copia[indice], copia[destino]] = [copia[destino], copia[indice]]
      return copia
    })
  }

  function agregarFiltro() {
    setFiltros(actual => actual.length >= 4 ? actual : [
      ...actual,
      {
        id: Math.max(0, ...actual.map(f => f.id)) + 1,
        campo: 'tipo',
        operador: 'igual',
        valor: '',
        union: 'AND',
      },
    ])
  }

  function actualizarFiltro(id: number, cambios: Partial<Filtro>) {
    setFiltros(actual =>
      actual.map(f => f.id === id ? { ...f, ...cambios } : f)
    )
  }

  async function consultarVistaPrevia() {
    if (consultando) return
    setErrorConsulta('')
    setConsultaRealizada(false)
    setRegistros([])
    setConsultando(true)
    try {
      const respuesta = await fetch('/api/reportmaker/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ negocios, desde, hasta, filtros }),
      })
      const datos: RespuestaPreview = await respuesta.json()
      if (!respuesta.ok) {
        throw new Error(datos.error || 'No se pudo consultar la vista previa.')
      }
      setRegistros(Array.isArray(datos.registros) ? datos.registros : [])
      setExaminadas(datos.examinadas ?? 0)
      setBusquedaParcial(Boolean(datos.busquedaParcial))
      setConsultaRealizada(true)
    } catch (error) {
      setErrorConsulta(error instanceof Error ? error.message : 'Error inesperado.')
    } finally {
      setConsultando(false)
    }
  }

  const [exportando, setExportando] = useState<'xlsx' | 'csv' | null>(null)
  const [errorExportacion, setErrorExportacion] = useState('')

  async function exportar(formato: 'xlsx' | 'csv') {
    if (exportando || !puedeExportar) return
    setErrorExportacion('')
    setExportando(formato)
    try {
      const respuesta = await fetch('/api/reportmaker/export', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({negocios,desde,hasta,columnas:columnasEfectivas,filtros,formato}),
      })
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => ({}))
        throw new Error(datos.error || 'No se pudo exportar.')
      }
      const blob = await respuesta.blob()
      const url = URL.createObjectURL(blob)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = `ReportMaker_${desde}_${hasta}.${formato}`
      document.body.appendChild(enlace)
      enlace.click()
      enlace.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      setErrorExportacion(error instanceof Error ? error.message : 'Error inesperado.')
    } finally {
      setExportando(null)
    }
  }

  const puedeConsultar = negocios.length > 0 &&
    columnasEfectivas.length > 0 &&
    Boolean(desde && hasta && desde <= hasta) &&
    filtros.length <= 4 && filtros.every(f =>
      ['vacio', 'no_vacio'].includes(f.operador) || f.valor.trim().length > 0
    )

  const puedeExportar = puedeConsultar &&
    columnasEfectivas.every(c => CAMPOS_DISPONIBLES.has(c)) &&
    !consultando && !exportando

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900">
          1. Seleccionar negocio
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Podés seleccionar uno, dos o todos los negocios.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {NEGOCIOS.map(negocio => (
            <label
              key={negocio.id}
              className="flex cursor-pointer gap-3 rounded-lg border p-4"
            >
              <input
                type="checkbox"
                checked={negocios.includes(negocio.id)}
                onChange={() => alternarNegocio(negocio.id)}
              />
              <span>
                <span className="block font-medium text-gray-900">
                  {negocio.nombre}
                </span>
                <span className="text-sm text-gray-500">
                  {negocio.descripcion}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900">
          2. Seleccionar campos
        </h2>

        <div className="mt-4 space-y-3 text-sm text-gray-800">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={!todosCampos}
              onChange={() => setTodosCampos(false)}
            />
            Seleccionar columnas
          </label>

          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={todosCampos}
              onChange={() => setTodosCampos(true)}
            />
            Todos los Campos
          </label>
        </div>

        {!todosCampos ? (
          <>
            <p className="mt-4 text-sm text-gray-500">
              Columnas seleccionadas: {columnas.length} de {CAMPOS.length}
            </p>

            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar campo..."
              className="mt-3 w-full rounded-lg border p-2 text-gray-900"
            />

            <div className="mt-5 space-y-5">
              {CATEGORIAS.map(categoria => {
                const disponibles = categoria.ids
                  .map(id => CAMPOS.find(c => c.id === id))
                  .filter((c): c is (typeof CAMPOS)[number] => Boolean(c))
                  .filter(c =>
                    c.etiqueta.toLowerCase().includes(busqueda.toLowerCase())
                  )

                if (disponibles.length === 0) return null

                return (
                  <div key={categoria.nombre}>
                    <h3 className="font-semibold text-gray-900">
                      {categoria.nombre}
                    </h3>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {disponibles.map(campo => (
                        <label
                          key={campo.id}
                          className="flex items-center gap-2 text-sm text-gray-800"
                        >
                          <input
                            type="checkbox"
                            checked={columnas.includes(campo.id)}
                            onChange={() => alternarColumna(campo.id)}
                          />
                          {campo.etiqueta}
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <h3 className="mt-6 font-semibold text-gray-900">
              Orden de columnas
            </h3>

            <div className="mt-3 space-y-2">
              {camposSeleccionados.map((campo, indice) => (
                <div
                  key={campo.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <span className="text-sm text-gray-800">
                    {indice + 1}. {campo.etiqueta}
                  </span>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={indice === 0}
                      onClick={() => moverColumna(indice, -1)}
                      className="rounded border px-3 py-1 text-gray-900 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={indice === columnas.length - 1}
                      onClick={() => moverColumna(indice, 1)}
                      className="rounded border px-3 py-1 text-gray-900 disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-4 rounded-lg bg-gray-100 p-3 text-sm text-gray-700">
            Se incluirán todos los campos disponibles del catálogo,
            sin límite de columnas.
          </p>
        )}
      </section>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900">
          3. Período y filtros
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-gray-800">
            Desde
            <input
              type="date"
              value={desde}
              onChange={e => setDesde(e.target.value)}
              className="mt-1 block w-full rounded border p-2 text-gray-900"
            />
          </label>

          <label className="text-sm text-gray-800">
            Hasta
            <input
              type="date"
              value={hasta}
              onChange={e => setHasta(e.target.value)}
              className="mt-1 block w-full rounded border p-2 text-gray-900"
            />
          </label>
        </div>

        {desde && hasta && desde > hasta && (
          <p className="mt-2 text-sm text-red-700">
            El período seleccionado no es válido.
          </p>
        )}

        <button
          type="button"
          onClick={agregarFiltro}
          disabled={filtros.length >= 4}
          className="mt-5 rounded-lg bg-red-700 px-3 py-2 text-sm text-white"
        >
          + Agregar filtro ({filtros.length}/4)
        </button>

        <div className="mt-4 space-y-3">
          {filtros.map((filtro, indice) => (
            <div
              key={filtro.id}
              className="grid gap-2 rounded-lg border p-3 sm:grid-cols-4"
            >
              <select
                value={filtro.campo}
                onChange={e =>
                  actualizarFiltro(filtro.id, { campo: e.target.value })
                }
                className="rounded border p-2 text-sm text-gray-900"
              >
                {CAMPOS.filter(c => CAMPOS_FILTRABLES.some(id => id === c.id)).map(c => (
                  <option key={c.id} value={c.id}>
                    {c.etiqueta}
                  </option>
                ))}
              </select>

              <select
                value={filtro.operador}
                onChange={e =>
                  actualizarFiltro(filtro.id, {
                    operador: e.target.value as Filtro['operador'],
                  })
                }
                className="rounded border p-2 text-sm text-gray-900"
              >
                <option value="igual">Es igual a</option>
                <option value="contiene">Contiene</option>
                <option value="comienza_con">Comienza con</option>
                <option value="distinto">No es igual a</option>
                <option value="no_contiene">No contiene</option>
                <option value="no_comienza_con">No comienza con</option>
                <option value="termina_con">Termina con</option>
                <option value="vacio">Está vacío</option>
                <option value="no_vacio">No está vacío</option>
                <option value="uno_de">Es uno de</option>
                <option value="no_uno_de">No es uno de</option>
              </select>

              {opcionesParciales && <span className="text-xs text-amber-700">Opciones parciales (límite de consulta).</span>}
              {['uno_de', 'no_uno_de'].includes(filtro.operador) ? (
                <div className="rounded-lg border p-2 text-sm text-gray-900">
                  <input
                    value={busquedasMultiples[filtro.id] ?? ''}
                    onChange={evento => setBusquedasMultiples(actual => ({
                      ...actual, [filtro.id]: evento.target.value
                    }))}
                    placeholder="Buscar valores..."
                    className="mb-2 w-full rounded border p-2"
                  />
                  {(() => {
                    const seleccionados = filtro.valor ? filtro.valor.split('\n') : []
                    const buscar = (busquedasMultiples[filtro.id] ?? '')
                      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
                    const visibles = (opciones[filtro.campo] ?? []).filter(valor =>
                      valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                        .toLowerCase().includes(buscar)
                    )
                    const alternar = (valor: string, marcado: boolean) => {
                      const siguientes = marcado
                        ? [...new Set([...seleccionados, valor])]
                        : seleccionados.filter(v => v !== valor)
                      actualizarFiltro(filtro.id, { valor: siguientes.join('\n') })
                    }
                    return (
                      <>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span>{seleccionados.length} seleccionados</span>
                          <button type="button"
                            className="rounded border px-2 py-1"
                            onClick={() => actualizarFiltro(filtro.id, {
                              valor: [...new Set([...seleccionados, ...visibles])].join('\n')
                            })}
                          >
                            Seleccionar visibles
                          </button>
                        </div>
                        <div className="max-h-44 space-y-1 overflow-y-auto">
                          {visibles.map(valor => (
                            <label key={valor} className="flex items-center gap-2">
                              <input type="checkbox"
                                checked={seleccionados.includes(valor)}
                                onChange={evento => alternar(valor, evento.target.checked)}
                              />
                              <span>{valor}</span>
                            </label>
                          ))}
                        </div>
                        {opcionesParciales && (
                          <p className="mt-2 text-xs text-amber-700">
                            Lista parcial: seleccionar visibles no incluye valores no encontrados.
                          </p>
                        )}
                        {visibles.length === 0 && (
                          <p className="text-xs text-gray-500">Sin coincidencias.</p>
                        )}
                      </>
                    )
                  })()}
                </div>
              ) : ['vacio', 'no_vacio'].includes(filtro.operador) ? (
                <span className="rounded border bg-gray-50 p-2 text-sm text-gray-500">
                  No requiere valor
                </span>
              ) : filtro.operador === 'igual' && opciones[filtro.campo]?.length ? (
                <select
                  value={filtro.valor}
                  onChange={e => actualizarFiltro(filtro.id, { valor: e.target.value })}
                  className="rounded border p-2 text-sm text-gray-900"
                >
                  <option value="">Seleccionar valor</option>
                  {filtro.valor && !opciones[filtro.campo].includes(filtro.valor) &&
                    <option value={filtro.valor}>{filtro.valor}</option>}
                  {opciones[filtro.campo].map(valor =>
                    <option key={valor} value={valor}>{valor}</option>)}
                </select>
              ) : (
                <input
                  value={filtro.valor}
                  onChange={e => actualizarFiltro(filtro.id, { valor: e.target.value })}
                  placeholder={
                    filtro.operador === 'comienza_con'
                      ? 'Ejemplo: T1'
                      : filtro.operador === 'contiene'
                        ? 'Escribir texto a buscar'
                        : cargandoOpciones
                          ? 'Cargando opciones...'
                          : 'Valor'
                  }
                  className="rounded border p-2 text-sm text-gray-900"
                />
              )}

              <div className="flex gap-2">
                {indice > 0 && (
                  <select
                    value={filtro.union}
                    onChange={e =>
                      actualizarFiltro(filtro.id, {
                        union: e.target.value as Union,
                      })
                    }
                    className="min-w-0 flex-1 rounded border p-2 text-sm text-gray-900"
                  >
                    <option value="AND">Y</option>
                    <option value="OR">O</option>
                  </select>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setFiltros(actual =>
                      actual.filter(f => f.id !== filtro.id)
                    )
                  }
                  className="rounded border px-2 py-1 text-sm text-red-700"
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900">
          4. Vista previa de operaciones
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Negocios: {negocios.length ? NEGOCIOS.filter(n => negocios.includes(n.id)).map(n => n.nombre).join(', ') : 'Ninguno'}
          {' · '}Columnas: {camposSeleccionados.length}
        </p>
        <p className="mt-2 text-sm text-amber-800">
          Vista previa de hasta 100 coincidencias. XLSX y CSV aplican los mismos filtros y exportan hasta 10.000 registros.
        </p>
        <button
          type="button"
          onClick={consultarVistaPrevia}
          disabled={!puedeConsultar || consultando}
          className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {consultando ? 'Consultando Supabase...' : 'Generar vista previa'}
        </button>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" onClick={() => exportar('xlsx')}
            disabled={!puedeExportar}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
            {exportando === 'xlsx' ? 'Generando XLSX...' : 'Exportar XLSX'}
          </button>
          <button type="button" onClick={() => exportar('csv')}
            disabled={!puedeExportar}
            className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
            {exportando === 'csv' ? 'Generando CSV...' : 'Exportar CSV'}
          </button>
        </div>
        {errorExportacion && <p className="mt-2 text-sm text-red-700" role="alert">{errorExportacion}</p>}
        {columnasEfectivas.some(c => !CAMPOS_DISPONIBLES.has(c)) &&
          <p className="mt-2 text-sm text-amber-800">Para exportar, quitá los campos todavía no disponibles.</p>}

        {!desde || !hasta ? (
          <p className="mt-2 text-sm text-gray-600">Seleccioná las fechas Desde y Hasta para consultar.</p>
        ) : null}
        {errorConsulta && <p className="mt-3 text-sm text-red-700" role="alert">{errorConsulta}</p>}
        {consultaRealizada && (
          <p className="mt-3 text-sm text-gray-700" role="status">
            {registros.length} operaciones en la vista previa (máximo 100).
            {' '}Se examinaron {examinadas} operaciones.
            {busquedaParcial && ' Se alcanzó el límite de exploración; puede haber más resultados.'}
          </p>
        )}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr>
                {camposSeleccionados.map(campo => (
                  <th key={campo.id} className="whitespace-nowrap border bg-gray-100 px-4 py-3 text-gray-900">
                    {campo.etiqueta}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {registros.map((registro, indice) => (
                <tr key={String(registro.id_operacion ?? indice)}>
                  {camposSeleccionados.map(campo => (
                    <td key={campo.id} className="whitespace-nowrap border px-4 py-3 text-gray-800">
                      {CAMPOS_DISPONIBLES.has(campo.id)
                        ? String(registro[campo.id] ?? '')
                        : <span className="italic text-amber-700">Pendiente</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {consultaRealizada && registros.length === 0 && (
          <p className="mt-3 text-sm text-gray-600">No se encontraron operaciones para los criterios seleccionados.</p>
        )}
      </section>
    </div>
  )
}
