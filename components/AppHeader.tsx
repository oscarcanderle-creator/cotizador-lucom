import Image from 'next/image'

import CerrarSesion from '../app/CerrarSesion'

import AppNav from './AppNav'

type Actual =
  | 'VENTAS'
  | 'MIS_VENTAS'
  | 'MIS_CONSULTAS'
  | 'COTIZADOR'
  | 'GESTION_VENTAS'
  | 'VENTAS_GRUPO'
  | 'SUPER'
  | 'REPORTES'
  | 'LOGISTICA'
  | 'ADMIN'

type Props = {
  rol: string
  usuario: string
  actual: Actual
  puedeGestionarVentas?: boolean
}

function iniciales(usuario: string) {
  const partes = usuario.trim().split(/\s+/).filter(Boolean)

  if (!partes.length) return 'LU'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()

  return `${partes[0][0] ?? ''}${partes[partes.length - 1][0] ?? ''}`.toUpperCase()
}

function nombreRol(rol: string) {
  if (rol === 'SUPERVISOR') return 'Supervisor'
  if (rol === 'VENDEDOR') return 'Vendedor'
  if (rol === 'BBOO') return 'BBOO'
  if (rol === 'ADMIN') return 'Administrador'

  return rol
}

export default function AppHeader({
  rol,
  usuario,
  actual,
  puedeGestionarVentas = false,
}: Props) {
  return (
    <header className="sticky top-0 z-30 overflow-visible bg-gradient-to-r from-[#a90018] via-[#d20a22] to-[#a90018] text-white shadow-[0_8px_24px_rgba(88,0,12,0.22)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-[14%] hidden w-44 skew-x-[-25deg] bg-white/[0.045] lg:block"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-[8%] hidden w-20 skew-x-[-25deg] bg-black/[0.04] lg:block"
      />

      <div className="relative mx-auto w-full max-w-[1920px] px-3 sm:px-5 lg:px-6 2xl:px-5 min-[1800px]:px-8">
        {/* Tablet, notebook angosta y móvil */}
        <div className="flex min-h-[72px] items-center gap-3 py-2 min-[1400px]:hidden">
          <AppNav
            rol={rol}
            actual={actual}
            variante="rojo"
            puedeGestionarVentas={puedeGestionarVentas}
            modo="mobile-trigger"
          />

          <div className="relative h-12 w-12 shrink-0">
            <Image
              src="/branding/logo-claro.png"
              alt="Claro"
              fill
              priority
              sizes="48px"
              className="object-contain drop-shadow-[0_3px_8px_rgba(80,0,0,0.28)]"
            />
          </div>

          <div className="h-9 w-px shrink-0 bg-white/35" />

          <div className="relative h-9 min-w-0 flex-1">
            <Image
              src="/branding/logo-lucom.png"
              alt="Grupo Lucom"
              fill
              priority
              sizes="120px"
              className="object-contain object-left brightness-0 invert"
            />
          </div>

          <div className="h-9 w-px shrink-0 bg-white/25" />

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-red-600 shadow-sm">
            {iniciales(usuario)}
          </div>
        </div>

        {/* Escritorio desde 1400 px */}
        <div className="hidden min-h-[78px] items-center gap-3 py-1.5 min-[1400px]:flex min-[1800px]:min-h-[82px] min-[1800px]:gap-5">
          {/* Marca */}
          <div className="flex shrink-0 items-center gap-3">
            <div className="relative h-12 w-12 shrink-0 min-[1800px]:h-16 min-[1800px]:w-16">
              <Image
                src="/branding/logo-claro.png"
                alt="Claro"
                fill
                priority
                sizes="64px"
                className="object-contain drop-shadow-[0_3px_8px_rgba(80,0,0,0.28)]"
              />
            </div>

            <div className="h-10 w-px shrink-0 bg-white/35 min-[1800px]:h-12" />

            <div className="relative h-10 w-[122px] shrink-0 min-[1800px]:h-14 min-[1800px]:w-[172px]">
              <Image
                src="/branding/logo-lucom.png"
                alt="Grupo Lucom"
                fill
                priority
                sizes="172px"
                className="object-contain brightness-0 invert"
              />
            </div>

            <div className="hidden h-10 w-px shrink-0 bg-white/25 min-[1800px]:block" />

            <div className="hidden max-w-[150px] text-sm font-semibold leading-[1.15] text-white/95 min-[1800px]:block">
              Plataforma de<br />Gestión Lucom
            </div>
          </div>

          {/* Navegación: recibe todo el espacio disponible */}
          <div className="min-w-0 flex-1">
            <AppNav
              rol={rol}
              actual={actual}
              variante="rojo"
              puedeGestionarVentas={puedeGestionarVentas}
              modo="desktop"
            />
          </div>

          {/* Usuario */}
          <div className="ml-auto flex shrink-0 items-center gap-2 min-[1800px]:gap-3">
            <div className="h-10 w-px bg-white/30" />

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-red-600 shadow-sm min-[1800px]:h-11 min-[1800px]:w-11 min-[1800px]:text-sm">
              {iniciales(usuario)}
            </div>

            <div className="hidden max-w-[190px] leading-tight min-[1800px]:block">
              <div className="truncate text-sm font-bold text-white">
                {usuario}
              </div>
              <div className="mt-1 text-[11px] font-medium text-red-100">
                {nombreRol(rol)}
              </div>
            </div>

            <div className="[&_button]:border-white/35 [&_button]:text-white [&_button]:hover:bg-white/10">
              <CerrarSesion />
            </div>
          </div>
        </div>

        <div className="border-t border-white/15 py-1.5 text-center text-[13px] font-semibold tracking-[0.01em] text-white/95 sm:hidden">
          Plataforma de Gestión Lucom
        </div>
      </div>
    </header>
  )
}
