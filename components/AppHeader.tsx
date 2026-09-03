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

export default function AppHeader({
  rol,
  usuario,
  actual,
  puedeGestionarVentas = false,
}: Props) {
  return (
    <header className="sticky top-0 z-30 bg-red-600 text-white shadow-md">
      <div className="max-w-6xl mx-auto px-3 sm:px-5 py-2.5 sm:py-3">
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div aria-hidden="true" className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full border-2 border-white bg-red-700 shadow-inner">
              <span className="text-[11px] sm:text-xs font-black tracking-tight text-white">Claro</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5 leading-none">
                <span className="text-base sm:text-xl font-black tracking-tight">Claro</span>
                <span className="text-[11px] sm:text-sm font-semibold text-red-100">Ventas</span>
              </div>
              <div className="mt-1 text-[9px] sm:text-[11px] text-red-100">Carga de operaciones</div>
            </div>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none">
            <div className="text-base sm:text-xl font-black tracking-tight leading-none whitespace-nowrap">GrupoLucom</div>
            <div className="mt-1 text-[8px] sm:text-[10px] font-medium text-red-100 whitespace-nowrap">Agente Oficial Autorizado</div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3 text-[11px] sm:text-sm">
            <span className="hidden lg:inline max-w-40 truncate text-red-100">{usuario}</span>
            <div className="[&_button]:border-white/40 [&_button]:text-white [&_button]:hover:bg-white/10">
              <CerrarSesion />
            </div>
          </div>
        </div>

        <div className="mt-2 border-t border-white/20 pt-2">
          <AppNav
            rol={rol}
            actual={actual}
            variante="rojo"
            puedeGestionarVentas={puedeGestionarVentas}
          />
        </div>
      </div>
    </header>
  )
}
