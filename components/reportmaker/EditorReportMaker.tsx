'use client'

import { useMemo, useState } from 'react'
import { CAMPOS_VENTAS } from '../../lib/reportmaker/catalogo'

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

const CAMPOS_DISPONIBLES = new Set([
  'id_operacion', 'fecha_ingreso', 'tipo', 'vendedor', 'origen_dato',
  'cliente', 'dni', 'telefono', 'estado_venta', 'estado_bboo',
  'plan', 'sim', 'legajo_enviado', 'fecha_porta', 'fecha_carga_stl',
])

type Filtro = {
  id: number
  campo: string
  operador: 'igual' | 'contiene'
  valor: string
  union: Union
}

const NEGOCIOS: { id: Negocio; nombre: string; descripcion: string }[] = [
  { id: 'INTERNET', nombre: 'Internet', descripcion: 'BAF y sus variantes' },
  { id: 'PORTABILIDAD', nombre: 'Portabilidad', descripcion: 'Portabilidades y sus variantes' },
  { id: 'LINEA_NUEVA', nombre: 'Línea Nueva', descripcion: 'Altas de líneas nuevas y sus variantes' },
]

const CAMPOS_ADICIONALES = [
  { id: 'cliente', etiqueta: 'Cliente', columna: 'cliente', tipo: 'texto' },
  { id: 'dni', etiqueta: 'DNI', columna: 'dni', tipo: 'texto' },
  { id: 'telefono', etiqueta: 'Teléfono', columna: 'telefono', tipo: 'texto' },
  { id: 'estado_venta', etiqueta: 'Estado Venta', columna: 'estado_venta', tipo: 'texto' },
  { id: 'estado_bboo', etiqueta: 'Estado BBOO', columna: 'estado_bboo', tipo: 'texto' },
  { id: 'plan', etiqueta: 'Plan', columna: 'plan', tipo: 'texto' },
  { id: 'sim', etiqueta: 'SIM', columna: 'sim', tipo: 'texto' },
  { id: 'legajo_enviado', etiqueta: 'Legajo Enviado', columna: 'legajo_enviado', tipo: 'texto' },
  { id: 'fecha_porta', etiqueta: 'Fecha Porta', columna: 'fecha_porta', tipo: 'fecha' },
  { id: 'fecha_carga_stl', etiqueta: 'Fecha Cargado STL', columna: 'fecha_carga_stl', tipo: 'fecha' },
] as const

const CAMPOS = [
  ...CAMPOS_VENTAS.filter(c => c.id !== 'observaciones'),
  ...CAMPOS_ADICIONALES,
]

const CATEGORIAS = [
  {
    nombre: 'Operación',
    ids: ['id_operacion', 'fecha_ingreso', 'tipo', 'vendedor', 'origen_dato'],
  },
  {
    nombre: 'Cliente',
    ids: ['cliente', 'dni', 'telefono'],
  },
  {
    nombre: 'Gestión comercial',
    ids: ['estado_venta', 'estado_bboo', 'plan', 'legajo_enviado'],
  },
  {
    nombre: 'Portabilidad y Línea Nueva',
    ids: ['sim', 'fecha_porta', 'fecha_carga_stl'],
  },
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
      if (actual.length >= 10) return actual
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
    setFiltros(actual => [
      ...actual,
      {
        id: Date.now(),
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
        body: JSON.stringify({ negocios, desde, hasta }),
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
    filtros.length === 0

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
            Seleccionar hasta 10 columnas
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
              Columnas seleccionadas: {columnas.length} de 10
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
                            disabled={
                              !columnas.includes(campo.id) &&
                              columnas.length >= 10
                            }
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
            sin el límite de 10 columnas.
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
          className="mt-5 rounded-lg bg-red-700 px-3 py-2 text-sm text-white"
        >
          + Agregar filtro
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
                {CAMPOS.filter(c => c.tipo === 'texto').map(c => (
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
              </select>

              <input
                value={filtro.valor}
                onChange={e =>
                  actualizarFiltro(filtro.id, { valor: e.target.value })
                }
                placeholder="Valor"
                className="rounded border p-2 text-sm text-gray-900"
              />

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
          Vista previa de datos reales. XLSX y CSV exportan todos los registros del período (hasta 10.000), sin filtros personalizados por ahora.
        </p>
        {filtros.length > 0 && (
          <p className="mt-2 text-sm text-red-700" role="alert">
            Los filtros personalizados todavía no están implementados en la API.
            Quitalos para consultar sin filtros; así evitamos mostrar resultados engañosos.
          </p>
        )}
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
        {filtros.length > 0 &&
          <p className="mt-2 text-sm text-amber-800">Los filtros deben estar implementados antes de exportar con condiciones.</p>}

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
