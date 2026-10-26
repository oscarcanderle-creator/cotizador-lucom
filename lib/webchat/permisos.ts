export type PerfilChat = {
  id: string
  nombre: string | null
  vendedor: string | null
  rol: string
  activo: boolean
  puede_gestionar_ventas: boolean | null
}

export function esGestor(perfil: PerfilChat): boolean {
  return (
    perfil.rol === 'VENDEDOR' &&
    perfil.puede_gestionar_ventas === true
  )
}

export function puedeContactar(
  origen: PerfilChat,
  destino: PerfilChat
): boolean {
  if (!origen.activo || !destino.activo) return false
  if (origen.id === destino.id) return false

  const origenPrivilegiado =
    origen.rol === 'ADMIN' ||
    origen.rol === 'SUPERVISOR' ||
    origen.rol === 'BBOO' ||
    esGestor(origen)

  const destinoHabilitado =
    destino.rol === 'SUPERVISOR' ||
    destino.rol === 'BBOO' ||
    esGestor(destino)

  return origenPrivilegiado || destinoHabilitado
}
