import { NextResponse } from 'next/server'
import { createClient } from '../../../../../../utils/supabase/server'
import { createAdminClient } from '../../../../../../utils/supabase/admin'
import { leerCsvClaro } from '../../../../../../lib/reportes/leerCsvClaro'

const HEADERS = [
  'Tipo','Id solicitud','Fecha y hora de creación','Fecha y hora de modificación',
  'Estado','Motivo de Cancelación','ID visita','Número de agente','Agente',
  'Usuario','Vendedor','Supervisor del agente','SDS','OT','Servicios',
  'Plan de internet','Cantidad decodificadores','Packs','Método de pago',
  'Titular - Apellido','Titular - Nombre','Titular - Sexo',
  'Titular - Tipo de identificación','Titular - Número de identificación',
  'Titular - Fecha de nacimiento','Titular - Tipo de teléfono',
  'Titular - Empresa celular','Titular - Número','Titular - Email',
  'Calle','Altura','Torre','Piso','Departamento','Entre calles',
  'Provincia','Localidad','Partido','Barrio','Territorio',
  'Supervisor','Gerente Regional','Gerente Nacional','Backoffice',
]
const str = (x: unknown) => String(x ?? '').trim()
const norm = (x: unknown) => str(x).normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ')
function interpretarProducto(sds: string, plan: string) {
  const codigo = str(sds).toUpperCase()
  const planNormalizado = norm(plan)
  const sinPlan = !planNormalizado || ['NULO', 'NULL'].includes(planNormalizado)
  if (!codigo.endsWith('FAE') && !codigo.endsWith('TAE')) return null
  if (codigo.endsWith('TAE') && sinPlan) {
    return {producto: 'AÑADIR TV', tv: true, requiereInternetExistente2Play: true}
  }
  if (sinPlan) return null
  const coincidencia = planNormalizado.match(/^(?:INTERNET SIMETRICO )?(200|500|800)\s*MB$/)
  if (!coincidencia) return null
  return {
    producto: `${coincidencia[1]}MB - BAF`,
    tv: codigo.endsWith('TAE'),
    requiereInternetExistente2Play: false,
  }
}
const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

