function normalizar(valor: unknown) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

export async function validarSimGestion(
  admin: any,
  simOriginal: unknown,
  productoOperacionId: number
) {
  const sim = String(simOriginal ?? '').trim().toUpperCase()

  // Vacío continúa permitido.
  if (!sim) return { ok: true as const, sim: null }

  // ESIM es un valor operativo válido y no participa de unicidad.
  if (sim === 'ESIM') {
    return { ok: true as const, sim: 'ESIM' }
  }

  // SIM física: ICCID de exactamente 19 dígitos.
  if (!/^\d{19}$/.test(sim)) {
    return {
      ok: false as const,
      error: 'SIM debe ser ESIM o contener exactamente 19 dígitos numéricos.',
    }
  }

  // Buscar la misma SIM en otras gestiones.
  const { data: usos, error: usosError } = await admin
    .from('gestion_producto_movil')
    .select('producto_operacion_id,estado_bboo_id')
    .eq('sim', sim)
    .neq('producto_operacion_id', productoOperacionId)

  if (usosError) throw usosError
  if (!(usos ?? []).length) return { ok: true as const, sim }

  const estadoIds = Array.from(
    new Set(
      (usos ?? [])
        .map((x: any) => Number(x.estado_bboo_id))
        .filter(Boolean)
    )
  )

  const mapaEstados = new Map<number, string>()

  if (estadoIds.length) {
    const { data: estados, error: estadosError } = await admin
      .from('estados_bboo')
      .select('id,nombre,codigo')
      .in('id', estadoIds)

    if (estadosError) throw estadosError

    for (const e of estados ?? []) {
      mapaEstados.set(
        Number(e.id),
        normalizar(e.nombre || e.codigo)
      )
    }
  }

  // Solamente CANCELADO libera expresamente la SIM.
  // Sin Estado BBOO también se considera ocupada.
  const ocupada = (usos ?? []).some((uso: any) => {
    const estado = mapaEstados.get(Number(uso.estado_bboo_id)) ?? ''
    return estado !== 'CANCELADO'
  })

  if (ocupada) {
    return {
      ok: false as const,
      error: `La SIM ${sim} ya está asignada a otra venta cuyo Estado BBOO no es CANCELADO.`,
    }
  }

  return { ok: true as const, sim }
}
