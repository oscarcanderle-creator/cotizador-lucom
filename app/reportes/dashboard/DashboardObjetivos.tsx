'use client'

import { useEffect, useState } from 'react'

const NEGOCIOS = [
  {
    nombre: 'BAF',
    color: '#07559b',
    indicadores: [
      ['BAF_INGRESADAS', 'Ingresadas'],
      ['BAF_CARGADAS', 'Cargadas'],
      ['BAF_FINALIZADAS', 'Finalizadas'],
      ['BAF_CANCELADAS', 'Canceladas (máximo)'],
    ],
  },
  {
    nombre: 'PORTA',
    color: '#d51529',
    indicadores: [
      ['PORTA_INGRESADAS', 'Ingresadas'],
      ['PORTA_ACTIVAS', 'Activas'],
    ],
  },
  {
    nombre: 'LÍNEA NUEVA',
    color: '#7540d8',
    indicadores: [
      ['LN_INGRESADAS', 'Ingresadas'],
      ['LN_ACTIVAS', 'Activas'],
    ],
  },
  {
    nombre: 'FWA',
    color: '#d97706',
    indicadores: [
      ['FWA_INGRESADAS', 'Ingresadas'],
      ['FWA_ACTIVAS', 'Activas'],
    ],
  },
]

type Valores = Record<string, string>

