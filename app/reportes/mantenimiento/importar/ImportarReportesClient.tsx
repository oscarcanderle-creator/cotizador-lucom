'use client'

import Link from 'next/link'
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react'

type TipoReporte =
  | 'ITEC'
  | 'ITEC_FIJA'
  | 'FIJA'
  | 'WFM'
  | 'ACTIVACIONES'
  | 'CATER'
  | 'DISTRIBUCION_R3'

type PendienteItecFija = { fila: number; sds: string; ot?: string; motivos: string[] }

type ResultadoValidacion = {
  nuevas?: number
  existentes?: number
  duplicados_archivo?: number
  preventas_omitidas?: number
  cantidad_pendientes?: number
  pendientes?: PendienteItecFija[]
  ok: boolean
  tipo: string
  reporte: string
  archivo: string
  filas_archivo: number
  columnas: number
  registros_encontrados: number
  registros_validos: number
  registros_descartados: number
  cantidad_duplicados_itec?: number
  duplicados_itec?: Array<{
    motivo: string
    campo: string
    valor: string
    cantidad: number
    codigo_psr: string
    telefono: string
    nro_pos: string
    caminante: string
    rubro: string
  }>
  mensaje: string
  series_duplicadas?: string[]
  filas_sin_serie?: number[]
}

type ResultadoImportacion = {
  nuevas?: number
  existentes?: number
  duplicados_archivo?: number
  preventas_omitidas?: number
  cantidad_pendientes?: number
  pendientes?: PendienteItecFija[]
  ok: boolean
  importacion_id: number
  encontrados: number
  validos: number
  descartados: number
  insertados: number
  actualizados: number
  sin_cambios: number
  reporte: string
  archivo: string
  mensaje: string
}

const REPORTES: {
  value: TipoReporte
  label: string
  descripcion: string
}[] = [
  {
    value: 'ITEC',
    label: 'ITEC',
    descripcion: 'Padrón de PSR, teléfonos, POS, tipo de PSR y Caminante.',
  },
  {
    value: 'ITEC_FIJA',
    label: 'ITEC FIJA - Ventas BAF',
    descripcion: 'Importación de ventas BAF desde ITEC FIJA con validación y control de SDS.',
  },
  {
    value: 'FIJA',
    label: 'Reporte Fija',
    descripcion: 'Operaciones BAF 2Play y 3Play informadas por Claro.',
  },
  {
    value: 'WFM',
    label: 'Reporte WFM',
    descripcion: 'Órdenes cerradas y operaciones de Adicional TV.',
  },
  {
    value: 'ACTIVACIONES',
    label: 'Rep. Activaciones',
    descripcion: 'Activaciones de líneas móviles informadas por Claro.',
  },
  {
    value: 'CATER',
    label: 'Venta Equipos / CATER',
    descripcion: 'Cambios de terminal realizados en locales.',
  },
  {
    value: 'DISTRIBUCION_R3',
    label: 'Distribución R3',
    descripcion: 'Primera carga de SIM en locales Claro exclusivos.',
  },
]

