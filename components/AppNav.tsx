import Link from 'next/link'

type Actual =
  | 'VENTAS'
  | 'MIS_VENTAS'
  | 'MIS_CONSULTAS'
  | 'COTIZADOR'
  | 'GESTION_VENTAS'
  | 'SUPER'
  | 'ADMIN'

type Props = {
  rol: string
  actual?: Actual
  variante?: 'rojo' | 'claro'
  puedeGestionarVentas?: boolean
}

const items = [
  { key: 'VENTAS', label: 'Ventas', href: '/ventas', roles: ['VENDEDOR', 'SUPERVISOR', 'ADMIN'] },
  { key: 'MIS_VENTAS', label: 'Mis Ventas', href: '/mis-ventas', roles: ['VENDEDOR', 'SUPERVISOR', 'ADMIN'] },
  { key: 'MIS_CONSULTAS', label: 'Mis Consultas', href: '/mis-consultas', roles: ['VENDEDOR', 'SUPERVISOR', 'ADMIN'] },
  { key: 'COTIZADOR', label: 'Cotizador', href: '/cotizador', roles: ['VENDEDOR', 'SUPERVISOR', 'ADMIN'] },
  { key: 'GESTION_VENTAS', label: 'Gestión de Ventas', href: '/gestion-ventas', roles: ['VENDEDOR'] },
  { key: 'SUPER', label: 'Super', href: '/super', roles: ['SUPERVISOR', 'ADMIN'] },
  { key: 'ADMIN', label: 'Admin', href: '/admin', roles: ['ADMIN'] },
] as const

export default function AppNav({
  rol,
  actual,
  variante = 'rojo',
  puedeGestionarVentas = false,
}: Props) {
  const visibles = items.filter((item) => {
    const rolPermitido = item.roles.some((permitido) => permitido === rol)
    if (!rolPermitido) return false

    if (item.key === 'GESTION_VENTAS') {
      return rol === 'VENDEDOR' && puedeGestionarVentas
    }

    return true
  })

  return (
    <nav aria-label="Navegación principal" className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
      {visibles.map((item) => {
        const activo = actual === item.key
        const clases = variante === 'rojo'
          ? activo
            ? 'rounded-lg bg-white px-2.5 py-1.5 text-[11px] sm:text-xs font-bold text-red-600'
            : 'rounded-lg px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold text-red-100 hover:bg-white/10 hover:text-white'
          : activo
            ? 'rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700'
            : 'rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900'

        return (
          <Link key={item.key} href={item.href} className={clases}>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
