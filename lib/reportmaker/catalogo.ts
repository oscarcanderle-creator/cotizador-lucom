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
  { id: 'responsable', etiqueta: 'Responsable', columna: 'responsable', tipo: 'texto' },
  { id: 'bboo', etiqueta: 'BBOO asignado', columna: 'bboo', tipo: 'texto' },
  { id: 'domicilio', etiqueta: 'Domicilio', columna: 'domicilio', tipo: 'texto' },
  { id: 'localidad', etiqueta: 'Localidad', columna: 'localidad', tipo: 'texto' },
  { id: 'barrio', etiqueta: 'Barrio', columna: 'barrio', tipo: 'texto' },
  { id: 'entre_calles', etiqueta: 'Entre calles', columna: 'entre_calles', tipo: 'texto' },
  { id: 'numero_linea', etiqueta: 'Número de línea', columna: 'numero_linea', tipo: 'texto' },
  { id: 'compania_actual', etiqueta: 'Compañía actual', columna: 'compania_actual', tipo: 'texto' },
  { id: 'tipo_sim', etiqueta: 'Tipo SIM', columna: 'tipo_sim', tipo: 'texto' },
  { id: 'plan_acordado', etiqueta: 'Plan acordado', columna: 'plan_acordado', tipo: 'texto' },
  { id: 'plan_cargado', etiqueta: 'Plan cargado', columna: 'plan_cargado', tipo: 'texto' },
  { id: 'pin', etiqueta: 'PIN / LNVA', columna: 'pin', tipo: 'texto' },
  { id: 'medio_despacho_chip', etiqueta: 'Medio despacho CHIP', columna: 'medio_despacho_chip', tipo: 'texto' },
  { id: 'numero_seguimiento', etiqueta: 'Número seguimiento', columna: 'numero_seguimiento', tipo: 'texto' },
  { id: 'sds', etiqueta: 'SDS', columna: 'sds', tipo: 'texto' },
  { id: 'fecha_instalacion', etiqueta: 'Fecha instalación', columna: 'fecha_instalacion', tipo: 'fecha' },
  { id: 'orden_trabajo', etiqueta: 'Orden de trabajo', columna: 'orden_trabajo', tipo: 'texto' },
  { id: 'estado_vendedor', etiqueta: 'Estado vendedor', columna: 'estado_vendedor', tipo: 'texto' },
  { id: 'estado_baf', etiqueta: 'Estado BAF', columna: 'estado_baf', tipo: 'texto' },
  { id: 'estado_claro', etiqueta: 'Estado Claro', columna: 'estado_claro', tipo: 'texto' },
  { id: 'motivo_cierre', etiqueta: 'Motivo cierre', columna: 'motivo_cierre', tipo: 'texto' },
  { id: 'fecha_cierre', etiqueta: 'Fecha cierre', columna: 'fecha_cierre', tipo: 'fecha' },
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
  { id: 'negocios', etiqueta: 'Negocios', columna: 'negocios', tipo: 'texto' },
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
