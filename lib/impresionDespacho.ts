export type CampoDespacho = 'destinatario' | 'domicilio' | 'entreCalles' | 'telefono' | 'medio' | 'operacion' | 'codigo' | 'qr' | 'chips' | 'planStl' | 'planContratado' | 'firma' | 'dniRecepcion'
export type ConfigDespacho = {
  titulo: string
  subtitulo: string
  nota: string
  textoRecepcion: string
  mostrarLogo: boolean
  mostrarLogoClaro: boolean
  tamanoLogoClaro: number
  tamanoFuente: number
  campos: Record<CampoDespacho, boolean>
}
export const CAMPOS: { key: CampoDespacho; nombre: string; zona: 'Exterior' | 'Interior' }[] = [
  { key: 'destinatario', nombre: 'Destinatario', zona: 'Exterior' },
  { key: 'domicilio', nombre: 'Domicilio', zona: 'Exterior' },
  { key: 'codigo', nombre: 'Código de envío', zona: 'Exterior' },
  { key: 'qr', nombre: 'Código QR', zona: 'Exterior' },
  { key: 'entreCalles', nombre: 'Entre calles', zona: 'Interior' },
  { key: 'telefono', nombre: 'Teléfono', zona: 'Interior' },
  { key: 'medio', nombre: 'Medio de despacho', zona: 'Interior' },
  { key: 'operacion', nombre: 'Número de operación', zona: 'Interior' },
  { key: 'chips', nombre: 'Detalle de chips y SIM', zona: 'Interior' },
  { key: 'planStl', nombre: 'Plan STL', zona: 'Interior' },
  { key: 'planContratado', nombre: 'Plan contratado', zona: 'Interior' },
  { key: 'firma', nombre: 'Firma y aclaración', zona: 'Interior' },
  { key: 'dniRecepcion', nombre: 'DNI de quien recibe', zona: 'Interior' },
]
export const CONFIG_PREDETERMINADA: ConfigDespacho = {
  titulo: 'HOJA DE DESPACHO',
  subtitulo: 'Grupo Lucom · Logística',
  nota: 'Verificar el contenido del envío antes de firmar la recepción.',
  textoRecepcion: 'Dejo constancia de la recepción del envío indicado.',
  mostrarLogo: true,
  mostrarLogoClaro: true,
  tamanoLogoClaro: 24,
  tamanoFuente: 12,
  campos: Object.fromEntries(CAMPOS.map(c => [c.key, true])) as Record<CampoDespacho, boolean>,
}
export function normalizarConfig(value: unknown): ConfigDespacho {
  const obj = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const campos = obj.campos && typeof obj.campos === 'object' && !Array.isArray(obj.campos) ? obj.campos as Record<string, unknown> : {}
  const texto = (key: 'titulo' | 'subtitulo' | 'nota' | 'textoRecepcion', max: number) => {
    const v = obj[key]
    return typeof v === 'string' ? v.trim().slice(0, max) : CONFIG_PREDETERMINADA[key]
  }
  return {
    titulo: texto('titulo', 80), subtitulo: texto('subtitulo', 120),
    nota: texto('nota', 1500), textoRecepcion: texto('textoRecepcion', 500),
    mostrarLogo: typeof obj.mostrarLogo === 'boolean' ? obj.mostrarLogo : true,
    mostrarLogoClaro: typeof obj.mostrarLogoClaro === 'boolean' ? obj.mostrarLogoClaro : true,
    tamanoLogoClaro: typeof obj.tamanoLogoClaro === 'number' && Number.isFinite(obj.tamanoLogoClaro) ? Math.max(14, Math.min(36, Math.round(obj.tamanoLogoClaro))) : 24,
    tamanoFuente: typeof obj.tamanoFuente === 'number' && Number.isFinite(obj.tamanoFuente) ? Math.max(10, Math.min(16, Math.round(obj.tamanoFuente))) : 12,
    campos: Object.fromEntries(CAMPOS.map(c => [c.key, typeof campos[c.key] === 'boolean' ? campos[c.key] : true])) as Record<CampoDespacho, boolean>,
  }
}
