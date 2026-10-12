import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { POST as consultarPreview } from '../preview/route'
import { validarFiltros } from '../../../../lib/reportmaker/filtros'
import { CAMPOS_VENTAS } from '../../../../lib/reportmaker/catalogo'

const PERMITIDOS = new Set(CAMPOS_VENTAS.map(c => c.id))
const MAX_REGISTROS = 10000
const TITULOS: Record<string,string> = Object.fromEntries(CAMPOS_VENTAS.map(c => [c.id, c.etiqueta]))
type Registro = Record<string, string | number | boolean | null>
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    if (body.formato !== 'xlsx' && body.formato !== 'csv')
      return NextResponse.json({error:'Formato inválido.'},{status:400})
    if (!Array.isArray(body.columnas) || !body.columnas.length ||
        body.columnas.length > PERMITIDOS.size ||
        body.columnas.some((c:unknown) => typeof c !== 'string' || !PERMITIDOS.has(c)) ||
        new Set(body.columnas).size !== body.columnas.length)
      return NextResponse.json({error:'Columnas inválidas o no disponibles.'},{status:400})
    try { validarFiltros(body.filtros) }
    catch (error) { return NextResponse.json({error:error instanceof Error ? error.message : 'Filtros inválidos.'},{status:400}) }
    const registros: Registro[] = []
    let offset = 0
    let agotadas = false
    // Cada página vuelve a comprobar autenticación y permisos en el servidor.
    for (let vuelta = 0; vuelta <= MAX_REGISTROS / 100; vuelta++) {
      const peticion = new Request(new URL('/api/reportmaker/preview', request.url), {
        method:'POST', headers: {cookie:request.headers.get('cookie') || '', 'content-type':'application/json'},
        body:JSON.stringify({negocios:body.negocios,desde:body.desde,hasta:body.hasta,offset,filtros:body.filtros}),
      })
      const respuesta = await consultarPreview(peticion)
      const datos = await respuesta.json()
      if (!respuesta.ok)
        return NextResponse.json({error:datos.error || 'Error al consultar operaciones.'},{status:respuesta.status})
      if (datos.busquedaParcial)
        return NextResponse.json({error:'La consulta alcanzó el límite de exploración. Reducí el período para exportar sin omisiones.'},{status:422})
      const lote = Array.isArray(datos.registros) ? datos.registros as Registro[] : []
      if (registros.length + lote.length > MAX_REGISTROS)
        return NextResponse.json({error:'Más de 10.000 registros. Reducí el período para obtener una exportación completa.'},{status:422})
      registros.push(...lote)
      agotadas = Boolean(datos.agotadas)
      const siguiente = Number(datos.siguienteOffset)
      if (agotadas) break
      if (!Number.isSafeInteger(siguiente) || siguiente <= offset)
        return NextResponse.json({error:'No se pudo completar la paginación.'},{status:500})
      offset = siguiente
    }
    if (!agotadas)
      return NextResponse.json({error:'No se pudo verificar que se hayan recuperado todos los registros.'},{status:422})
    const columnas = body.columnas as string[]
    const nombre = `ReportMaker_${body.desde}_${body.hasta}`
    if (body.formato === 'csv') {
      const escapar = (valor:unknown) => '"' + String(valor ?? '').replace(/"/g,'""') + '"'
      const contenido = '\uFEFF' + [columnas.map(c => escapar(TITULOS[c])).join(';'),
        ...registros.map(r => columnas.map(c => escapar(r[c])).join(';'))].join('\r\n')
      return new Response(contenido, {headers:{'Content-Type':'text/csv; charset=utf-8',
        'Content-Disposition':`attachment; filename="${nombre}.csv"`, 'Cache-Control':'no-store'}})
    }
    const libro = new ExcelJS.Workbook()
    const hoja = libro.addWorksheet('Operaciones')
    hoja.columns = columnas.map(c => ({header:TITULOS[c],key:c,width:Math.max(16,Math.min(35,TITULOS[c].length+6))}))
    hoja.getRow(1).font = {bold:true,color:{argb:'FFFFFFFF'}}
    hoja.getRow(1).fill = {type:'pattern',pattern:'solid',fgColor:{argb:'FFB5091B'}}
    hoja.views = [{state:'frozen',ySplit:1}]
    hoja.autoFilter = {from:{row:1,column:1},to:{row:1,column:columnas.length}}
    for (const registro of registros) hoja.addRow(Object.fromEntries(columnas.map(c => [c,String(registro[c] ?? '')])))
    const buffer = await libro.xlsx.writeBuffer()
    return new Response(new Uint8Array(buffer as ArrayBuffer), {headers:{
      'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':`attachment; filename="${nombre}.xlsx"`, 'Cache-Control':'no-store'}})
  } catch (error) {
    console.error('[ReportMaker export]',error)
    return NextResponse.json({error:'No se pudo generar la exportación.'},{status:500})
  }
}