export async function POST(request: Request) {
  try {
    const sb = await createClient()
    const {data:{user}} = await sb.auth.getUser()
    if (!user) return NextResponse.json({error:'No autenticado.'},{status:401})
    const {data:profile} = await sb.from('profiles').select('rol,activo').eq('id',user.id).single()
    if (!profile?.activo || !['ADMIN','SUPERVISOR','BBOO'].includes(str(profile.rol).toUpperCase()))
      return NextResponse.json({error:'Sin permisos para validar.'},{status:403})

    const fd = await request.formData()
    const archivo = fd.get('archivo')
    if (!(archivo instanceof File) || !archivo.name.toLowerCase().endsWith('.csv'))
      return NextResponse.json({error:'Seleccioná un CSV de ITEC FIJA.'},{status:400})
    if (archivo.size > 10 * 1024 * 1024)
      return NextResponse.json({error:'El CSV supera 10 MB.'},{status:400})

    const hoja = await leerCsvClaro(await archivo.arrayBuffer())
    const [cabecera,...filas] = hoja.filas
    if (!cabecera || cabecera.length !== HEADERS.length ||
        !HEADERS.every((h,i) => str(cabecera[i]).replace(/^\uFEFF/,'') === h))
      return NextResponse.json({error:'Los 44 encabezados no corresponden a ITEC FIJA.'},{status:400})

    const registros = filas.filter(f => f.some(v => str(v)) && !str(f[0]).startsWith('Filtros aplicados:'))
    const admin = createAdminClient()
    const {data:vendedores,error:errorVendedores} = await admin.from('profiles')
      .select('id,nombre,vendedor,dni_vendedor,activo').not('dni_vendedor','is',null)
    if (errorVendedores) throw new Error(errorVendedores.message)
    const gestiones: Array<{id:number;sds:string|null;orden_trabajo:string|null}> = []
    for (let offset=0; ; offset+=1000) {
      const {data,error} = await admin.from('gestion_producto_baf')
        .select('id,sds,orden_trabajo').range(offset,offset+999)
      if (error) throw new Error(error.message)
      gestiones.push(...(data ?? []))
      if (!data || data.length<1000) break
    }

    const mapaVendedores = new Map((vendedores ?? []).filter(v=>v.activo)
      .map(v=>[str(v.dni_vendedor),v]))
    const existentes = new Set(gestiones.map(g=>str(g.sds).toUpperCase()).filter(Boolean))
    // Las OT pueden pertenecer a ventas con un SDS diferente.
    const gestionesPorOt = new Map<string,{id:number;sds:string}>()
    for (const gestion of gestiones) {
      const ot = str(gestion.orden_trabajo)
      if (ot && !gestionesPorOt.has(ot)) {
        gestionesPorOt.set(ot,{id:gestion.id,sds:str(gestion.sds).toUpperCase()})
      }
    }
    const sdsPorOtArchivo = new Map<string,string>()
    const vistos = new Set<string>()
    const pendientes: Array<{fila:number;sds:string;ot:string;motivos:string[]}> = []
    let nuevos = 0, yaExistentes = 0, duplicadosArchivo = 0, preventasOmitidas = 0
    for (const [i,f] of registros.entries()) {
      const tipo = norm(f[0])
      if (tipo === 'PV') { preventasOmitidas++; continue }
      if (tipo !== 'V') {
        pendientes.push({fila:i+2,sds:str(f[12]).toUpperCase(),ot:str(f[13]),motivos:[`Tipo de registro no reconocido: ${str(f[0]) || '(vacío)'}. Solo se importan ventas V.`]})
        continue
      }
      const sds = str(f[12]).toUpperCase()
      if (sds && vistos.has(sds)) { duplicadosArchivo++; continue }
      if (sds) vistos.add(sds)
      if (sds && existentes.has(sds)) { yaExistentes++; continue }
      const motivos: string[] = []
      const ot = str(f[13])
      const ventaConOt = gestionesPorOt.get(ot)
      if (ot && ventaConOt && ventaConOt.sds !== sds) {
        motivos.push(`OT ${ot} ya registrada en PGL (ID ${ventaConOt.id}) con SDS ${ventaConOt.sds || 'sin SDS'}. Revisar posible error de carga.`)
      }
      const sdsPrevioConOt = sdsPorOtArchivo.get(ot)
      if (ot && sdsPrevioConOt && sdsPrevioConOt !== sds) {
        motivos.push(`OT ${ot} repetida dentro del CSV con SDS diferente (${sdsPrevioConOt}).`)
      }
      if (ot && !sdsPorOtArchivo.has(ot)) sdsPorOtArchivo.set(ot,sds)
      if (!/^[0-9]{8}[A-Z]{3}$/.test(sds)) motivos.push('SDS inválido')
      if (!/^[0-9]{8}$/.test(str(f[13]))) motivos.push('OT inválida')
      if (!mapaVendedores.has(str(f[9]))) motivos.push('DNI de vendedor no encontrado o inactivo')
      if (!interpretarProducto(sds,str(f[15]))) motivos.push('Servicios / Plan sin equivalencia')
      if (!['DNI','CUIT'].includes(norm(f[22]))) motivos.push('Tipo de documento no admitido')
      if (!str(f[23]).replace(/\D/g,'')) motivos.push('Documento del cliente vacío')
      if (!str(f[19]) || !str(f[20])) motivos.push('Nombre o apellido vacío')
      if (!/^[1-46-9]\d{9}$/.test(str(f[27]).replace(/\s+/g,''))) motivos.push('Teléfono inválido')
      if (!emailValido(str(f[28]))) motivos.push('Correo inválido')
      if (!str(f[29]) || !str(f[30])) motivos.push('Calle o altura vacía')
      if (!str(f[36])) motivos.push('Localidad vacía')
      const decos = str(f[16])
      const tv = interpretarProducto(sds,str(f[15]))?.tv ?? false
      if (tv && decos && (!/^\d+$/.test(decos) || Number(decos)<1 || Number(decos)>3))
        motivos.push('Cantidad de decodificadores inválida')
      // Si SDS termina en FAE, la columna Q no determina TV ni invalida la venta.
      if (motivos.length) pendientes.push({fila:i+2,sds,ot,motivos})
      else nuevos++
    }
    return NextResponse.json({
      ok:true,tipo:'ITEC_FIJA',reporte:'ITEC FIJA (solo validación)',
      archivo:archivo.name,filas_archivo:hoja.cantidadFilas,columnas:hoja.cantidadColumnas,
      registros_encontrados:registros.length,registros_validos:nuevos,
      registros_descartados:pendientes.length+yaExistentes+duplicadosArchivo+preventasOmitidas,
      nuevas:nuevos,existentes:yaExistentes,duplicados_archivo:duplicadosArchivo,
      preventas_omitidas:preventasOmitidas,
      pendientes, cantidad_pendientes:pendientes.length,
      mensaje:'Validación finalizada. No se creó ni modificó ninguna venta.',
    })
  } catch (error: unknown) {
    console.error('Validación ITEC FIJA',error)
    return NextResponse.json({error:error instanceof Error ? error.message : 'Error de validación'},{status:500})
  }
}
