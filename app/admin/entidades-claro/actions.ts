'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../../utils/supabase/server'

export async function crearEntidadClaro(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      mensaje: 'La sesión ha expirado.'
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, activo')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.activo || profile.rol !== 'ADMIN') {
    return {
      ok: false,
      mensaje: 'No tenés permisos para realizar esta operación.'
    }
  }

  const campo = (nombre: string) =>
    String(formData.get(nombre) ?? '').trim()

  const { data, error } = await supabase.rpc(
    'crear_entidad_claro',
    {
      p_nombre: campo('nombre'),
      p_tipo: campo('tipo'),
      p_dni: campo('dni') || null,
      p_profile_id: campo('profile_id') || null,
      p_codigo: campo('codigo'),
      p_pos: campo('pos') || null,
      p_fecha_alta: campo('fecha_alta') || null,
      p_observaciones: campo('observaciones') || null,
    }
  )

  if (error) {
    return {
      ok: false,
      mensaje: error.code === '23505'
        ? 'La entidad o el usuario PGL ya se encuentra registrado.'
        : error.message
    }
  }

  revalidatePath('/admin/entidades-claro')

  return {
    ok: true,
    id: data,
    mensaje: 'Entidad Claro creada correctamente.'
  }
}

export async function editarEntidadClaro(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      mensaje: 'La sesión ha expirado.'
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, activo')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.activo || profile.rol !== 'ADMIN') {
    return {
      ok: false,
      mensaje: 'No tenés permisos para realizar esta operación.'
    }
  }

  const campo = (nombre: string) =>
    String(formData.get(nombre) ?? '').trim()

  const { data, error } = await supabase.rpc(
    'editar_entidad_claro',
    {
      p_entidad_id: campo('entidad_id'),
      p_nombre: campo('nombre'),
      p_tipo: campo('tipo'),
      p_dni: campo('dni') || null,
      p_profile_id: campo('profile_id') || null,
      p_fecha_alta: campo('fecha_alta') || null,
      p_observaciones: campo('observaciones') || null,
    }
  )

  if (error) {
    return {
      ok: false,
      mensaje: error.code === '23505'
        ? 'El DNI o el usuario PGL ya se encuentra asociado a otro registro.'
        : error.message
    }
  }

  revalidatePath('/admin/entidades-claro')

  return {
    ok: true,
    id: data,
    mensaje: 'Entidad Claro actualizada correctamente.'
  }
}

export async function darBajaEntidadClaro(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, mensaje: 'La sesión ha expirado.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, activo')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.activo || profile.rol !== 'ADMIN') {
    return { ok: false, mensaje: 'No tenés permisos para realizar esta operación.' }
  }

  const entidadId = String(formData.get('entidad_id') ?? '').trim()
  const fecha = String(formData.get('fecha') ?? '').trim()
  const motivo = String(formData.get('motivo') ?? '').trim()

  if (!entidadId || !fecha || !motivo) {
    return { ok: false, mensaje: 'Completá la fecha y el motivo de baja.' }
  }

  const { error } = await supabase.rpc('dar_baja_entidad_claro', {
    p_entidad_id: entidadId,
    p_fecha_baja: fecha,
    p_motivo: motivo,
  })

  if (error) {
    return { ok: false, mensaje: error.message }
  }

  revalidatePath('/admin/entidades-claro')
  return { ok: true, mensaje: 'Entidad Claro y códigos activos dados de baja correctamente.' }
}

export async function reactivarEntidadClaro(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, mensaje: 'La sesión ha expirado.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, activo')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.activo || profile.rol !== 'ADMIN') {
    return { ok: false, mensaje: 'No tenés permisos para realizar esta operación.' }
  }

  const entidadId = String(formData.get('entidad_id') ?? '').trim()
  const fecha = String(formData.get('fecha') ?? '').trim()
  const motivo = String(formData.get('motivo') ?? '').trim()
  const codigosIds = formData.getAll('codigos_ids')
    .filter((valor): valor is string => typeof valor === 'string' && valor.length > 0)

  if (!entidadId || !fecha || !motivo || codigosIds.length === 0) {
    return {
      ok: false,
      mensaje: 'Indicá fecha, motivo y al menos un código a reactivar.'
    }
  }

  const { error } = await supabase.rpc('reactivar_entidad_claro', {
    p_entidad_id: entidadId,
    p_fecha_reactivacion: fecha,
    p_motivo: motivo,
    p_codigos_ids: codigosIds,
  })

  if (error) {
    return { ok: false, mensaje: error.message }
  }

  revalidatePath('/admin/entidades-claro')
  return { ok: true, mensaje: 'Entidad Claro reactivada con los códigos seleccionados.' }
}

export async function gestionarCodigoClaro(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, mensaje: 'La sesión ha expirado.' }

  const { data: profile } = await supabase.from('profiles')
    .select('rol, activo').eq('id', user.id).single()
  if (!profile?.activo || profile.rol !== 'ADMIN') {
    return { ok: false, mensaje: 'No tenés permisos para realizar esta operación.' }
  }

  const campo = (nombre: string) => String(formData.get(nombre) ?? '').trim()
  const accion = campo('accion')
  const fecha = campo('fecha')
  const motivo = campo('motivo')
  const entidadId = campo('entidad_id')
  const codigoId = campo('codigo_id')
  if (!fecha || !motivo || !entidadId || !['alta', 'baja', 'reactivar'].includes(accion)) {
    return { ok: false, mensaje: 'Completá los datos requeridos.' }
  }

  const { data: entidad, error: errorEntidad } = await supabase.from('entidades_claro')
    .select('id, tipo, activo, punto_venta_id, asesor_pdv_id').eq('id', entidadId).single()
  if (errorEntidad || !entidad?.activo || entidad.tipo === 'PDV' || entidad.punto_venta_id || entidad.asesor_pdv_id) {
    return { ok: false, mensaje: 'El titular no está habilitado para administrar códigos.' }
  }

  if (accion !== 'alta') {
    const { data: codigo, error } = await supabase.from('entidades_claro_codigos')
      .select('id, activo').eq('id', codigoId).eq('entidad_id', entidadId).single()
    if (error || !codigo || codigo.activo !== (accion === 'baja')) {
      return { ok: false, mensaje: 'El código no corresponde al titular o cambió de estado.' }
    }
  }

  const tipo = campo('tipo_codigo')
  const codigo = campo('codigo').toUpperCase()
  if (accion === 'alta' && (!['IDENTITY', 'POS_1175'].includes(tipo) || !codigo ||
    (tipo === 'IDENTITY' && !/^(AGE|AGET|AGEP)[0-9]+$/.test(codigo)) ||
    (tipo === 'POS_1175' && !/^[0-9]+$/.test(codigo)))) {
    return { ok: false, mensaje: 'Indicá un tipo y código válidos.' }
  }

  const resultado = accion === 'alta'
    ? await supabase.rpc('agregar_codigo_claro', {
        p_entidad_id: entidadId, p_tipo_codigo: tipo, p_codigo: codigo,
        p_fecha_alta: fecha, p_motivo: motivo,
      })
    : accion === 'baja'
      ? await supabase.rpc('dar_baja_codigo_claro', {
          p_codigo_id: codigoId, p_fecha_baja: fecha, p_motivo: motivo,
        })
      : await supabase.rpc('reactivar_codigo_claro', {
          p_codigo_id: codigoId, p_fecha_reactivacion: fecha, p_motivo: motivo,
        })

  if (resultado.error) return { ok: false, mensaje: resultado.error.message }
  revalidatePath('/admin/entidades-claro')
  return { ok: true, mensaje: 'Código actualizado correctamente.' }
}
