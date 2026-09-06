'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import CerrarSesion from '../app/CerrarSesion'

type Actual =
  | 'VENTAS'
  | 'MIS_VENTAS'
  | 'MIS_CONSULTAS'
  | 'COTIZADOR'
  | 'GESTION_VENTAS'
  | 'SUPER'
  | 'ADMIN'
  | 'PORTAL'

type Props = {
  rol: string
  actual?: Actual
  variante?: 'rojo' | 'claro'
  puedeGestionarVentas?: boolean
  modo?: 'desktop' | 'mobile-trigger'
}

const items = [
  { key: 'VENTAS', label: 'Ventas', href: '/ventas', roles: ['VENDEDOR', 'SUPERVISOR', 'ADMIN', 'BBOO'] },
  { key: 'MIS_VENTAS', label: 'Mis Ventas', href: '/mis-ventas', roles: ['VENDEDOR', 'SUPERVISOR', 'ADMIN', 'BBOO'] },
  { key: 'MIS_CONSULTAS', label: 'Mis Consultas', href: '/mis-consultas', roles: ['VENDEDOR', 'SUPERVISOR', 'ADMIN'] },
  { key: 'COTIZADOR', label: 'Cotizador', href: '/cotizador', roles: ['VENDEDOR', 'SUPERVISOR', 'ADMIN', 'BBOO'] },
  { key: 'PORTAL', label: 'Portal', href: '/portal', roles: ['VENDEDOR', 'SUPERVISOR', 'ADMIN', 'BBOO', 'TERRENO'] },
  { key: 'GESTION_VENTAS', label: 'Gestión de Ventas', href: '/gestion-ventas', roles: ['VENDEDOR', 'BBOO'] },
  { key: 'SUPER', label: 'SUPER', href: '/super', roles: ['SUPERVISOR', 'ADMIN'] },
  { key: 'ADMIN', label: 'ADMIN', href: '/admin', roles: ['ADMIN'] },
] as const

function Icono({ tipo }: { tipo: Actual }) {
  const base = 'h-[18px] w-[18px] shrink-0'
  if (tipo === 'VENTAS') return <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/></svg>
  if (tipo === 'MIS_VENTAS') return <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>
  if (tipo === 'MIS_CONSULTAS') return <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5h16v12H9l-5 4V5Z"/><path d="M8 9h8M8 13h5"/></svg>
  if (tipo === 'COTIZADOR') return <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 10h2M12 10h2M16 10h1M8 14h2M12 14h2M16 14h1M8 18h2M12 18h5"/></svg>
  if (tipo === 'GESTION_VENTAS') return <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>
  if (tipo === 'SUPER') return <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/><path d="m4 7 5-4 5 5 6-6"/></svg>
  return <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.13.37.34.7.6 1 .3.28.68.42 1.1.4H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z"/></svg>
}

export default function AppNav({ rol, actual, variante = 'rojo', puedeGestionarVentas = false, modo = 'desktop' }: Props) {
  const [abierto, setAbierto] = useState(false)
  const visibles = items.filter((item) => {
    const rolPermitido = item.roles.some((permitido) => permitido === rol)
    if (!rolPermitido) return false
    if (item.key === 'GESTION_VENTAS') {
      if (rol === 'BBOO') return true
      return rol === 'VENDEDOR' && puedeGestionarVentas
    }
    return true
  })

  useEffect(() => {
    if (!abierto) return
    const cerrar = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    window.addEventListener('keydown', cerrar)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', cerrar)
      document.body.style.overflow = ''
    }
  }, [abierto])

  if (modo === 'mobile-trigger') {
    return (
      <>
        <button type="button" onClick={() => setAbierto(true)} aria-label="Abrir menú" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/15 lg:hidden">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>

        {abierto && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            <button type="button" aria-label="Cerrar menú" onClick={() => setAbierto(false)} className="absolute inset-0 bg-black/45 backdrop-blur-[1px]" />
            <aside className="absolute inset-y-0 left-0 flex w-[min(84vw,340px)] flex-col bg-[#161b22] text-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                <div>
                  <div className="text-sm font-black">Plataforma de Gestión Lucom</div>
                  <div className="mt-1 text-[11px] text-white/55">Navegación</div>
                </div>
                <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" className="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M18 6 6 18"/></svg>
                </button>
              </div>
              <nav aria-label="Navegación principal móvil" className="flex-1 space-y-1 overflow-y-auto p-3">
                {visibles.map((item) => {
                  const activo = actual === item.key
                  return (
                    <Link key={item.key} href={item.href} onClick={() => setAbierto(false)} className={activo ? 'flex items-center gap-3 rounded-lg bg-white/10 px-3 py-3 text-sm font-bold text-white' : 'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-white/75 hover:bg-white/8 hover:text-white'}>
                      <Icono tipo={item.key} />
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
              <div className="border-t border-white/10 p-4 [&_button]:w-full [&_button]:border-white/20 [&_button]:text-white [&_button]:hover:bg-white/10">
                <CerrarSesion />
              </div>
            </aside>
          </div>
        )}
      </>
    )
  }

  return (
    <nav aria-label="Navegación principal" className="flex items-center justify-center gap-0.5 xl:gap-1 2xl:gap-2">
      {visibles.map((item) => {
        const activo = actual === item.key
        const clases = variante === 'rojo'
          ? activo
            ? 'relative flex shrink-0 flex-col items-center gap-1 rounded-lg bg-white/10 px-2.5 py-2 text-[10px] font-bold text-white after:absolute after:inset-x-2.5 after:-bottom-[7px] after:h-[3px] after:rounded-full after:bg-white xl:px-3 xl:text-[11px] 2xl:px-4 2xl:text-xs'
            : 'flex shrink-0 flex-col items-center gap-1 rounded-lg px-2.5 py-2 text-[10px] font-semibold text-red-50 transition-colors hover:bg-white/10 hover:text-white xl:px-3 xl:text-[11px] 2xl:px-4 2xl:text-xs'
          : activo
            ? 'flex shrink-0 items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700'
            : 'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        return (
          <Link key={item.key} href={item.href} className={clases}>
            {variante === 'rojo' && <Icono tipo={item.key} />}
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
