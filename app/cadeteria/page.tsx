import { redirect } from 'next/navigation'
import Image from 'next/image'

import { createClient } from '../../utils/supabase/server'
import CerrarSesion from '../CerrarSesion'
import RegistrarResultadoEntrega from '../../components/RegistrarResultadoEntrega'

function texto(valor: unknown) {
  return String(valor ?? '').trim()
}

function fechaArgentina(valor: unknown) {
  const fecha = texto(valor)

  if (!fecha) return '—'

  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Argentina/Cordoba',
  }).format(new Date(fecha))
}

function nombreCliente(entrega: any) {
  const nombre = texto(entrega.cliente_nombre)
  const apellido = texto(entrega.cliente_apellido)

  return [apellido, nombre].filter(Boolean).join(', ') || 'Cliente sin identificar'
}

function domicilioEntrega(entrega: any) {
  const principal = [
    texto(entrega.calle_nro),
    texto(entrega.piso) ? `Piso ${texto(entrega.piso)}` : '',
    texto(entrega.dpto) ? `Dpto ${texto(entrega.dpto)}` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  const ubicacion = [
    texto(entrega.barrio),
    texto(entrega.localidad),
  ]
    .filter(Boolean)
    .join(' · ')

  return [principal, ubicacion].filter(Boolean).join(' — ') || '—'
}

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

  const { data: filas, error: entregasError } = await supabase.rpc(
    'obtener_entregas_cadeteria'
  )

  if (entregasError) {
    throw new Error(
      `No se pudieron obtener las entregas de Cadetería: ${entregasError.message}`
    )
  }

  const entregasMap = new Map<number, any>()

  for (const fila of filas ?? []) {
    const gestionId = Number(fila.gestion_entrega_id)

    if (!entregasMap.has(gestionId)) {
      entregasMap.set(gestionId, {
        ...fila,
        chips: [],
      })
    }

    const entrega = entregasMap.get(gestionId)

    entrega.chips.push({
      producto_operacion_id: fila.producto_operacion_id,
      sim: fila.sim,
    })
  }

  const entregas = Array.from(entregasMap.values())

  const { data: motivos, error: motivosError } = await supabase.rpc(
    'obtener_motivos_no_entrega_logistica'
  )

  if (motivosError) {
    throw new Error(
      `No se pudieron obtener los motivos de no entrega: ${motivosError.message}`
    )
  }

  const motivosNoEntrega = motivos ?? []

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
              <div className="text-xs text-red-100">Cadetería</div>
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

          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Gestión de Cadetería
              </h1>

              <p className="mt-2 text-slate-600">
                Entregas actualmente en distribución.
              </p>
            </div>

            <div className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              {entregas.length}{' '}
              {entregas.length === 1 ? 'entrega' : 'entregas'}
            </div>
          </div>

          {entregas.length === 0 ? (
            <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No hay entregas en distribución.
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              {entregas.map((entrega: any) => (
                <article
                  key={entrega.gestion_entrega_id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
                          {texto(entrega.codigo_gestion)}
                        </span>

                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                          En distribución
                        </span>
                      </div>

                      <h2 className="mt-4 text-xl font-bold text-slate-900">
                        {nombreCliente(entrega)}
                      </h2>

                      <div className="mt-1 text-sm text-slate-500">
                        Operación {texto(entrega.operacion_id)}
                      </div>

                      <div className="mt-1 text-xs text-slate-400">
                        Lote {texto(entrega.codigo_lote)}
                      </div>
                    </div>

                    <div className="text-sm text-slate-500">
                      En distribución:{' '}
                      {fechaArgentina(entrega.fecha_primera_distribucion)}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Domicilio
                      </div>

                      <div className="mt-1 font-medium text-slate-900">
                        {domicilioEntrega(entrega)}
                      </div>

                      {texto(entrega.entre_calles) && (
                        <div className="mt-2 text-sm text-slate-600">
                          Entre calles: {texto(entrega.entre_calles)}
                        </div>
                      )}

                      {texto(entrega.datos_extras) && (
                        <div className="mt-1 text-sm text-slate-600">
                          {texto(entrega.datos_extras)}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Teléfono
                      </div>

                      <div className="mt-1 font-medium text-slate-900">
                        {texto(entrega.telefono) || '—'}
                      </div>

                      {texto(entrega.coordenadas) && (
                        <div className="mt-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Coordenadas
                          </div>
                          <div className="mt-1 text-sm text-slate-700">
                            {texto(entrega.coordenadas)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Chips
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {entrega.chips.map((chip: any) => (
                        <span
                          key={chip.producto_operacion_id}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                        >
                          SIM {texto(chip.sim) || '—'}
                        </span>
                      ))}
                    </div>
                  </div>

                  <RegistrarResultadoEntrega
                    intentoId={Number(entrega.intento_id)}
                    codigoGestion={texto(entrega.codigo_gestion)}
                    motivos={motivosNoEntrega}
                  />
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
