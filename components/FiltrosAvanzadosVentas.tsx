'use client'

import { useState } from 'react'

type Filtro = {
  campo: string
  condicion: string
  valor: string
  valor2: string
  conector: 'AND' | 'OR'
}

type Props = {
  estados: string[]
  vendedores: string[]
  responsables: string[]
  mediosDespacho: string[]
  companias: string[]
  iniciales?: Filtro[]
}

const CAMPOS = [
  ['estado', 'Estado'],
  ['tipo', 'Tipo'],
  ['vendedor', 'Vendedor'],
  ['responsable', 'Responsable'],
  ['medio_despacho', 'Medio de despacho'],
  ['tipo_sim', 'Tipo SIM'],
  ['compania_actual', 'Compañía actual'],
  ['fecha_carga_stl', 'Fecha Carga STL'],
  ['fecha_porta', 'Fecha Porta'],
  ['pin', 'PIN'],
  ['sim_operativo', 'SIM operativo'],
  ['numero_seguimiento', 'Número de seguimiento'],
] as const

const vacio: Filtro = {
  campo: '',
  condicion: '',
  valor: '',
  valor2: '',
  conector: 'AND',
}

function condiciones(campo: string) {
  if (['fecha_carga_stl', 'fecha_porta'].includes(campo)) {
    return [
      ['es', 'es'],
      ['antes', 'antes de'],
      ['despues', 'después de'],
      ['entre', 'entre'],
      ['vacio', 'está vacío'],
      ['no_vacio', 'no está vacío'],
    ]
  }

  if (['pin', 'sim_operativo'].includes(campo)) {
    return [
      ['no_vacio', 'con dato'],
      ['vacio', 'sin dato'],
    ]
  }

  if (campo === 'numero_seguimiento') {
    return [
      ['contiene', 'contiene'],
      ['es', 'es'],
      ['no_es', 'no es'],
      ['vacio', 'está vacío'],
      ['no_vacio', 'no está vacío'],
    ]
  }

  if (campo === 'responsable') {
    return [
      ['es', 'es'],
      ['no_es', 'no es'],
      ['vacio', 'sin responsable'],
      ['no_vacio', 'con responsable'],
    ]
  }

  return [
    ['es', 'es'],
    ['no_es', 'no es'],
    ['vacio', 'está vacío'],
    ['no_vacio', 'no está vacío'],
  ]
}

export default function FiltrosAvanzadosVentas({
  estados,
  vendedores,
  responsables,
  mediosDespacho,
  companias,
  iniciales = [],
}: Props) {
  const [filtros, setFiltros] = useState<Filtro[]>(
    iniciales.length ? iniciales.slice(0, 4) : [{ ...vacio }]
  )

  const cambiar = (indice: number, cambio: Partial<Filtro>) => {
    setFiltros((actuales) =>
      actuales.map((filtro, i) =>
        i === indice ? { ...filtro, ...cambio } : filtro
      )
    )
  }

  const opcionesValor = (campo: string) => {
    if (campo === 'estado') return estados
    if (campo === 'tipo') return ['BAF', 'PORTA', 'LN']
    if (campo === 'vendedor') return vendedores
    if (campo === 'responsable') return responsables.filter((v) => v !== 'Sin responsable')
    if (campo === 'medio_despacho') return mediosDespacho
    if (campo === 'tipo_sim') return ['eSIM', 'SIMCARD']
    if (campo === 'compania_actual') return companias
    return []
  }

  return (
    <div className="md:col-span-2 xl:col-span-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-800">Filtros avanzados</div>
          <div className="text-xs text-gray-500">
            Combiná condiciones para armar una bandeja de trabajo.
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {filtros.map((filtro, indice) => {
          const requiereValor = !['vacio', 'no_vacio'].includes(filtro.condicion)
          const esFecha = ['fecha_carga_stl', 'fecha_porta'].includes(filtro.campo)
          const opciones = opcionesValor(filtro.campo)

          return (
            <div
              key={indice}
              className="grid grid-cols-1 gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 md:grid-cols-[90px_1.4fr_1fr_1.5fr_auto]"
            >
              <div>
                {indice === 0 ? (
                  <div className="flex h-10 items-center text-xs font-semibold uppercase text-gray-400">
                    Filtro 1
                  </div>
                ) : (
                  <select
                    name={`f${indice + 1}_join`}
                    value={filtro.conector}
                    onChange={(e) =>
                      cambiar(indice, { conector: e.target.value as 'AND' | 'OR' })
                    }
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm font-bold text-gray-700"
                  >
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                  </select>
                )}
              </div>

              <select
                name={`f${indice + 1}_field`}
                value={filtro.campo}
                onChange={(e) =>
                  cambiar(indice, {
                    campo: e.target.value,
                    condicion: '',
                    valor: '',
                    valor2: '',
                  })
                }
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900"
              >
                <option value="">Campo...</option>
                {CAMPOS.map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>{etiqueta}</option>
                ))}
              </select>

              <select
                name={`f${indice + 1}_op`}
                value={filtro.condicion}
                disabled={!filtro.campo}
                onChange={(e) =>
                  cambiar(indice, { condicion: e.target.value, valor: '', valor2: '' })
                }
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 disabled:bg-gray-100"
              >
                <option value="">Condición...</option>
                {condiciones(filtro.campo).map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>{etiqueta}</option>
                ))}
              </select>

              <div className="flex gap-2">
                {requiereValor && filtro.condicion ? (
                  esFecha ? (
                    <>
                      <input
                        type="date"
                        name={`f${indice + 1}_value`}
                        value={filtro.valor}
                        onChange={(e) => cambiar(indice, { valor: e.target.value })}
                        className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900"
                      />
                      {filtro.condicion === 'entre' && (
                        <input
                          type="date"
                          name={`f${indice + 1}_value2`}
                          value={filtro.valor2}
                          onChange={(e) => cambiar(indice, { valor2: e.target.value })}
                          className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900"
                        />
                      )}
                    </>
                  ) : filtro.campo === 'numero_seguimiento' ? (
                    <input
                      type="text"
                      name={`f${indice + 1}_value`}
                      value={filtro.valor}
                      onChange={(e) => cambiar(indice, { valor: e.target.value })}
                      placeholder="Número de seguimiento..."
                      className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900"
                    />
                  ) : (
                    <select
                      name={`f${indice + 1}_value`}
                      value={filtro.valor}
                      onChange={(e) => cambiar(indice, { valor: e.target.value })}
                      className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900"
                    >
                      <option value="">Valor...</option>
                      {opciones.map((opcion) => (
                        <option key={opcion} value={opcion}>{opcion}</option>
                      ))}
                    </select>
                  )
                ) : (
                  <div className="flex h-10 w-full items-center rounded-lg border border-dashed border-gray-200 px-3 text-xs text-gray-400">
                    No requiere valor
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (filtros.length === 1) {
                    setFiltros([{ ...vacio }])
                  } else {
                    setFiltros((actuales) => actuales.filter((_, i) => i !== indice))
                  }
                }}
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-500 hover:bg-gray-100"
                title="Quitar filtro"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-2">
        <button
          type="button"
          disabled={filtros.length >= 4}
          onClick={() => setFiltros((actuales) => [...actuales, { ...vacio }])}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          + Agregar filtro
        </button>
        <span className="ml-2 text-xs text-gray-400">Hasta 4 condiciones combinadas.</span>
      </div>
    </div>
  )
}
