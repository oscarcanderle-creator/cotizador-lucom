'use server'

import { createClient } from '../../utils/supabase/server'
import { createAdminClient } from '../../utils/supabase/admin'

type TipoDocumento = 'DNI' | 'LC' | 'LE' | 'CUIT'

export async function buscarClientePorDocumento(
  tipoDocumento: string,
  numeroDocumento: string
) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: errorAuth } =
      await supabase.auth.getUser()

    if (errorAuth || !user) {
      return {
        ok: false,
        mensaje: 'La sesión expiró. Volvé a iniciar sesión.'
      }
    }

    const { data: perfil, error: errorPerfil } = await supabase
      .from('profiles')
      .select('activo')
      .eq('id', user.id)
      .single()

    if (errorPerfil || !perfil?.activo) {
      return {
        ok: false,
        mensaje: 'El usuario no está habilitado.'
      }
    }

    const tipo = tipoDocumento.trim().toUpperCase() as TipoDocumento
    const numero = numeroDocumento.replace(/\D/g, '')

    if (!['DNI', 'LC', 'LE', 'CUIT'].includes(tipo)) {
      return {
        ok: false,
        mensaje: 'Seleccioná un tipo de documento válido.'
      }
    }

    if (
      !numero ||
      (tipo === 'CUIT' && numero.length !== 11) ||
      (tipo !== 'CUIT' && (numero.length < 5 || numero.length > 8))
    ) {
      return {
        ok: false,
        mensaje: 'Ingresá un número de documento válido.'
      }
    }

    const admin = createAdminClient()

    const { data: cliente, error: errorCliente } = await admin
      .from('clientes')
      .select(
        'id,tipo_documento,dni,nombre,apellido,fecha_nacimiento,email,telefono,telefono_alternativo'
      )
      .eq('tipo_documento', tipo)
      .eq('dni', numero)
      .maybeSingle()

    if (errorCliente) throw errorCliente

    if (!cliente) {
      return {
        ok: true,
        encontrado: false,
        mensaje: 'No encontramos antecedentes. Podés registrar un cliente nuevo.',
        cliente: null,
        domicilios: [],
        operaciones: []
      }
    }

    const [
      { data: domicilios, error: errorDomicilios },
      { data: operaciones, error: errorOperaciones }
    ] = await Promise.all([
      admin
        .from('domicilios')
        .select(
          'id,calle_nro,piso,dpto,entre_calles,barrio,localidad,coordenadas,datos_extras,created_at'
        )
        .eq('cliente_id', cliente.id)
        .order('created_at', { ascending: false }),

      admin
        .from('operaciones')
        .select(
          'id_operacion,fecha_hora,vendedor,origen_dato,domicilio_id,operacion_productos(id,tipo_producto,producto_snapshot,plan_snapshot,gestion_producto_baf(estado_claro,motivo_estado,fecha_gestion,fecha_cierre,estados_baf(codigo,nombre)),gestion_producto_movil(fecha_carga_stl,fecha_porta,estados_porta(codigo,nombre),estados_bboo(codigo,nombre)))'
        )
        .eq('cliente_id', cliente.id)
        .order('fecha_hora', { ascending: false })
        .limit(10)
    ])

    if (errorDomicilios) throw errorDomicilios
    if (errorOperaciones) throw errorOperaciones

    // Relacionar cada operación con el domicilio que tenía registrado.
    const domiciliosPorId = new Map(
      (domicilios ?? []).map(d => [d.id, d])
    )

    const idsHistoricos = (operaciones ?? [])
      .map(op => op.id_operacion)
      .filter(id => id.startsWith('HIST-'))

    const estadosHistoricos = new Map<string, string>()

    if (idsHistoricos.length > 0) {
      const { data: historicos, error: errorHistoricos } = await admin
        .from('migracion_historica_registros')
        .select('operacion_id,estado_original')
        .in('operacion_id', idsHistoricos)

      if (errorHistoricos) throw errorHistoricos

      for (const registro of historicos ?? []) {
        if (registro.operacion_id && registro.estado_original?.trim()) {
          estadosHistoricos.set(
            registro.operacion_id,
            registro.estado_original.trim()
          )
        }
      }
    }

    const operacionesConDomicilio = (operaciones ?? []).map(op => ({
      ...op,
      domicilio_venta: domiciliosPorId.get(op.domicilio_id) ?? null,
      estado_historico: estadosHistoricos.get(op.id_operacion) ?? null
    }))

    return {
      ok: true,
      encontrado: true,
      mensaje: 'Cliente encontrado.',
      cliente,
      domicilios: domicilios ?? [],
      operaciones: operacionesConDomicilio
    }

  } catch (error) {
    console.error('Error buscando cliente:', error)

    return {
      ok: false,
      mensaje: 'No se pudo consultar el cliente. Intentá nuevamente.'
    }
  }
}
