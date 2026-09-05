import Image from 'next/image'
import CerrarSesion from '../app/CerrarSesion'
import AppNav from './AppNav'

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
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-[14%] hidden w-44 skew-x-[-25deg] bg-white/[0.045] lg:block" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-[8%] hidden w-20 skew-x-[-25deg] bg-black/[0.04] lg:block" />

      <div className="relative mx-auto w-full max-w-[1780px] px-3 sm:px-5 lg:px-6 xl:px-8">
        <div className="flex min-h-[72px] items-center gap-3 py-2 lg:hidden">
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

        <div className="hidden min-h-[82px] items-center gap-5 py-1.5 lg:flex">
          <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3 lg:gap-4">
            <div className="relative h-11 w-11 shrink-0 sm:h-13 sm:w-13 lg:h-14 lg:w-14 xl:h-16 xl:w-16">
              <Image
                src="/branding/logo-claro.png"
                alt="Claro"
                fill
                priority
                sizes="64px"
                className="object-contain drop-shadow-[0_3px_8px_rgba(80,0,0,0.28)]"
              />
            </div>

            <div className="hidden h-10 w-px bg-white/35 sm:block lg:h-12" />

            <div className="relative hidden h-10 w-[126px] shrink-0 sm:block lg:h-12 lg:w-[148px] xl:h-14 xl:w-[172px]">
              <Image
                src="/branding/logo-lucom.png"
                alt="Grupo Lucom"
                fill
                priority
                sizes="172px"
                className="object-contain brightness-0 invert"
              />
            </div>

            <div className="hidden h-10 w-px bg-white/25 xl:block" />
            <div className="hidden max-w-[120px] text-[12px] font-semibold leading-[1.15] text-white/95 xl:block 2xl:max-w-[150px] 2xl:text-sm">
              Plataforma de<br />Gestión Lucom
            </div>
          </div>

          <div className="hidden min-w-0 flex-1 lg:block">
            <AppNav
              rol={rol}
              actual={actual}
              variante="rojo"
              puedeGestionarVentas={puedeGestionarVentas}
              modo="desktop"
            />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden h-11 w-px bg-white/30 lg:block" />
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-black text-red-600 shadow-sm sm:h-10 sm:w-10 sm:text-xs xl:h-11 xl:w-11 xl:text-sm">
              {iniciales(usuario)}
            </div>
            <div className="hidden max-w-[150px] leading-tight xl:block 2xl:max-w-[190px]">
              <div className="truncate text-xs font-bold text-white 2xl:text-sm">{usuario}</div>
              <div className="mt-1 text-[10px] font-medium text-red-100 2xl:text-[11px]">{nombreRol(rol)}</div>
            </div>
            <div className="hidden lg:block [&_button]:border-white/35 [&_button]:text-white [&_button]:hover:bg-white/10">
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
