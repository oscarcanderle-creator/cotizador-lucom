import { leerXlsxClaro } from './leerXlsxClaro'

const encabezados = ['Dia Id','Estado Id','Estado','Fecha Inicio','Tramite','Nim Cabecera','Cuenta Id','Cantidad','Entidad','Donante','Bloque','Can Id','Canal Ventas Desc','Fecha Agenda','Cuit','Tipo Portacion','Client Id','Client Desc','Srf Usr Id','Usr Name','Usr Surname','Negocio Origen','SDS']
const texto = (v: unknown) => String(v ?? '').trim()
const nullable = (v: unknown) => texto(v) || null
function entero(v: unknown) {
  if (!texto(v)) return null
  const n = Number(v)
  if (!Number.isSafeInteger(n) || n < 0 || n > 2147483647) throw new Error('Número entero inválido')
  return n
}
function fecha(v: unknown) {
  const s = texto(v)
  if (!s) return null
  if (!/^\d+(?:\.\d+)?$/.test(s)) throw new Error('Fecha Excel inválida')
  const n = Number(s)
  if (n < 1 || n > 100000) throw new Error('Fecha Excel fuera de rango')
  return new Date(Math.round((n - 25569) * 86400) * 1000).toISOString().slice(0,19)
}
export async function leerTramitesPortabilidad(buffer: ArrayBuffer) {
  const hoja = await leerXlsxClaro(buffer)
  const cab = hoja.filas[0]?.map(texto) ?? []
  if (cab.length !== encabezados.length || !encabezados.every((h,i) => h === cab[i])) throw new Error('Encabezados incorrectos para Trámites de Portabilidad.')
  const vistos = new Set<string>()
  const datos = []
  for (const [i,f] of hoja.filas.slice(1).entries()) {
    if (!f.some(texto) || f.some(v => texto(v).startsWith('Filtros aplicados:'))) continue
    try {
      const tramite = texto(f[4])
      const cantidad = entero(f[7])
      if (!tramite || !texto(f[2]) || !texto(f[22]) || cantidad === null || cantidad < 1 || !texto(f[3])) throw new Error('Faltan datos obligatorios')
      if (vistos.has(tramite)) throw new Error('Trámite duplicado: ' + tramite)
      vistos.add(tramite)
      datos.push({dia_id: entero(f[0]), estado_id: entero(f[1]), estado: texto(f[2]), fecha_inicio: fecha(f[3]), tramite, nim_cabecera: nullable(f[5]), cuenta_id: nullable(f[6]), cantidad, entidad: nullable(f[8]), donante: nullable(f[9]), bloque: nullable(f[10]), can_id: nullable(f[11]), canal_ventas_desc: nullable(f[12]), fecha_agenda: fecha(f[13]), cuit: nullable(f[14]), tipo_portacion: nullable(f[15]), client_id: nullable(f[16]), client_desc: nullable(f[17]), srf_usr_id: nullable(f[18]), usr_name: nullable(f[19]), usr_surname: nullable(f[20]), negocio_origen: nullable(f[21]), sds: texto(f[22])})
    } catch (e) { throw new Error('Fila Excel ' + (i+2) + ': ' + (e instanceof Error ? e.message : 'Datos inválidos')) }
  }
  if (!datos.length) throw new Error('No hay trámites para importar.')
  return { hoja, datos }
}
