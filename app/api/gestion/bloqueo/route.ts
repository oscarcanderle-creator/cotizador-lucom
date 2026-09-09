import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../utils/supabase/admin'
import { createClient } from '../../../../utils/supabase/server'

export const runtime = 'nodejs'

type Accion = 'ADQUIRIR' | 'RENOVAR' | 'LIBERAR'

export async function POST(request: Request) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 })

  const { data: profile } = await admin
    .from('profiles')
    .select('rol,activo,puede_gestionar_ventas')
    .eq('id', user.id)
    .maybeSingle()

  const autorizado = profile?.activo === true && (
    profile?.rol === 'ADMIN' ||
    profile?.rol === 'SUPERVISOR' ||
    profile?.rol === 'BBOO' ||
    (profile?.rol === 'VENDEDOR' && profile?.puede_gestionar_ventas === true)
  )

  if (!autorizado) return NextResponse.json({ error: 'No tiene permisos para gestionar ventas.' }, { status: 403 })

  let body: any
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const accion = String(body?.accion ?? '').toUpperCase() as Accion
  const tipoRecurso = String(body?.tipo_recurso ?? '').toUpperCase()
  const recursoClave = String(body?.recurso_clave ?? '').trim()
  const sesionToken = String(body?.sesion_token ?? '').trim()

  if (!['ADQUIRIR', 'RENOVAR', 'LIBERAR'].includes(accion) || tipoRecurso !== 'VENTA' || !recursoClave || !sesionToken) {
    return NextResponse.json({ error: 'Parámetros de bloqueo inválidos.' }, { status: 400 })
  }

  const funcion = accion === 'ADQUIRIR'
    ? 'adquirir_bloqueo_gestion'
    : accion === 'RENOVAR'
      ? 'renovar_bloqueo_gestion'
      : 'liberar_bloqueo_gestion'

  const parametros: any = {
    p_tipo_recurso: tipoRecurso,
    p_recurso_clave: recursoClave,
    p_sesion_token: sesionToken,
  }
  if (accion === 'LIBERAR') parametros.p_motivo = String(body?.motivo ?? 'CANCELADO')

  const { data, error } = await supabase.rpc(funcion, parametros)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // La autoasignación es opt-in y se usa exclusivamente desde Gestión de Ventas.
  // SUPER/ADMIN conservan sus mecanismos manuales de asignación/reasignación.
  const autoAsignar = body?.autoasignar_gestion === true
  const adquirido = accion === 'ADQUIRIR' && data?.adquirido === true

  if (autoAsignar && adquirido && (profile?.rol === 'BBOO' || profile?.rol === 'VENDEDOR')) {
    const liberarPorError = async () => {
      await supabase.rpc('liberar_bloqueo_gestion', {
        p_tipo_recurso: tipoRecurso,
        p_recurso_clave: recursoClave,
        p_sesion_token: sesionToken,
        p_motivo: 'ERROR_AUTOASIGNACION',
      })
    }

    const { data: operacion } = await admin
      .from('operaciones')
      .select('id_operacion,tipo,grupo_operacion')
      .or(`id_operacion.eq.${recursoClave},grupo_operacion.eq.${recursoClave}`)
      .limit(1)
      .maybeSingle()

    if (!operacion) {
      await liberarPorError()
      return NextResponse.json({ error: 'No se encontró la venta para realizar la autoasignación.' }, { status: 404 })
    }

    const operacionId = String(operacion.id_operacion)

    // Nueva arquitectura: responsabilidad por producto.
    const { data: productos, error: productosError } = await admin
      .from('operacion_productos')
      .select('id,tipo_producto,responsable_id')
      .eq('operacion_id', operacionId)
      .eq('activo', true)

    if (productosError) {
      await liberarPorError()
      return NextResponse.json({ error: productosError.message }, { status: 400 })
    }

    if ((productos ?? []).length > 0) {
      if (profile.rol === 'VENDEDOR') {
        const ajenos = (productos ?? []).filter(
          (p: any) => p.responsable_id && p.responsable_id !== user.id
        )
        if (ajenos.length > 0) {
          await liberarPorError()
          return NextResponse.json(
            { error: 'La venta ya tiene uno o más productos asignados a otro Responsable.' },
            { status: 409 }
          )
        }

        const sinAsignar = (productos ?? []).filter((p: any) => !p.responsable_id)
        if (sinAsignar.length > 0) {
          const ids = sinAsignar.map((p: any) => Number(p.id))
          const ahora = new Date().toISOString()

          const { error: asignacionError } = await admin
            .from('operacion_productos')
            .update({ responsable_id: user.id, updated_at: ahora, updated_by: user.id })
            .in('id', ids)

          if (asignacionError) {
            await liberarPorError()
            return NextResponse.json({ error: asignacionError.message }, { status: 400 })
          }

          const { error: historialError } = await admin.from('historial_producto').insert(
            ids.map((id: number) => ({
              producto_operacion_id: id,
              tipo_accion: 'MODIFICACION',
              campo: 'Responsable',
              etiqueta: 'Responsable',
              valor_anterior: '—',
              valor_nuevo: user.id,
              usuario_id: user.id,
              rol_actor: 'VENDEDOR',
            }))
          )
          if (historialError) console.error('Autoasignación realizada sin historial_producto:', historialError)
        }
      } else {
        // BBOO no modifica Responsable comercial. Se identifica como BBOO en cada móvil.
        const moviles = (productos ?? []).filter((p: any) =>
          ['PORTA', 'LINEA_NUEVA'].includes(String(p.tipo_producto ?? '').toUpperCase())
        )

        for (const producto of moviles) {
          const { data: gestion, error: gestionError } = await admin
            .from('gestion_producto_movil')
            .select('id,bboo_id')
            .eq('producto_operacion_id', Number(producto.id))
            .maybeSingle()

          if (gestionError) {
            await liberarPorError()
            return NextResponse.json({ error: gestionError.message }, { status: 400 })
          }

          if (gestion?.bboo_id && gestion.bboo_id !== user.id) {
            await liberarPorError()
            return NextResponse.json(
              { error: 'Uno de los productos móviles ya está asignado a otro usuario BBOO.' },
              { status: 409 }
            )
          }

          if (!gestion?.bboo_id) {
            const ahora = new Date().toISOString()
            const resultado = gestion?.id
              ? await admin.from('gestion_producto_movil')
                  .update({ bboo_id: user.id, updated_at: ahora, updated_by: user.id })
                  .eq('producto_operacion_id', Number(producto.id))
              : await admin.from('gestion_producto_movil')
                  .insert({
                    producto_operacion_id: Number(producto.id),
                    bboo_id: user.id,
                    updated_at: ahora,
                    updated_by: user.id,
                  })

            if (resultado.error) {
              await liberarPorError()
              return NextResponse.json({ error: resultado.error.message }, { status: 400 })
            }

            const { error: historialError } = await admin.from('historial_producto').insert({
              producto_operacion_id: Number(producto.id),
              tipo_accion: 'MODIFICACION',
              campo: 'BBOO',
              etiqueta: 'BBOO',
              valor_anterior: '—',
              valor_nuevo: user.id,
              usuario_id: user.id,
              rol_actor: 'BBOO',
            })
            if (historialError) console.error('Autoasignación BBOO realizada sin historial_producto:', historialError)
          }
        }
      }
    } else {
      // Compatibilidad con ventas históricas.
      const idsObjetivo: string[] = []
      if (operacion.tipo === 'PORTA' && operacion.grupo_operacion) {
        const { data: grupo } = await admin
          .from('operaciones')
          .select('id_operacion')
          .eq('grupo_operacion', operacion.grupo_operacion)
        idsObjetivo.push(...(grupo ?? []).map((x: any) => String(x.id_operacion)))
      } else {
        idsObjetivo.push(operacionId)
      }

      if (profile.rol === 'VENDEDOR') {
        for (const idObjetivo of idsObjetivo) {
          const { error: asignacionError } = await supabase.rpc('gestor_asignar_responsable_venta', {
            p_operacion_id: idObjetivo,
            p_responsable_id: user.id,
          })
          if (asignacionError) {
            await liberarPorError()
            return NextResponse.json({ error: asignacionError.message }, { status: 400 })
          }
        }
      } else if (operacion.tipo === 'PORTA') {
        // Flujo histórico PORTA/LN: BBOO se autoasigna al tomar la gestión.
        // Si gestion_porta todavía no existe, se crea; un UPDATE sobre 0 filas
        // no debe considerarse una asignación exitosa.
        for (const idObjetivo of idsObjetivo) {
          const { data: gestion, error: gestionError } = await admin
            .from('gestion_porta')
            .select('id,bboo_id')
            .eq('operacion_id', idObjetivo)
            .maybeSingle()

          if (gestionError) {
            await liberarPorError()
            return NextResponse.json({ error: gestionError.message }, { status: 400 })
          }

          if (gestion?.bboo_id && gestion.bboo_id !== user.id) {
            await liberarPorError()
            return NextResponse.json(
              { error: 'La venta ya está asignada a otro usuario BBOO.' },
              { status: 409 }
            )
          }

          if (!gestion?.bboo_id) {
            const ahora = new Date().toISOString()

            const resultado = gestion?.id
              ? await admin
                  .from('gestion_porta')
                  .update({
                    bboo_id: user.id,
                    updated_by: user.id,
                    updated_at: ahora,
                  })
                  .eq('operacion_id', idObjetivo)
              : await admin
                  .from('gestion_porta')
                  .insert({
                    operacion_id: idObjetivo,
                    bboo_id: user.id,
                    updated_by: user.id,
                    updated_at: ahora,
                  })

            if (resultado.error) {
              await liberarPorError()
              return NextResponse.json({ error: resultado.error.message }, { status: 400 })
            }
          }
        }
      }
    }
  }

  return NextResponse.json(data ?? { ok: true })
}
