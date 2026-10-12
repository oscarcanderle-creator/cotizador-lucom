export type FuenteReporte = 'ventas'

export type CampoReporte = {
  id: string
  etiqueta: string
  columna: string
  tipo: 'texto' | 'fecha'
}

export const CAMPOS_VENTAS: CampoReporte[] = [
  {
    id: 'id_operacion',
    etiqueta: 'ID Operación',
    columna: 'id_operacion',
    tipo: 'texto',
  },
  {
    id: 'fecha_ingreso',
    etiqueta: 'Fecha de ingreso',
    columna: 'fecha_hora',
    tipo: 'fecha',
  },
  {
    id: 'tipo',
    etiqueta: 'Tipo de operación',
    columna: 'tipo',
    tipo: 'texto',
  },
  {
    id: 'vendedor',
    etiqueta: 'Vendedor',
    columna: 'vendedor',
    tipo: 'texto',
  },
  {
    id: 'origen_dato',
    etiqueta: 'Origen del dato',
    columna: 'origen_dato',
    tipo: 'texto',
  },
  {
    id: 'observaciones',
    etiqueta: 'Observaciones',
    columna: 'obs',
    tipo: 'texto',
  },
]

export const COLUMNAS_INICIALES = [
  'fecha_ingreso',
  'tipo',
  'vendedor',
  'origen_dato',
]

export const FUENTES_REPORTMAKER = [
  {
    id: 'ventas' as const,
    nombre: 'Ventas',
    descripcion: 'Operaciones comerciales BAF y PORTA',
    campos: CAMPOS_VENTAS,
  },
]
