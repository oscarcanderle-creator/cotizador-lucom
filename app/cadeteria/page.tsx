import { redirect } from 'next/navigation'
import Image from 'next/image'

import { createClient } from '../../utils/supabase/server'
import CerrarSesion from '../CerrarSesion'

export default async function CadeteriaPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, rol, activo, debe_cambiar_password')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.activo) {
    redirect('/login')
  }

  if (profile.debe_cambiar_password) {
    redirect('/cambiar-password')
  }

  if (profile.rol !== 'CADETERIA') {
    redirect('/ventas')
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-[#a90018] via-[#d20a22] to-[#a90018] text-white shadow-md">
        <div className="mx-auto flex min-h-[72px] max-w-5xl items-center gap-4 px-4">
          <div className="relative h-11 w-11 shrink-0">
            <Image
              src="/branding/logo-claro.png"
              alt="Claro"
              fill
              priority
              sizes="44px"
              className="object-contain"
            />
          </div>

          <div className="h-9 w-px bg-white/30" />

          <div className="relative h-10 w-32 shrink-0">
            <Image
              src="/branding/logo-lucom.png"
              alt="Grupo Lucom"
              fill
              priority
              sizes="128px"
              className="object-contain brightness-0 invert"
            />
          </div>

          <div className="ml-auto flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold">
                {profile.nombre || 'Cadetería'}
              </div>
              <div className="text-xs text-red-100">
                Cadetería
              </div>
            </div>

            <div className="[&_button]:text-white [&_button]:hover:text-red-100">
              <CerrarSesion />
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold uppercase tracking-wide text-red-600">
            Grupo Lucom
          </div>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Gestión de Cadetería
          </h1>

          <p className="mt-2 text-slate-600">
            Módulo operativo para la gestión de entregas.
          </p>

          <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
            Las entregas asignadas aparecerán aquí.
          </div>
        </div>
      </section>
    </main>
  )
}
