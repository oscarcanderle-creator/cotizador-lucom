'use client'

type Opcion = { valor: string; etiqueta: string }
type Campo = {
  valor: string
  etiqueta: string
  tipo?: 'texto' | 'lista' | 'fecha'
  opciones?: Opcion[]
}

type Inicial = {
  campo: string
  condicion: string
  valor: string
  valor2: string
  conector: 'AND' | 'OR'
}

export default function FiltrosAvanzadosSuper({
  campos,
  iniciales = [],
}: {
  campos: Campo[]
  iniciales?: Inicial[]
}) {
  const filas = [0, 1, 2, 3]

  const campoInicial = (i: number) => campos.find(c => c.valor === iniciales[i]?.campo)
  const condiciones = (tipo?: Campo['tipo']) => {
    if (tipo === 'fecha') return [
      ['es', 'Es'], ['antes', 'Antes de'], ['despues', 'Después de'],
      ['entre', 'Entre'], ['vacio', 'Vacío'], ['no_vacio', 'No vacío'],
    ]
    if (tipo === 'lista') return [
      ['es', 'Es'], ['no_es', 'No es'], ['vacio', 'Vacío'], ['no_vacio', 'No vacío'],
    ]
    return [
      ['contiene', 'Contiene'], ['es', 'Es'], ['no_es', 'No es'],
      ['vacio', 'Vacío'], ['no_vacio', 'No vacío'],
    ]
  }

  return (
    <div className="md:col-span-2 xl:col-span-6 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="mb-3 text-sm font-semibold text-gray-800">Filtros avanzados</div>
      <div className="space-y-3">
        {filas.map((i) => {
          const n = i + 1
          const inicial = iniciales[i]
          const campo = campoInicial(i)
          return (
            <div key={n} className="grid grid-cols-1 gap-2 md:grid-cols-[90px_1.3fr_1fr_1.4fr_1.4fr]">
              <div>
                {n > 1 ? (
                  <select name={`f${n}_join`} defaultValue={inicial?.conector || 'AND'} className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900">
                    <option value="AND">Y</option>
                    <option value="OR">O</option>
                  </select>
                ) : <div className="px-2 py-2 text-sm text-gray-500">Donde</div>}
              </div>
              <select name={`f${n}_field`} defaultValue={inicial?.campo || ''} className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900">
                <option value="">Campo...</option>
                {campos.map(c => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}
              </select>
              <select name={`f${n}_op`} defaultValue={inicial?.condicion || ''} className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900">
                <option value="">Condición...</option>
                {condiciones(campo?.tipo).map(([v,e]) => <option key={v} value={v}>{e}</option>)}
              </select>
              {campo?.tipo === 'lista' ? (
                <select name={`f${n}_value`} defaultValue={inicial?.valor || ''} className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900">
                  <option value="">Valor...</option>
                  {(campo.opciones || []).map(o => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
                </select>
              ) : (
                <input type={campo?.tipo === 'fecha' ? 'date' : 'text'} name={`f${n}_value`} defaultValue={inicial?.valor || ''} placeholder="Valor..." className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900" />
              )}
              <input type={campo?.tipo === 'fecha' ? 'date' : 'text'} name={`f${n}_value2`} defaultValue={inicial?.valor2 || ''} placeholder="Segundo valor (solo Entre)" className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900" />
            </div>
          )
        })}
      </div>
      <div className="mt-2 text-xs text-gray-500">Podés combinar hasta 4 condiciones con Y / O.</div>
    </div>
  )
}
