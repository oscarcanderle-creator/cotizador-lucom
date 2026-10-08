import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createClient } from '../../../../utils/supabase/server'
import { createAdminClient } from '../../../../utils/supabase/admin'

export const runtime = 'nodejs'
const MODALIDADES = ['TITULAR', 'TERCERO', 'BUZON', 'BAJO_PUERTA', 'CASILLA_GAS', 'COMERCIO']
const MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const MAX_FOTO = 8 * 1024 * 1024

function fallo(mensaje: string, status = 400) { return NextResponse.json({ error: mensaje }, { status }) }
function numero(form: FormData, nombre: string) { return Number(form.get(nombre)) }

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return fallo('Sesión no válida.', 401)
    const { data: perfil, error: errorPerfil } = await supabase.from('profiles').select('rol, activo').eq('id', user.id).single()
    if (errorPerfil || !perfil?.activo || !['CADETERIA', 'TERRENO'].includes(perfil.rol)) return fallo('No tenés permisos para registrar entregas.', 403)

    const form = await request.formData()
    const intentoId = numero(form, 'intentoId')
    const resultado = String(form.get('resultado') ?? '').trim().toUpperCase()
    const modalidad = String(form.get('modalidad') ?? '').trim().toUpperCase()
    const referencia = String(form.get('referencia') ?? '').trim()
    const observacion = String(form.get('observacion') ?? '').trim()
    const motivoId = numero(form, 'motivoNoEntregaId')
    const latitud = numero(form, 'latitud')
    const longitud = numero(form, 'longitud')
    const precision = numero(form, 'precision')
    const fechaGps = String(form.get('fechaGps') ?? '')
    const foto = form.get('foto')

    if (!Number.isSafeInteger(intentoId) || intentoId <= 0) return fallo('Intento inválido.')
    if (!['ENTREGADO', 'NO_ENTREGADO'].includes(resultado)) return fallo('Resultado inválido.')
    if (!Number.isFinite(latitud) || latitud < -90 || latitud > 90 || !Number.isFinite(longitud) || longitud < -180 || longitud > 180 || !Number.isFinite(precision) || precision <= 0 || precision > 100000) return fallo('Ubicación GPS inválida.')
    const tiempoGps = Date.parse(fechaGps)
    if (!Number.isFinite(tiempoGps) || Math.abs(Date.now() - tiempoGps) > 120000) return fallo('La ubicación GPS no es reciente. Volvé a confirmar.')
    if (resultado === 'ENTREGADO' && !MODALIDADES.includes(modalidad)) return fallo('Seleccioná una modalidad de entrega.')
    if (resultado === 'NO_ENTREGADO' && (!Number.isSafeInteger(motivoId) || motivoId <= 0)) return fallo('Seleccioná el motivo de no entrega.')
    if (resultado === 'ENTREGADO' && ['TERCERO', 'COMERCIO'].includes(modalidad) && !referencia) return fallo('Indicá quién recibió el chip.')
    if (resultado === 'ENTREGADO' && modalidad === 'COMERCIO') return fallo('La entrega en comercio requiere validar la autorización registrada en la venta. Esta modalidad estará disponible cuando se integre esa comprobación.')
    if (observacion.length > 2000 || referencia.length > 300) return fallo('Las observaciones son demasiado extensas.')

    const archivo = foto instanceof File ? foto : null
    if (resultado === 'ENTREGADO' && !archivo) return fallo('La fotografía es obligatoria.')
    if (archivo && (archivo.size === 0 || archivo.size > MAX_FOTO || !MIME.includes(archivo.type))) return fallo('La fotografía debe ser JPG, PNG, WEBP o HEIC, de hasta 8 MB.')

    // La RPC existente es la fuente de verdad sobre los intentos asignados al usuario.
    const { data: asignadas, error: errorAsignadas } = await supabase.rpc('obtener_entregas_cadeteria')
    if (errorAsignadas) return fallo('No se pudo comprobar la asignación de la entrega.', 503)
    const asignada = (asignadas ?? []).some((fila: { intento_id?: number | string }) => Number(fila.intento_id) === intentoId)
    if (!asignada) return fallo('La entrega no está asignada a tu usuario o ya no está en distribución.', 403)

    const admin = createAdminClient()
    const { data: intento, error: errorIntento } = await admin.from('lote_despacho_gestiones').select('id, resultado').eq('id', intentoId).single()
    if (errorIntento || !intento || intento.resultado) return fallo('El intento ya fue resuelto o no existe.', 409)

    // Si el cierre anterior falló después de guardar la evidencia, permitir
    // reintentar la misma RPC sin subir otra foto ni duplicar la evidencia.
    const { data: evidenciaAnterior, error: errorConsultaEvidencia } = await admin.from('evidencias_entrega')
      .select('intento_id, resultado, capturado_por').eq('intento_id', intentoId).maybeSingle()
    if (errorConsultaEvidencia) return fallo('No se pudo verificar la evidencia anterior.', 503)
    if (evidenciaAnterior && (evidenciaAnterior.capturado_por !== user.id || evidenciaAnterior.resultado !== resultado)) {
      return fallo('El intento ya tiene una evidencia diferente registrada. Solicitá revisión de Logística.', 409)
    }

    let rutaFoto: string | null = null
    if (!evidenciaAnterior && archivo) {
      const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' } as Record<string, string>)[archivo.type]
      rutaFoto = `${intentoId}/${randomUUID()}.${ext}`
      const { error: errorFoto } = await admin.storage.from('evidencias-entrega').upload(rutaFoto, archivo, { contentType: archivo.type, upsert: false })
      if (errorFoto) return fallo('No se pudo almacenar la fotografía de forma privada.', 503)
    }

    const { error: errorEvidencia } = evidenciaAnterior ? { error: null } : await admin.from('evidencias_entrega').insert({
      intento_id: intentoId,
      resultado,
      modalidad: resultado === 'ENTREGADO' ? modalidad : null,
      referencia: referencia || null,
      observacion: observacion || null,
      latitud,
      longitud,
      precision_metros: precision,
      fecha_gps_dispositivo: fechaGps,
      foto_path: rutaFoto,
      capturado_por: user.id,
    })
    if (errorEvidencia) {
      if (rutaFoto) await admin.storage.from('evidencias-entrega').remove([rutaFoto])
      return fallo('No se pudo guardar la evidencia. Es posible que el intento ya tenga una evidencia registrada: ' + errorEvidencia.message, 409)
    }

    // Conservar la RPC operativa actual: actualiza estados, motivos e historial.
    // La migración incorpora un trigger que impide cerrar sin evidencia.
    const { data, error: errorResultado } = await supabase.rpc('registrar_resultado_entrega', {
      p_lote_despacho_gestion_id: intentoId,
      p_resultado: resultado,
      p_fecha_resultado: new Date().toISOString(),
      p_motivo_no_entrega_id: resultado === 'NO_ENTREGADO' ? motivoId : null,
      p_observacion_cadete: resultado === 'NO_ENTREGADO' ? observacion || null : null,
    })
    if (errorResultado) {
      // Mantener la evidencia si la RPC falla, para que no se pierda el comprobante.
      // Un supervisor podrá revisar el intento pendiente; no informar cierre exitoso.
      return fallo('Se guardó la evidencia, pero NO se cerró la entrega: ' + errorResultado.message, 409)
    }
    return NextResponse.json({ ok: true, resultado: data })
  } catch (error) {
    console.error('Error al registrar resultado y evidencia de Cadetería:', error)
    return fallo('No se pudo registrar el resultado. Revisá la conexión e intentá nuevamente.', 500)
  }
}