export default function DashboardObjetivos({
  oscuro,
  onCerrar,
  onGuardado,
}: {
  oscuro: boolean
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [mes, setMes] = useState(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
    }).format(new Date()).slice(0, 7)
  )

  const [valores, setValores] = useState<Valores>({})
  const [originales, setOriginales] = useState<Valores>({})
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  const formato = new Intl.NumberFormat('es-AR')

  const fondo = oscuro
    ? 'bg-slate-900 text-slate-100'
    : 'bg-white text-slate-900'

  const borde = oscuro
    ? 'border-slate-700'
    : 'border-slate-200'

  const campo = oscuro
    ? 'bg-slate-800 border-slate-600 text-white'
    : 'bg-white border-slate-300 text-slate-900'

  const secundario = oscuro
    ? 'text-slate-400'
    : 'text-slate-500'

  useEffect(() => {
    const controller = new AbortController()

    setCargando(true)
    setError('')
    setMensaje('')
    setValores({})
    setOriginales({})

    fetch(
      '/api/dashboard/objetivos?mes=' +
        encodeURIComponent(mes),
      {
        signal: controller.signal,
        cache: 'no-store',
      }
    )
      .then(async respuesta => {
        const datos = await respuesta.json()

        if (!respuesta.ok) {
          throw new Error(datos.error || 'Error de consulta.')
        }

        const nuevos: Valores = {}

        for (const negocio of NEGOCIOS) {
          for (const [codigo] of negocio.indicadores) {
            const valor = datos.objetivos[codigo]
            nuevos[codigo] =
              valor == null ? '' : String(valor)
          }
        }

        if (!controller.signal.aborted) {
          setValores(nuevos)
          setOriginales(nuevos)
        }
      })
      .catch(e => {
        if (!controller.signal.aborted) {
          setError(e.message)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCargando(false)
        }
      })

    return () => controller.abort()
  }, [mes])

  const modificado = Object.keys(valores).some(
    codigo => valores[codigo] !== originales[codigo]
  )

  function totalMovil(a: string, b: string) {
    if (!valores[a] || !valores[b]) return '—'

    return formato.format(
      Number(valores[a]) + Number(valores[b])
    )
  }

  async function guardar() {
    setError('')
    setMensaje('')

    const objetivos: Record<string, number> = {}

    for (const negocio of NEGOCIOS) {
      for (const [codigo, nombre] of negocio.indicadores) {
        const valor = valores[codigo] ?? ''

        if (valor === '') {
          if (originales[codigo]) {
            setError(
              'No se puede eliminar un objetivo existente: ' +
              negocio.nombre + ' ' + nombre
            )
            return
          }

          continue
        }

        const numero = Number(valor)

        if (
          !Number.isSafeInteger(numero) ||
          numero < 0 ||
          numero > 2147483647
        ) {
          setError(
            'Objetivo inválido: ' +
            negocio.nombre + ' ' + nombre
          )
          return
        }

        if (valor !== originales[codigo]) {
          objetivos[codigo] = numero
        }
      }
    }

    setGuardando(true)

    try {
      const respuesta = await fetch(
        '/api/dashboard/objetivos',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mes, objetivos }),
        }
      )

      const datos = await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(
          datos.error || 'Error al guardar.'
        )
      }

      const nuevos: Valores = {}

      for (const negocio of NEGOCIOS) {
        for (const [codigo] of negocio.indicadores) {
          const valor = datos.objetivos[codigo]
          nuevos[codigo] =
            valor == null ? '' : String(valor)
        }
      }

      setValores(nuevos)
      setOriginales(nuevos)
      setMensaje('Objetivos guardados correctamente.')
      onGuardado()

    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudieron guardar los objetivos.'
      )
    } finally {
      setGuardando(false)
    }
  }

  function cerrar() {
    if (guardando) return

    if (
      modificado &&
      !window.confirm('Hay cambios sin guardar. ¿Cerrar?')
    ) {
      return
    }

    onCerrar()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-objetivos"
        className={'w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl ' + fondo}
      >
        <header className={'flex items-center justify-between border-b p-5 ' + borde}>
          <div>
            <h2
              id="titulo-objetivos"
              className="text-xl font-bold"
            >
              Objetivos mensuales
            </h2>
            <p className={'text-sm ' + secundario}>
              Configuración de objetivos comerciales
            </p>
          </div>

          <button
            type="button"
            onClick={cerrar}
            disabled={guardando}
            aria-label="Cerrar"
            className="rounded-lg px-3 py-1 text-2xl"
          >
            ×
          </button>
        </header>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm font-semibold">
              Mes
              <input
                type="month"
                value={mes}
                disabled={guardando}
                onChange={e => {
                  if (!e.target.value) return

                  if (
                    modificado &&
                    !window.confirm(
                      'Hay cambios sin guardar. ¿Cambiar de mes?'
                    )
                  ) return

                  setMes(e.target.value)
                }}
                className={'mt-1 block w-full rounded-lg border p-2 ' + campo}
              />
            </label>

            <label className="text-sm font-semibold">
              Canal
              <div className={'mt-1 rounded-lg border p-2 ' + campo}>
                Call Lucom
              </div>
            </label>
          </div>

          {cargando ? (
            <div className="py-12 text-center">
              Consultando objetivos...
            </div>
          ) : (
            <div className={'overflow-hidden rounded-xl border ' + borde}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={'border-b ' + borde}>
                    <th className="p-3 text-left">Negocio</th>
                    <th className="p-3 text-left">Indicador</th>
                    <th className="w-36 p-3 text-right">Objetivo</th>
                  </tr>
                </thead>

                <tbody>
                  {NEGOCIOS.map(negocio =>
                    negocio.indicadores.map(
                      ([codigo, nombre], indice) => (
                        <tr
                          key={codigo}
                          className={'border-b ' + borde}
                        >
                          <td
                            className="p-2 pl-3 font-bold"
                            style={{ color: negocio.color }}
                          >
                            {indice === 0 ? negocio.nombre : ''}
                          </td>

                          <td className="p-2">{nombre}</td>

                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              max="2147483647"
                              step="1"
                              aria-label={negocio.nombre + ' ' + nombre}
                              placeholder="Sin objetivo"
                              disabled={guardando}
                              value={valores[codigo] ?? ''}
                              onChange={e => {
                                setMensaje('')
                                setValores(prev => ({
                                  ...prev,
                                  [codigo]: e.target.value,
                                }))
                              }}
                              className={'w-full rounded-md border p-2 text-right ' + campo}
                            />
                          </td>
                        </tr>
                      )
                    )
                  )}

                  <tr className={'border-b font-semibold ' + borde}>
                    <td className="p-3">TOTAL MÓVIL</td>
                    <td>Ingresadas</td>
                    <td className="p-3 text-right">
                      {totalMovil(
                        'PORTA_INGRESADAS',
                        'LN_INGRESADAS'
                      )}
                    </td>
                  </tr>

                  <tr className="font-semibold">
                    <td />
                    <td>Activas</td>
                    <td className="p-3 text-right">
                      {totalMovil(
                        'PORTA_ACTIVAS',
                        'LN_ACTIVAS'
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <p className={'text-xs ' + secundario}>
            Total Móvil se calcula automáticamente
            sumando PORTA y Línea Nueva, sin incluir FWA.
            Un campo vacío representa un objetivo no establecido.
          </p>

          {error && (
            <div
              role="alert"
              className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500"
            >
              {error}
            </div>
          )}

          {mensaje && (
            <div
              role="status"
              className="rounded-lg bg-green-500/10 p-3 text-sm text-green-500"
            >
              {mensaje}
            </div>
          )}
        </div>

        <footer className={'flex flex-wrap justify-end gap-3 border-t p-5 ' + borde}>
          <button
            type="button"
            disabled={guardando || cargando || !modificado}
            onClick={() => {
              setValores({ ...originales })
              setError('')
              setMensaje('')
            }}
            className={'rounded-lg border px-4 py-2 text-sm disabled:opacity-40 ' + borde}
          >
            Restablecer
          </button>

          <button
            type="button"
            onClick={cerrar}
            disabled={guardando}
            className={'rounded-lg border px-4 py-2 text-sm ' + borde}
          >
            Cerrar
          </button>

          <button
            type="button"
            onClick={guardar}
            disabled={cargando || guardando || !modificado}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-40"
          >
            {guardando ? 'Guardando...' : 'Guardar objetivos'}
          </button>
        </footer>
      </section>
    </div>
  )
}
