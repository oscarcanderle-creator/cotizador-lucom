import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { createAdminClient } from '../../../../utils/supabase/admin'

const norm = (v: unknown) => String(v ?? '').trim().toUpperCase()
const promos2 = new Set(['5222', '5224', '5324'])
const promos3 = new Set(['5223', '5225', '5325'])
const LOTE = 500

export async function GET(request: Request) {
  try {
    const sb = await createClient()
    const { data: { user }, error: authError } = await sb.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    const { data: perfil, error: perfilError } = await sb.from('profiles')
      .select('rol,activo').eq('id', user.id).maybeSingle()
    if (perfilError || !perfil?.activo || !['ADMIN', 'SUPERVISOR'].includes(norm(perfil.rol)))
      return NextResponse.json({ error: 'Sin permisos.' }, { status: 403 })

    const periodo = new URL(request.url).searchParams.get('periodo') ?? ''
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo))
      return NextResponse.json({ error: 'Período inválido. Utilice AAAA-MM.' }, { status: 400 })

    const admin = createAdminClient()
    const historico = await admin.from('dashboard_baf_historico')
      .select('periodo,preventas_ok,finalizadas').order('periodo')
    if (historico.error) throw historico.error

    const totales = { preventas_ok: 0, finalizadas: 0, canceladas: 0, backlog: 0 }
    const motivos = new Map<string, number>()
    const excluidas = new Map<string, number>()
    let registros = 0
    let sinEstado = 0
    let cierresSinFecha = 0
    for (let offset = 0; ; offset += LOTE) {
      const { data, error } = await admin.from('reporte_fija')
        .select('id,sds,promo,fecha_carga,fecha_instalacion,estado_agenda,motivo_cierre')
        .eq('negocio', 'IF').order('id').range(offset, offset + LOTE - 1)
      if (error) throw error
      for (const fila of data ?? []) {
        const promo = norm(fila.promo)
        const sufijo = norm(fila.sds).slice(-3)
        if (!(promos2.has(promo) && sufijo === 'FAE') &&
            !(promos3.has(promo) && sufijo === 'TAE')) {
          const clave = (promo || 'SIN PROMO') + ' / ' + (sufijo || 'SIN SDS')
          excluidas.set(clave, (excluidas.get(clave) ?? 0) + 1)
          continue
        }
        registros++
        const estado = norm(fila.estado_agenda)
        if (!estado) sinEstado++
        if (String(fila.fecha_carga ?? '').slice(0, 7) === periodo) totales.preventas_ok++
        if (estado === 'ASIGNADA') totales.backlog++
        if (estado === 'FINALIZADA' || estado === 'CANCELADA') {
          if (!fila.fecha_instalacion) cierresSinFecha++
          if (String(fila.fecha_instalacion ?? '').slice(0, 7) !== periodo) continue
          if (estado === 'FINALIZADA') totales.finalizadas++
          else {
            totales.canceladas++
            const motivo = norm(fila.motivo_cierre) || 'SIN MOTIVO'
            motivos.set(motivo, (motivos.get(motivo) ?? 0) + 1)
          }
        }
      }
      if (!data || data.length < LOTE) break
    }
    const cierres = totales.finalizadas + totales.canceladas
    return NextResponse.json({
      periodo,
      // Datos de diagnóstico, no constituyen un cierre mensual oficial.
      provisional: true,
      fija: {
        ...totales,
        porcentaje_canceladas: cierres ? Math.round(10000 * totales.canceladas / cierres) / 100 : null,
      },
      historico: historico.data ?? [],
      motivos: [...motivos].map(([motivo, cantidad]) => ({ motivo, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad || a.motivo.localeCompare(b.motivo)),
      control: {
        registros, sin_estado: sinEstado, cierres_sin_fecha: cierresSinFecha,
        excluidas: [...excluidas].map(([clasificacion, cantidad]) => ({ clasificacion, cantidad })),
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Dashboard Gestión BAF', error)
    return NextResponse.json({ error: 'No se pudieron consultar los indicadores de Gestión BAF.' }, { status: 500 })
  }
}
