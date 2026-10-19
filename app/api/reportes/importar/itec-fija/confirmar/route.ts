import { NextResponse } from 'next/server'
import { createClient } from '../../../../../../utils/supabase/server'
import { createAdminClient } from '../../../../../../utils/supabase/admin'
import { leerCsvClaro } from '../../../../../../lib/reportes/leerCsvClaro'

const str = (v: unknown) => String(v ?? '').trim()
const norm = (v: unknown) => str(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
const emailValido = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
const headers = [
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
// Interpreta la fecha de ITEC como hora local argentina (UTC-03:00).
// Acepta d/m/aa, d/m/aaaa y horas de uno o dos dígitos.
function fechaCreacionItec(valor: unknown): string | null {
  const m = str(valor).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return null
  const dia = Number(m[1]), mes = Number(m[2])
  const anio = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
  const hora = Number(m[4]), minuto = Number(m[5]), segundo = Number(m[6] ?? '0')
  if (anio < 2000 || mes < 1 || mes > 12 || dia < 1 || dia > 31 || hora > 23 || minuto > 59 || segundo > 59) return null
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${anio}-${pad(mes)}-${pad(dia)}T${pad(hora)}:${pad(minuto)}:${pad(segundo)}-03:00`
}

function fechaNacimiento(v: string) {
  const t = str(v)
  if (!t || norm(t) === 'NULO') return ''
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : ''
}
function interpretar(sds: string, plan: string) {
  if (!/^[0-9]{8}(FAE|TAE)$/.test(sds)) return null
  const n = norm(plan).replace(/\s+/g,' ').trim()
  const anadir = sds.endsWith('TAE') && (!n || n === 'NULO' || n === 'NULL')
  if (anadir) return {anadir:true, tv:true, plan:'AÑADIR TV'}
  const m = n.match(/^(?:INTERNET SIMETRICO )?(200|500|800)\s*MB$/)
  if (!m) return null
  return {anadir:false,tv:sds.endsWith('TAE'),plan:`${m[1]} MB`}
}

export async function POST(request: Request) {
  try {
    const sb = await createClient()
    const {data:{user}} = await sb.auth.getUser()
    if (!user) return NextResponse.json({error:'Sesión expirada'},{status:401})
    const {data:perfil} = await sb.from('profiles').select('rol,activo').eq('id',user.id).single()
    if (!perfil?.activo || !['ADMIN','SUPERVISOR','BBOO'].includes(norm(perfil.rol)))
      return NextResponse.json({error:'Sin permisos para importar'},{status:403})
    const fd = await request.formData()
    const archivo = fd.get('archivo')
    if (!(archivo instanceof File) || !archivo.name.toLowerCase().endsWith('.csv') || archivo.size > 10*1024*1024)
      return NextResponse.json({error:'CSV inválido o mayor a 10 MB'},{status:400})
    const hoja = await leerCsvClaro(await archivo.arrayBuffer())
    const [cabecera,...filas] = hoja.filas
    if (!cabecera || cabecera.length !== headers.length || !headers.every((h,i)=>str(cabecera[i]).replace(/^\uFEFF/,'')===h))
      return NextResponse.json({error:'Los encabezados de ITEC FIJA no coinciden'},{status:400})
    const admin = createAdminClient()
    const {data:vendedores,error:errorVendedores} = await admin.from('profiles')
      .select('id,dni_vendedor,activo').not('dni_vendedor','is',null)
    if (errorVendedores) throw errorVendedores
    const mapa = new Map((vendedores??[]).filter(v=>v.activo).map(v=>[str(v.dni_vendedor),v.id]))
    const vistos = new Set<string>()
    const pendientes: {fila:number;sds:string;ot:string;motivos:string[]}[] = []
    let creadas=0,existentes=0,duplicadas=0,preventasOmitidas=0
    const registros = filas.filter(f=>f.some(v=>str(v))&&!str(f[0]).startsWith('Filtros aplicados:'))
    for (const [i,f] of registros.entries()) {
      const tipo = norm(f[0])
      if (tipo !== 'V' && tipo !== 'PV') {
        pendientes.push({fila:i+2,sds:str(f[12]).toUpperCase(),ot:str(f[13]),motivos:[`Tipo de registro no reconocido: ${str(f[0]) || '(vacío)'}. Solo se importan registros V o PV.`]})
        continue
      }
      const sds = str(f[12]).toUpperCase(), ot=str(f[13]), vendedorDni=str(f[9])
      if (norm(ot) === 'NO ASIGNADA') {
        pendientes.push({
          fila:i+2, sds, ot,
          motivos:['Descartada: OT No Asignada (venta cancelada por mala carga)']
        })
        continue
      }
      if (sds && vistos.has(sds)) {duplicadas++;continue}
      if (sds) vistos.add(sds)
      const prod = interpretar(sds,str(f[15])) ??
         (tipo === 'PV' && /^[0-9]{8}(FAE|TAE)$/.test(sds) && /^(100|300|600)\s*MB$/.test(norm(f[15]).trim())
           ? {anadir:false,tv:sds.endsWith('TAE'),plan:`${norm(f[15]).trim().match(/^(100|300|600)/)?.[1]} MB`}
           : null)
      const telefono = str(f[27]).replace(/\s+/g,'')
      const tv = prod?.tv ?? false
      const q = str(f[16]); const decos = tv ? (q ? Number(q)-1 : 0) : 0
      const motivos:string[]=[]
      if (!prod) motivos.push('SDS o plan sin equivalencia')
       const fechaItec = tipo === 'V' ? fechaCreacionItec(f[2]) : null
       if (tipo === 'V' && !fechaItec) motivos.push('Fecha de creación ITEC inválida')
      if (!/^[0-9]{8}$/.test(ot)) motivos.push('OT inválida')
      if (!mapa.has(vendedorDni)) motivos.push('Vendedor inexistente o inactivo')
      if (!['DNI','CUIT','LC','LE'].includes(norm(f[22]))) motivos.push('Documento no admitido')
      if (!str(f[23]).replace(/\D/g,'')) motivos.push('Documento vacío')
      if (!str(f[19]) || !str(f[20])) motivos.push('Nombre o apellido vacío')
      if (!/^[1-46-9]\d{9}$/.test(telefono)) motivos.push('Teléfono inválido')
      if (!emailValido(str(f[28]))) motivos.push('Email inválido')
      if (!str(f[29]) || !str(f[30]) || !str(f[36])) motivos.push('Domicilio incompleto')
      if (tv && q && (!/^\d+$/.test(q) || !Number.isInteger(decos) || decos<0 || decos>2))
        motivos.push('Decodificadores inválidos')
      if (motivos.length) {pendientes.push({fila:i+2,sds,ot,motivos});continue}
      const payload = {
        sds,ot,tipo_itec:tipo,fecha_creacion_itec:fechaItec,dni_vendedor:vendedorDni,vendedor_id:mapa.get(vendedorDni),actor_id:user.id,
        tipo_documento:norm(f[22]),dni:str(f[23]).replace(/\D/g,''),
        apellido:str(f[19]),nombre:str(f[20]),fecha_nacimiento:fechaNacimiento(str(f[24])),
        telefono,email:str(f[28]),domicilio:`${str(f[29])} ${str(f[30])}`.trim(),
        piso:str(f[32]),dpto:str(f[33]),entre_calles:str(f[34]),barrio:str(f[38]),
        localidad:str(f[36]),cia_celular:norm(f[26]),
        plan:prod!.plan,anadir_tv:prod!.anadir,tv:prod!.tv,decos,
      }
      const {data,error} = await admin.rpc('importar_venta_itec_fija',{p:payload})
      if (error) {pendientes.push({fila:i+2,sds,ot,motivos:[error.message]});continue}
      if (data?.estado==='CREADA') creadas++
      else if (data?.estado==='EXISTENTE') existentes++
      else pendientes.push({fila:i+2,sds,ot,motivos:['Respuesta desconocida de la base de datos']})
    }
    return NextResponse.json({
      ok:true,importacion_id:0,encontrados:registros.length,validos:creadas,
      descartados:existentes+duplicadas+pendientes.length,insertados:creadas,
      actualizados:0,sin_cambios:existentes,reporte:'ITEC FIJA - Ventas BAF',archivo:archivo.name,
      nuevas:creadas,existentes,duplicados_archivo:duplicadas,
      preventas_omitidas:0,
      cantidad_pendientes:pendientes.length,pendientes,
      mensaje:`Importación finalizada: ${creadas} creadas, ${existentes} existentes, ${duplicadas} duplicadas en CSV, ${pendientes.length} pendientes.`,
    })
  } catch (e:unknown) {
    console.error('Importación ITEC FIJA',e)
    return NextResponse.json({error:e instanceof Error?e.message:'Error de importación'},{status:500})
  }
}
