/** Motor de filtros de ReportMaker v7. Sin dependencias de React ni Supabase. */
export const CAMPOS_FILTRABLES = [
  'id_operacion', 'tipo', 'negocios', 'vendedor', 'origen_dato',
  'cliente', 'dni', 'telefono', 'estado_venta', 'estado_bboo',
  'plan', 'sim', 'legajo_enviado',
] as const

export type CampoFiltrable = (typeof CAMPOS_FILTRABLES)[number]
export type OperadorFiltro = 'igual' | 'contiene'
export type UnionFiltro = 'AND' | 'OR'
export type FiltroReportMaker = {
  id: number
  campo: CampoFiltrable
  operador: OperadorFiltro
  valor: string
  union: UnionFiltro
}

const CAMPOS_VALIDOS = new Set<string>(CAMPOS_FILTRABLES)
const MAX_FILTROS = 4

export function validarFiltros(entrada: unknown): FiltroReportMaker[] {
  if (entrada == null) return []
  if (!Array.isArray(entrada)) throw new Error('Los filtros deben ser una lista.')
  if (entrada.length > MAX_FILTROS) throw new Error('Se permiten hasta 4 filtros.')

  const ids = new Set<number>()
  return entrada.map((dato: unknown, indice: number) => {
    if (!dato || typeof dato !== 'object' || Array.isArray(dato)) {
      throw new Error(`El filtro ${indice + 1} no es válido.`)
    }
    const f = dato as Record<string, unknown>
    if (typeof f.id !== 'number' || !Number.isSafeInteger(f.id) || ids.has(f.id)) {
      throw new Error(`El identificador del filtro ${indice + 1} no es válido.`)
    }
    ids.add(f.id)
    if (typeof f.campo !== 'string' || !CAMPOS_VALIDOS.has(f.campo)) {
      throw new Error(`El campo del filtro ${indice + 1} no está disponible.`)
    }
    if (f.operador !== 'igual' && f.operador !== 'contiene') {
      throw new Error(`El operador del filtro ${indice + 1} no es válido.`)
    }
    if (typeof f.valor !== 'string' || !f.valor.trim() || f.valor.length > 200) {
      throw new Error(`Ingresá un valor válido (máximo 200 caracteres) en el filtro ${indice + 1}.`)
    }
    if (f.union !== 'AND' && f.union !== 'OR') {
      throw new Error(`La unión del filtro ${indice + 1} no es válida.`)
    }
    return {
      id: f.id,
      campo: f.campo as CampoFiltrable,
      operador: f.operador,
      valor: f.valor.trim(),
      union: f.union,
    }
  })
}

function normalizar(valor: unknown): string {
  return String(valor ?? '').trim().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR')
}

export function cumpleFiltros(
  registro: Record<string, unknown>,
  filtros: readonly FiltroReportMaker[],
): boolean {
  if (!filtros.length) return true
  const evaluar = (f: FiltroReportMaker): boolean => {
    const dato = normalizar(registro[f.campo])
    const esperado = normalizar(f.valor)
    return f.operador === 'igual' ? dato === esperado : dato.includes(esperado)
  }
  let cumple = evaluar(filtros[0])
  for (let i = 1; i < filtros.length; i++) {
    const f = filtros[i]
    cumple = f.union === 'AND' ? cumple && evaluar(f) : cumple || evaluar(f)
  }
  return cumple
}
