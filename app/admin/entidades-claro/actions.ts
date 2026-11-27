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