function formatearTamano(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type ContadoresBAF = {
  actualizados: number
  sin_cambios: number
  protegidos: number
  sin_coincidencia: number
  no_cargados: number
}

const CONTADORES_CERO: ContadoresBAF = {
  actualizados: 0,
  sin_cambios: 0,
  protegidos: 0,
  sin_coincidencia: 0,
  no_cargados: 0,
}

export default function ImportarReportesClient() {
  const inputRef = useRef<HTMLInputElement>(null)

  const [tipoReporte, setTipoReporte] = useState<TipoReporte | ''>('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState<ResultadoValidacion | null>(null)
  const [resultadoImportacion, setResultadoImportacion] =
    useState<ResultadoImportacion | null>(null)

  const [consultandoActualizacion, setConsultandoActualizacion] = useState(true)
  const [registrosFija, setRegistrosFija] = useState(0)
  const [actualizandoDatos, setActualizandoDatos] = useState(false)
  const [procesadosActualizacion, setProcesadosActualizacion] = useState(0)
  const [resultadoActualizacion, setResultadoActualizacion] = useState<ContadoresBAF | null>(null)
  const [errorActualizacion, setErrorActualizacion] = useState('')
  const [actualizacionCompletada, setActualizacionCompletada] = useState(false)

  useEffect(() => {
    let vigente = true
    async function consultarDisponibilidad() {
      try {
        const respuesta = await fetch('/api/reportes/actualizar-datos', { cache: 'no-store' })
        const datos = await respuesta.json().catch(() => null)
        if (!respuesta.ok || !datos?.ok) {
          throw new Error(datos?.error || 'No se pudo consultar Reporte Fija.')
        }
        if (vigente) setRegistrosFija(Number(datos.registros_fija ?? 0))
      } catch (err) {
        if (vigente) setErrorActualizacion(err instanceof Error ? err.message : 'Error al consultar reportes.')
      } finally {
        if (vigente) setConsultandoActualizacion(false)
      }
    }
    void consultarDisponibilidad()
    return () => { vigente = false }
  }, [])

  async function actualizarDatos() {
    if (actualizandoDatos || procesando || consultandoActualizacion || registrosFija === 0) return
    setActualizandoDatos(true)
    setActualizacionCompletada(false)
    setErrorActualizacion('')
    setProcesadosActualizacion(0)
    setResultadoActualizacion({ ...CONTADORES_CERO })

    let desdeId = 0
    let procesados = 0
    const acumulado = { ...CONTADORES_CERO }
    try {
      for (;;) {
        const respuesta = await fetch('/api/reportes/actualizar-datos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ desde_id: desdeId }),
        })
        const datos = await respuesta.json().catch(() => null)
        if (!respuesta.ok || !datos?.ok) {
          throw new Error(datos?.error || datos?.mensaje || 'Error al sincronizar ventas BAF.')
        }
        const cantidad = Number(datos.registros_procesados)
        const ultimoId = Number(datos.ultimo_id)
        if (!Number.isSafeInteger(cantidad) || cantidad < 0 || cantidad > 100 ||
            !Number.isSafeInteger(ultimoId) || ultimoId < desdeId ||
            (cantidad > 0 && ultimoId <= desdeId)) {
          throw new Error('La API devolvió un lote inválido.')
        }
        const contadores = datos.sincronizacion_baf ?? {}
        for (const campo of Object.keys(acumulado) as Array<keyof ContadoresBAF>) {
          const valor = Number(contadores[campo] ?? 0)
          if (!Number.isSafeInteger(valor) || valor < 0) {
            throw new Error('La API devolvió contadores inválidos.')
          }
          acumulado[campo] += valor
        }
        procesados += cantidad
        desdeId = ultimoId
        setProcesadosActualizacion(procesados)
        setResultadoActualizacion({ ...acumulado })
        if (datos.finalizado) {
          setActualizacionCompletada(true)
          break
        }
        if (cantidad === 0) throw new Error('La sincronización no pudo avanzar al siguiente lote.')
      }
    } catch (err) {
      setErrorActualizacion(err instanceof Error ? err.message : 'No se pudo completar la actualización.')
    } finally {
      setActualizandoDatos(false)
    }
  }

  const reporteSeleccionado =
    REPORTES.find((reporte) => reporte.value === tipoReporte) ?? null

  function limpiarResultado() {
    setError('')
    setResultado(null)
    setResultadoImportacion(null)
  }

  function seleccionarArchivo(nuevoArchivo?: File) {
    if (!nuevoArchivo) return

    limpiarResultado()
    setArchivo(nuevoArchivo)
  }

  function cambiarArchivo(event: ChangeEvent<HTMLInputElement>) {
    seleccionarArchivo(event.target.files?.[0])
  }

  function soltarArchivo(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setArrastrando(false)
    seleccionarArchivo(event.dataTransfer.files?.[0])
  }

  function quitarArchivo() {
    setArchivo(null)
    limpiarResultado()

    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  function cambiarTipoReporte(valor: TipoReporte | '') {
    setTipoReporte(valor)
    limpiarResultado()
  }

  async function procesarArchivo() {
    if (!tipoReporte || !archivo || procesando) return

    setProcesando(true)
    setError('')
    setResultado(null)

    try {
      const formData = new FormData()
      formData.append('tipo', tipoReporte)
      formData.append('archivo', archivo)

      const response = await fetch(tipoReporte === 'DISTRIBUCION_R3'
        ? '/api/reportes/importar/distribucion-r3/validar'
        : tipoReporte === 'ITEC_FIJA'
          ? '/api/reportes/importar/itec-fija/validar'
          : '/api/reportes/importar/validar', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          data?.error || 'No se pudo validar el archivo seleccionado.',
        )
      }

      setResultado(data as ResultadoValidacion)
    } catch (err: any) {
      setError(
        err?.message || 'No se pudo validar el archivo seleccionado.',
      )
    } finally {
      setProcesando(false)
    }
  }

  async function confirmarImportacion() {
    if (!tipoReporte || !archivo || !resultado || procesando) return

    setProcesando(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('tipo', tipoReporte)
      formData.append('archivo', archivo)

      const response = await fetch(tipoReporte === 'DISTRIBUCION_R3'
        ? '/api/reportes/importar/distribucion-r3/confirmar'
        : tipoReporte === 'ITEC_FIJA'
          ? '/api/reportes/importar/itec-fija/confirmar'
          : '/api/reportes/importar/confirmar', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          data?.error || 'No se pudo importar el archivo seleccionado.',
        )
      }

      setResultadoImportacion(data as ResultadoImportacion)
    } catch (err: any) {
      setError(
        err?.message || 'No se pudo importar el archivo seleccionado.',
      )
    } finally {
      setProcesando(false)
    }
  }

  function descargarPendientesItecFija(etapa: 'validacion' | 'importacion' = 'validacion') {
    const pendientes = etapa === 'importacion'
      ? (resultadoImportacion?.pendientes ?? [])
      : (resultado?.pendientes ?? [])
    if (!pendientes.length) return
    const escapar = (valor: unknown) => `"${String(valor ?? '').replace(/"/g, '""')}"`
    const filas = [
      ['Fila CSV', 'SDS', 'OT', 'Motivos'],
      ...pendientes.map(p => [String(p.fila), p.sds, p.ot ?? '', p.motivos.join(' | ')])
    ]
    const csv = '\uFEFF' + filas.map(f => f.map(escapar).join(';')).join('\r\n')
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'})
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `ITEC_FIJA_pendientes_${etapa}_${new Date().toISOString().slice(0,10)}.csv`
    document.body.appendChild(enlace)
    enlace.click()
    enlace.remove()
    URL.revokeObjectURL(url)
  }

  function descargarDuplicadosItec() {
    const duplicados = resultado?.duplicados_itec ?? []

    if (duplicados.length === 0) return

    const escaparCsv = (valor: unknown) => {
      const texto = String(valor ?? '').replace(/"/g, '""')
      return `"${texto}"`
    }

    const encabezados = [
      'Motivo',
      'Campo duplicado',
      'Valor duplicado',
      'Cantidad',
      'Codigo PSR',
      'Numero de telefono',
      'Nro. POS',
      'Caminante',
      'Rubro',
    ]

    const filas = duplicados.map((registro) => [
      registro.motivo,
      registro.campo,
      registro.valor,
      registro.cantidad,
      registro.codigo_psr,
      registro.telefono,
      registro.nro_pos,
      registro.caminante,
      registro.rubro,
    ])

    const csv = [
      encabezados.map(escaparCsv).join(';'),
      ...filas.map((fila) => fila.map(escaparCsv).join(';')),
    ].join('\r\n')

    const blob = new Blob(
      ['\uFEFF' + csv],
      { type: 'text/csv;charset=utf-8;' },
    )

    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')

    enlace.href = url
    enlace.download = `ITEC_duplicados_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`

    document.body.appendChild(enlace)
    enlace.click()
    enlace.remove()

    URL.revokeObjectURL(url)
  }

  const puedeProcesar = Boolean(tipoReporte && archivo && !procesando)
  const puedeConfirmar = Boolean(
    resultado && !resultadoImportacion && !procesando &&
    (tipoReporte !== 'DISTRIBUCION_R3' ||
      (resultado.ok &&
        !(resultado.series_duplicadas?.length) &&
        !(resultado.filas_sin_serie?.length))),
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:p-8">
      <div className="mb-6">
        <Link
          href="/reportes/mantenimiento"
          className="text-sm font-semibold text-red-600 hover:text-red-700"
        >
          ← Volver a Mantenimiento
        </Link>

        <h1 className="mt-3 text-2xl font-bold text-gray-900">
          Importar reportes
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Seleccioná el tipo de reporte y luego cargá el archivo correspondiente.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <label
            htmlFor="tipo-reporte"
            className="block text-sm font-semibold text-gray-800"
          >
            Tipo de reporte
          </label>

          <select
            id="tipo-reporte"
            value={tipoReporte}
            onChange={(event) =>
              cambiarTipoReporte(event.target.value as TipoReporte | '')
            }
            disabled={procesando}
            className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:bg-gray-100"
          >
            <option value="">Seleccionar reporte...</option>

            {REPORTES.map((reporte) => (
              <option key={reporte.value} value={reporte.value}>
                {reporte.label}
              </option>
            ))}
          </select>

          {reporteSeleccionado && (
            <p className="mt-2 text-sm text-gray-500">
              {reporteSeleccionado.descripcion}
            </p>
          )}
        </div>

        <div className="mt-6">
          <div className="mb-2 text-sm font-semibold text-gray-800">
            Archivo
          </div>

          {!archivo ? (
            <div
              onDragEnter={(event) => {
                event.preventDefault()
                setArrastrando(true)
              }}
              onDragOver={(event) => {
                event.preventDefault()
                setArrastrando(true)
              }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={soltarArchivo}
              className={
                arrastrando
                  ? 'rounded-xl border-2 border-dashed border-red-500 bg-red-50 px-5 py-10 text-center transition'
                  : 'rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-5 py-10 text-center transition hover:border-gray-400'
              }
            >
              <svg
                className="mx-auto h-10 w-10 text-gray-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path d="M12 16V4" />
                <path d="m7 9 5-5 5 5" />
                <path d="M5 14v5h14v-5" />
              </svg>

              <div className="mt-3 text-sm font-semibold text-gray-800">
                Arrastrá el archivo hasta aquí
              </div>

              <div className="mt-1 text-sm text-gray-500">
                o seleccioná un archivo desde tu equipo
              </div>

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
              >
                Seleccionar archivo
              </button>

              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={cambiarArchivo}
                className="hidden"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-gray-900">
                  {archivo.name}
                </div>

                <div className="mt-1 text-xs text-gray-500">
                  {formatearTamano(archivo.size)}
                </div>
              </div>

              <button
                type="button"
                onClick={quitarArchivo}
                disabled={procesando}
                className="shrink-0 text-sm font-semibold text-red-600 hover:text-red-700 disabled:text-gray-400"
              >
                Quitar archivo
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="text-sm font-semibold text-red-800">
              No se pudo procesar el archivo
            </div>
            <div className="mt-1 text-sm text-red-700">{error}</div>
          </div>
        )}

        {resultado && (
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 sm:p-5">
            <div className="text-sm font-bold text-green-900">
              Archivo validado correctamente
            </div>

            <div className="mt-1 text-sm text-green-800">
              {resultado.reporte} · {resultado.archivo}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-white p-3">
                <div className="text-xs font-semibold uppercase text-gray-500">
                  Encontrados
                </div>
                <div className="mt-1 text-xl font-bold text-gray-900">
                  {resultado.registros_encontrados}
                </div>
              </div>

              <div className="rounded-lg bg-white p-3">
                <div className="text-xs font-semibold uppercase text-gray-500">
                  Válidos
                </div>
                <div className="mt-1 text-xl font-bold text-gray-900">
                  {resultado.registros_validos}
                </div>
              </div>

              <div className="rounded-lg bg-white p-3">
                <div className="text-xs font-semibold uppercase text-gray-500">
                  Descartados
                </div>
                <div className="mt-1 text-xl font-bold text-gray-900">
                  {tipoReporte === 'ITEC_FIJA'
                    ? ((resultado.duplicados_archivo ?? 0) + (resultado.cantidad_pendientes ?? 0))
                    : resultado.registros_descartados}
                </div>
              </div>
            </div>

            {resultado.tipo === 'ITEC_FIJA' && (
              <div className="mt-5 rounded-lg border border-gray-200 bg-white p-4">
                <h3 className="text-base font-bold text-gray-900">Detalle de validación ITEC FIJA</h3>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ['Nuevas', resultado.nuevas ?? 0],
                    ['Existentes', resultado.existentes ?? 0],
                    ['Duplicadas en CSV', resultado.duplicados_archivo ?? 0],
                     ['Preventas omitidas', resultado.preventas_omitidas ?? 0],
                    ['Pendientes', resultado.cantidad_pendientes ?? 0],
                  ].map(([titulo, valor]) => (
                    <div key={titulo} className="rounded-lg border border-gray-200 p-3">
                      <div className="text-xs font-semibold text-gray-500">{titulo}</div>
                      <div className="mt-1 text-xl font-bold text-gray-900">{valor}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-sm text-gray-600">
                  Las ventas existentes se omiten para evitar duplicados por SDS.
                  Las pendientes requieren revisión antes de importarse.
                </p>
                {(resultado.pendientes?.length ?? 0) > 0 && (
                  <>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-semibold text-gray-900">Registros pendientes y motivos</h4>
                       <button type="button" onClick={() => descargarPendientesItecFija('validacion')}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                        Descargar pendientes CSV
                      </button>
                    </div>
                    <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                        <thead className="bg-gray-50 text-gray-700">
                          <tr><th className="px-3 py-2">Fila CSV</th><th className="px-3 py-2">SDS</th><th className="px-3 py-2">Motivo</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {(resultado.pendientes ?? []).map((pendiente, indice) => (
                            <tr key={`${pendiente.fila}-${indice}`}>
                              <td className="px-3 py-2">{pendiente.fila}</td>
                              <td className="px-3 py-2 font-mono">{pendiente.sds || '—'}</td>
                              <td className="px-3 py-2">{pendiente.motivos.join(' · ')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                <p className="mt-4 text-sm font-semibold text-amber-800">
                  Confirmá únicamente después de verificar el detalle de validación.
                </p>
              </div>
            )}

            {resultado.tipo === 'ITEC' &&
            (resultado.duplicados_itec?.length ?? 0) > 0 && (
              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
                <div className="text-sm font-bold text-amber-900">
                  Se detectaron registros ITEC con valores duplicados
                </div>

                <div className="mt-1 text-sm text-amber-800">
                  Las filas involucradas en Nro. POS duplicados serán
                  ignoradas durante la importación. Podés descargar el detalle
                  para su revisión y corrección.
                </div>

                <button
                  type="button"
                  onClick={descargarDuplicadosItec}
                  className="mt-3 rounded-lg border border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
                >
                  Descargar duplicados ITEC
                </button>
              </div>
            )}

            <div className="mt-4 text-sm font-semibold text-green-900">
              {resultado.mensaje}
            </div>
          </div>
        )}

        {resultadoImportacion && (
          <div className="mt-6 rounded-xl border border-green-300 bg-green-50 p-4 sm:p-5">
            <div className="text-sm font-bold text-green-900">
              Importación completada
            </div>

            <div className="mt-1 text-sm text-green-800">
              {resultadoImportacion.reporte} · {resultadoImportacion.archivo}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-white p-3">
                <div className="text-xs font-semibold uppercase text-gray-500">
                  Insertados
                </div>
                <div className="mt-1 text-xl font-bold text-gray-900">
                  {resultadoImportacion.insertados}
                </div>
              </div>

              <div className="rounded-lg bg-white p-3">
                <div className="text-xs font-semibold uppercase text-gray-500">
                  Actualizados
                </div>
                <div className="mt-1 text-xl font-bold text-gray-900">
                  {resultadoImportacion.actualizados}
                </div>
              </div>

              <div className="rounded-lg bg-white p-3">
                <div className="text-xs font-semibold uppercase text-gray-500">
                  Sin cambios
                </div>
                <div className="mt-1 text-xl font-bold text-gray-900">
                  {resultadoImportacion.sin_cambios}
                </div>
              </div>

              <div className="rounded-lg bg-white p-3">
                <div className="text-xs font-semibold uppercase text-gray-500">
                  {tipoReporte === 'ITEC_FIJA' ? 'No importadas' : 'Descartados'}
                </div>
                <div className="mt-1 text-xl font-bold text-gray-900">
                  {tipoReporte === 'ITEC_FIJA'
                    ? (resultadoImportacion.cantidad_pendientes ?? resultadoImportacion.pendientes?.length ?? 0)
                    : resultadoImportacion.descartados}
                </div>
              </div>
            </div>

            {(tipoReporte === 'ITEC_FIJA' || resultadoImportacion.reporte?.toUpperCase().includes('ITEC FIJA')) && (
              <div className="mt-5 rounded-lg border border-amber-200 bg-white p-4">
                <h3 className="text-base font-bold text-gray-900">Resultado final ITEC FIJA</h3>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {([
                    ['Creadas', resultadoImportacion.nuevas ?? resultadoImportacion.insertados],
                    ['Existentes', resultadoImportacion.existentes ?? resultadoImportacion.sin_cambios],
                    ['Duplicadas en CSV', resultadoImportacion.duplicados_archivo ?? 0],
                     ['Preventas omitidas', resultadoImportacion.preventas_omitidas ?? 0],
                    ['No importadas', resultadoImportacion.cantidad_pendientes ?? resultadoImportacion.pendientes?.length ?? 0],
                  ] as const).map(([titulo, valor]) => (
                    <div key={titulo} className="rounded-lg border border-gray-200 p-3">
                      <div className="text-xs font-semibold text-gray-500">{titulo}</div>
                      <div className="mt-1 text-xl font-bold text-gray-900">{valor}</div>
                    </div>
                  ))}
                </div>
                {(resultadoImportacion.pendientes?.length ?? 0) > 0 ? (
                  <div className="mt-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h4 className="text-sm font-bold text-amber-900">
                        Ventas no importadas ({resultadoImportacion.pendientes?.length})
                      </h4>
                      <button type="button" onClick={() => descargarPendientesItecFija('importacion')}
                        className="rounded-lg border border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-50">
                        Descargar no importadas CSV
                      </button>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                      Estos son los errores reales de la importación. Las ventas existentes no se consideran errores.
                    </p>
                    <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                        <thead className="bg-gray-50 text-gray-700">
                          <tr><th className="px-3 py-2">Fila CSV</th><th className="px-3 py-2">SDS</th><th className="px-3 py-2">OT</th><th className="px-3 py-2">Motivo</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {resultadoImportacion.pendientes?.map((pendiente, indice) => (
                            <tr key={`${pendiente.fila}-${indice}`}>
                              <td className="px-3 py-2">{pendiente.fila}</td>
                              <td className="px-3 py-2 font-mono">{pendiente.sds || '—'}</td>
                              <td className="px-3 py-2 font-mono">{pendiente.ot || '—'}</td>
                              <td className="px-3 py-2">{pendiente.motivos.join(' · ')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (resultadoImportacion.cantidad_pendientes ?? 0) > 0 ? (
                  <p className="mt-4 text-sm font-semibold text-amber-800">
                    Hay ventas no importadas, pero el servidor no devolvió el detalle de las filas. Revisá la respuesta del endpoint de confirmación.
                  </p>
                ) : (
                  <p className="mt-4 text-sm font-semibold text-green-800">
                    No hubo ventas pendientes de importación.
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 text-sm font-semibold text-green-900">
              {resultadoImportacion.mensaje}
            </div>
          </div>
        )}

        <section className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:p-5">
          <h2 className="text-base font-bold text-gray-900">Actualización de datos</h2>
          <p className="mt-1 text-sm text-gray-600">
            Sincroniza Reporte Fija con ventas BAF usando los datos ya importados.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-gray-700">
              {consultandoActualizacion
                ? 'Consultando registros disponibles...'
                : `${registrosFija.toLocaleString('es-AR')} registros de Reporte Fija disponibles`}
            </span>
            <button
              type="button"
              onClick={actualizarDatos}
              disabled={consultandoActualizacion || actualizandoDatos || procesando || registrosFija === 0 || Boolean(errorActualizacion && procesadosActualizacion === 0)}
              className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
            >
              {actualizandoDatos ? 'Actualizando datos...' : 'Actualizar datos'}
            </button>
          </div>
          {(actualizandoDatos || procesadosActualizacion > 0) && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold text-gray-800">
                {procesadosActualizacion.toLocaleString('es-AR')} de {registrosFija.toLocaleString('es-AR')} registros procesados
              </p>
              <div className="h-3 overflow-hidden rounded-full bg-blue-100">
                <div className="h-full bg-blue-600 transition-all"
                  style={{ width: `${registrosFija > 0 ? Math.min(100, procesadosActualizacion / registrosFija * 100) : 0}%` }} />
              </div>
            </div>
          )}
          {resultadoActualizacion && (
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
              {([
                ['Actualizados', resultadoActualizacion.actualizados],
                ['Sin cambios', resultadoActualizacion.sin_cambios],
                ['Protegidos', resultadoActualizacion.protegidos],
                ['Sin coincidencia', resultadoActualizacion.sin_coincidencia],
                ['No cargados', resultadoActualizacion.no_cargados],
              ] as const).map(([titulo, valor]) => (
                <div key={titulo} className="rounded-lg bg-white p-3">
                  <div className="text-xs font-semibold text-gray-500">{titulo}</div>
                  <div className="mt-1 text-xl font-bold text-gray-900">{valor}</div>
                </div>
              ))}
            </div>
          )}
          {actualizacionCompletada && (
            <p className="mt-4 text-sm font-bold text-green-800">Actualización de Reporte Fija → BAF completada correctamente.</p>
          )}
          {errorActualizacion && (
            <p role="alert" className="mt-4 text-sm font-semibold text-red-700">{errorActualizacion}</p>
          )}
        </section>

        <div className="mt-6 flex justify-end border-t border-gray-100 pt-5">
          {!resultado ? (
            <button
              type="button"
              onClick={procesarArchivo}
              disabled={!puedeProcesar}
              className={
                puedeProcesar
                  ? 'rounded-lg bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700'
                  : 'cursor-not-allowed rounded-lg bg-gray-200 px-5 py-2.5 text-sm font-bold text-gray-400'
              }
            >
              {procesando ? 'Procesando...' : 'Procesar archivo'}
            </button>
          ) : !resultadoImportacion ? (
            <button
              type="button"
              onClick={confirmarImportacion}
              disabled={!puedeConfirmar}
              className={
                puedeConfirmar
                  ? 'rounded-lg bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700'
                  : 'cursor-not-allowed rounded-lg bg-gray-200 px-5 py-2.5 text-sm font-bold text-gray-400'
              }
            >
              {procesando ? 'Importando...' : 'Confirmar importación'}
            </button>
          ) : (
            <button
              type="button"
              onClick={quitarArchivo}
              disabled={procesando}
              className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-100"
            >
              Importar otro archivo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
